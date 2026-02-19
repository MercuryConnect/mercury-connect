import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { requestVerificationCode, verifyCode } from "./opsplatform";
import { SignJWT } from "jose";
import { ENV } from "./_core/env";
import { storagePut } from "./storage";
import crypto from "crypto";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Internal API key for calendar integration (auto-generated, stored in memory)
// In production this would be an env var, but we generate a stable one from JWT_SECRET
function getCalendarApiKey(): string {
  return crypto.createHash('sha256').update(`calendar-api-${ENV.cookieSecret}`).digest('hex').substring(0, 32);
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    /** Request verification code for passwordless login */
    requestCode: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const result = await requestVerificationCode(input.email);
        
        if (!result.success) {
          throw new Error(result.error || "Failed to send verification code");
        }

        return { 
          success: true,
          message: "Verification code sent to your email"
        };
      }),

    /** Verify code and complete login */
    verifyCode: publicProcedure
      .input(z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await verifyCode(input.email, input.code);
        
        if (!result.success || !result.user) {
          throw new Error(result.error || "Verification failed");
        }

        // Create a JWT session token
        const secret = new TextEncoder().encode(ENV.cookieSecret);
        const token = await new SignJWT({ 
          sub: result.user.id,
          email: result.user.email,
          name: result.user.name || result.user.email,
          role: "admin",
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("24h")
          .sign(secret);

        // Ensure user exists in local database
        await db.upsertUser({
          openId: `ops_${result.user.id}`,
          name: result.user.name || result.user.email,
          email: result.user.email,
          role: "admin",
          lastSignedIn: new Date(),
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_DAY_MS });

        return { 
          success: true,
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name || result.user.email,
            role: "admin",
          }
        };
      }),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Session management for support staff
  session: router({
    /** Create a new remote support session */
    create: protectedProcedure
      .input(z.object({
        expiresInMinutes: z.number().min(5).max(480).default(60),
        autoRecord: z.boolean().default(false),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const result = await db.createSession(
          ctx.user.id, 
          input?.expiresInMinutes ?? 60,
          input?.autoRecord ?? false
        );
        
        if (!result) {
          throw new Error("Failed to create session");
        }

        return {
          sessionId: result.session.sessionId,
          password: result.password,
          expiresAt: result.session.expiresAt,
          autoRecord: result.session.autoRecord,
        };
      }),

    /** Get session details (for host) */
    get: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session) {
          throw new Error("Session not found");
        }

        // Only host can view full session details
        if (session.hostUserId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        return session;
      }),

    /** List sessions for current user */
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        activeOnly: z.boolean().default(false),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (input?.activeOnly) {
          return await db.getActiveSessions(ctx.user.id);
        }
        return await db.getSessionsForHost(ctx.user.id, input?.limit ?? 50);
      }),

    /** End a session */
    end: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session || session.hostUserId !== ctx.user.id) {
          throw new Error("Session not found or unauthorized");
        }

        await db.updateSessionStatus(input.sessionId, 'disconnected');
        await db.logSessionActivity(session.id, 'session_ended', { endedBy: 'host' });

        // Send end notification if not already sent
        if (!session.endNotificationSent) {
          await notifyOwner({
            title: "Remote Session Ended",
            content: `Session ${input.sessionId} has been ended by the host.`,
          });
          await db.markNotificationSent(input.sessionId, 'end');
        }

        return { success: true };
      }),

    /** Get session logs */
    logs: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session || session.hostUserId !== ctx.user.id) {
          throw new Error("Session not found or unauthorized");
        }

        return await db.getSessionLogs(session.id);
      }),
  }),

  // WebRTC signaling endpoints (public for client access)
  signaling: router({
    /** Client joins a session with password */
    join: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        password: z.string(),
        clientName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session) {
          throw new Error("Session not found");
        }

        if (session.status === 'expired' || session.expiresAt < new Date()) {
          throw new Error("Session has expired");
        }

        if (session.status === 'disconnected') {
          throw new Error("Session has ended");
        }

        if (!db.verifyPassword(input.password, session.passwordHash)) {
          throw new Error("Invalid password");
        }

        // Get client IP from request
        const clientIp = ctx.req.headers['x-forwarded-for'] as string || 
                        ctx.req.socket?.remoteAddress || 
                        'unknown';

        await db.updateSessionSignaling(input.sessionId, {
          clientName: input.clientName,
          clientIp: typeof clientIp === 'string' ? clientIp.split(',')[0] : clientIp,
        });

        await db.logSessionActivity(session.id, 'client_joined', { 
          clientName: input.clientName,
          clientIp,
        });

        // Send notification to host
        if (!session.startNotificationSent) {
          const host = await db.getUserById(session.hostUserId!);
          await notifyOwner({
            title: "New Remote Session Started",
            content: `Client "${input.clientName || 'Unknown'}" has joined session ${input.sessionId}. IP: ${clientIp}`,
          });
          await db.markNotificationSent(input.sessionId, 'start');
        }

        return {
          success: true,
          sessionId: session.sessionId,
          hostOffer: session.hostOffer,
        };
      }),

    /** Host sends WebRTC offer */
    sendOffer: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        offer: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session || session.hostUserId !== ctx.user.id) {
          throw new Error("Session not found or unauthorized");
        }

        await db.updateSessionSignaling(input.sessionId, {
          hostOffer: input.offer,
        });

        return { success: true };
      }),

    /** Client sends WebRTC answer */
    sendAnswer: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        password: z.string(),
        answer: z.string(),
      }))
      .mutation(async ({ input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session) {
          throw new Error("Session not found");
        }

        if (!db.verifyPassword(input.password, session.passwordHash)) {
          throw new Error("Invalid password");
        }

        await db.updateSessionSignaling(input.sessionId, {
          clientAnswer: input.answer,
        });

        await db.updateSessionStatus(input.sessionId, 'connected');
        await db.logSessionActivity(session.id, 'host_connected', {});

        return { success: true };
      }),

    /** Send ICE candidate */
    sendIceCandidate: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        password: z.string().optional(),
        candidate: z.string(),
        from: z.enum(['host', 'client']),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session) {
          throw new Error("Session not found");
        }

        // For client, verify password
        if (input.from === 'client' && input.password) {
          if (!db.verifyPassword(input.password, session.passwordHash)) {
            throw new Error("Invalid password");
          }
        }

        // For host, verify ownership
        if (input.from === 'host' && ctx.user?.id !== session.hostUserId) {
          throw new Error("Unauthorized");
        }

        const field = input.from === 'host' ? 'hostIceCandidates' : 'clientIceCandidates';
        const existing = session[field] ? JSON.parse(session[field]) : [];
        existing.push(input.candidate);

        await db.updateSessionSignaling(input.sessionId, {
          [field]: JSON.stringify(existing),
        });

        return { success: true };
      }),

    /** Get signaling data (polling endpoint) */
    getSignalingData: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        password: z.string().optional(),
        role: z.enum(['host', 'client']),
      }))
      .query(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session) {
          throw new Error("Session not found");
        }

        // For client, verify password
        if (input.role === 'client' && input.password) {
          if (!db.verifyPassword(input.password, session.passwordHash)) {
            throw new Error("Invalid password");
          }
        }

        // For host, verify ownership
        if (input.role === 'host' && ctx.user?.id !== session.hostUserId) {
          throw new Error("Unauthorized");
        }

        return {
          status: session.status,
          hostOffer: input.role === 'client' ? session.hostOffer : null,
          clientAnswer: input.role === 'host' ? session.clientAnswer : null,
          hostIceCandidates: input.role === 'client' ? session.hostIceCandidates : null,
          clientIceCandidates: input.role === 'host' ? session.clientIceCandidates : null,
          clientName: session.clientName,
          autoRecord: session.autoRecord,
        };
      }),

    /** Client sends offer (for desktop agent flow) */
    sendOfferFromClient: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        offer: z.any(), // RTCSessionDescription JSON
        iceCandidates: z.array(z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session) {
          throw new Error("Session not found");
        }

        // Store client's offer (in desktop agent flow, client creates offer)
        await db.updateSessionSignaling(input.sessionId, {
          clientOffer: JSON.stringify(input.offer),
          clientIceCandidates: input.iceCandidates ? JSON.stringify(input.iceCandidates) : null,
        });

        await db.updateSessionStatus(input.sessionId, 'connecting');

        return { success: true };
      }),

    /** Host sends answer (for desktop agent flow) */
    sendAnswerFromHost: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        answer: z.any(), // RTCSessionDescription JSON
        iceCandidates: z.array(z.any()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session || session.hostUserId !== ctx.user.id) {
          throw new Error("Session not found or unauthorized");
        }

        await db.updateSessionSignaling(input.sessionId, {
          hostAnswer: JSON.stringify(input.answer),
          hostIceCandidates: input.iceCandidates ? JSON.stringify(input.iceCandidates) : null,
        });

        await db.updateSessionStatus(input.sessionId, 'connected');

        return { success: true };
      }),

    /** Client gets answer from host (for desktop agent flow) */
    getAnswer: publicProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .query(async ({ input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session) {
          throw new Error("Session not found");
        }

        if (!session.hostAnswer) {
          return { answer: null, iceCandidates: null };
        }

        return {
          answer: JSON.parse(session.hostAnswer),
          iceCandidates: session.hostIceCandidates ? JSON.parse(session.hostIceCandidates) : [],
        };
      }),

    /** Host gets offer from client (for desktop agent flow) */
    getOffer: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session || session.hostUserId !== ctx.user.id) {
          throw new Error("Session not found or unauthorized");
        }

        if (!session.clientOffer) {
          return { offer: null, iceCandidates: null, clientName: session.clientName };
        }

        return {
          offer: JSON.parse(session.clientOffer),
          iceCandidates: session.clientIceCandidates ? JSON.parse(session.clientIceCandidates) : [],
          clientName: session.clientName,
        };
      }),

    /** Client notifies disconnect */
    clientDisconnect: publicProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session) {
          throw new Error("Session not found");
        }

        await db.updateSessionStatus(input.sessionId, 'disconnected');
        await db.logSessionActivity(session.id, 'client_disconnected', {});

        if (!session.endNotificationSent) {
          await notifyOwner({
            title: "Remote Session Ended",
            content: `Client disconnected from session ${input.sessionId}.`,
          });
          await db.markNotificationSent(input.sessionId, 'end');
        }

        return { success: true };
      }),

    /** Update session status */
    updateStatus: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        password: z.string().optional(),
        status: z.enum(['connected', 'disconnected']),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        
        if (!session) {
          throw new Error("Session not found");
        }

        await db.updateSessionStatus(input.sessionId, input.status);

        if (input.status === 'disconnected') {
          await db.logSessionActivity(session.id, 'disconnected', {});
          
          if (!session.endNotificationSent) {
            await notifyOwner({
              title: "Remote Session Ended",
              content: `Session ${input.sessionId} has been disconnected.`,
            });
            await db.markNotificationSent(input.sessionId, 'end');
          }
        }

        return { success: true };
      }),
  }),

  // ============ Recording Endpoints ============
  recording: router({
    /** Upload a recording */
    upload: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        fileBase64: z.string(),
        durationSeconds: z.number().optional(),
        mimeType: z.string().default('video/webm'),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        if (!session || session.hostUserId !== ctx.user.id) {
          throw new Error("Session not found or unauthorized");
        }

        // Decode base64 to buffer
        const buffer = Buffer.from(input.fileBase64, 'base64');
        const ext = input.mimeType.includes('webm') ? 'webm' : 'mp4';
        const randomSuffix = crypto.randomBytes(8).toString('hex');
        const fileKey = `recordings/${input.sessionId}/${Date.now()}-${randomSuffix}.${ext}`;

        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Save metadata
        const recording = await db.createRecording({
          sessionId: session.id,
          sessionStringId: input.sessionId,
          recordedBy: ctx.user.id,
          fileKey,
          url,
          fileSize: buffer.length,
          durationSeconds: input.durationSeconds,
          mimeType: input.mimeType,
          clientName: session.clientName || undefined,
        });

        return { success: true, recording };
      }),

    /** List recordings for current user */
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await db.getRecordingsForUser(ctx.user.id, input?.limit ?? 50);
      }),

    /** Get recordings for a specific session */
    forSession: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ ctx, input }) => {
        const session = await db.getSessionBySessionId(input.sessionId);
        if (!session || session.hostUserId !== ctx.user.id) {
          throw new Error("Session not found or unauthorized");
        }
        return await db.getRecordingsForSession(input.sessionId);
      }),

    /** Delete a recording */
    delete: protectedProcedure
      .input(z.object({ recordingId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const deleted = await db.deleteRecording(input.recordingId, ctx.user.id);
        if (!deleted) {
          throw new Error("Recording not found or unauthorized");
        }
        return { success: true };
      }),
  }),

  // ============ Calendar Integration API ============
  calendar: router({
    /** 
     * Create a meeting link from the Ops Platform calendar.
     * This is called server-to-server by the Ops Platform.
     * Authentication is via the internal API key derived from JWT_SECRET.
     */
    createMeeting: publicProcedure
      .input(z.object({
        apiKey: z.string(),
        hostEmail: z.string().email(),
        expiresInMinutes: z.number().min(5).max(1440).default(120),
        calendarEventId: z.string().optional(),
        calendarSource: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Verify API key
        if (input.apiKey !== getCalendarApiKey()) {
          throw new Error("Invalid API key");
        }

        // Find the host user by email
        const host = await db.getUserByEmail(input.hostEmail);
        if (!host) {
          throw new Error("Host user not found. They must have logged into Mercury Connect at least once.");
        }

        // Create the session
        const result = await db.createCalendarSession(
          host.id,
          input.expiresInMinutes,
          input.calendarEventId,
          input.calendarSource
        );

        if (!result) {
          throw new Error("Failed to create meeting session");
        }

        // Build the join URL with password embedded
        const baseUrl = process.env.MERCURY_CONNECT_URL || `https://connect.mercuryholdings.co`;
        const joinUrl = `${baseUrl}/join/${result.session.sessionId}?p=${result.password}`;
        const hostUrl = `${baseUrl}/viewer/${result.session.sessionId}`;

        return {
          success: true,
          sessionId: result.session.sessionId,
          password: result.password,
          joinUrl,
          hostUrl,
          expiresAt: result.session.expiresAt,
        };
      }),

    /** Get meeting status (for Ops Platform to check if a meeting is still active) */
    getMeetingStatus: publicProcedure
      .input(z.object({
        apiKey: z.string(),
        sessionId: z.string(),
      }))
      .query(async ({ input }) => {
        if (input.apiKey !== getCalendarApiKey()) {
          throw new Error("Invalid API key");
        }

        const session = await db.getSessionBySessionId(input.sessionId);
        if (!session) {
          throw new Error("Session not found");
        }

        return {
          sessionId: session.sessionId,
          status: session.status,
          clientName: session.clientName,
          createdAt: session.createdAt,
          connectedAt: session.connectedAt,
          endedAt: session.endedAt,
          expiresAt: session.expiresAt,
        };
      }),

    /** Get the calendar API key (only accessible to authenticated admins) */
    getApiKey: protectedProcedure
      .query(async ({ ctx }) => {
        // Only admins can see the API key
        if (ctx.user.role !== 'admin') {
          throw new Error("Unauthorized");
        }
        return { apiKey: getCalendarApiKey() };
      }),
  }),
});

export type AppRouter = typeof appRouter;
