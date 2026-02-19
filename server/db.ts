import { eq, and, lt, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, sessions, sessionLogs, recordings, InsertSession, InsertSessionLog, Session, Recording } from "../drizzle/schema";
import { ENV } from './_core/env';
import crypto from 'crypto';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Functions ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Session Functions ============

/** Generate a unique session ID */
export function generateSessionId(): string {
  return crypto.randomBytes(12).toString('hex');
}

/** Generate a random session password */
export function generateSessionPassword(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/** Hash a session password */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/** Verify a session password */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/** Create a new remote desktop session */
export async function createSession(hostUserId: number, expiresInMinutes: number = 60, autoRecord: boolean = false): Promise<{ session: Session; password: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const sessionId = generateSessionId();
  const password = generateSessionPassword();
  const passwordHash = hashPassword(password);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await db.insert(sessions).values({
    sessionId,
    passwordHash,
    hostUserId,
    expiresAt,
    autoRecord,
    status: 'waiting',
  });

  const result = await db.select().from(sessions).where(eq(sessions.sessionId, sessionId)).limit(1);
  
  if (result.length === 0) return null;

  // Log session creation
  await logSessionActivity(result[0].id, 'session_created', { hostUserId });

  return { session: result[0], password };
}

/** Create a session from calendar integration (with optional calendar event ID) */
export async function createCalendarSession(
  hostUserId: number, 
  expiresInMinutes: number = 60,
  calendarEventId?: string,
  calendarSource?: string
): Promise<{ session: Session; password: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const sessionId = generateSessionId();
  const password = generateSessionPassword();
  const passwordHash = hashPassword(password);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await db.insert(sessions).values({
    sessionId,
    passwordHash,
    hostUserId,
    expiresAt,
    status: 'waiting',
    calendarEventId: calendarEventId || null,
    calendarSource: calendarSource || null,
  });

  const result = await db.select().from(sessions).where(eq(sessions.sessionId, sessionId)).limit(1);
  
  if (result.length === 0) return null;

  await logSessionActivity(result[0].id, 'session_created', { hostUserId, calendarEventId, calendarSource });

  return { session: result[0], password };
}

/** Get session by session ID */
export async function getSessionBySessionId(sessionId: string): Promise<Session | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(sessions).where(eq(sessions.sessionId, sessionId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/** Get session by internal ID */
export async function getSessionById(id: number): Promise<Session | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/** Update session status */
export async function updateSessionStatus(sessionId: string, status: 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'expired'): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const updateData: Partial<Session> = { status };
  
  if (status === 'connected') {
    updateData.connectedAt = new Date();
  } else if (status === 'disconnected' || status === 'expired') {
    updateData.endedAt = new Date();
  }

  await db.update(sessions).set(updateData).where(eq(sessions.sessionId, sessionId));
}

/** Update session signaling data */
export async function updateSessionSignaling(
  sessionId: string, 
  data: {
    hostOffer?: string;
    clientAnswer?: string;
    clientOffer?: string;
    hostAnswer?: string;
    hostIceCandidates?: string | null;
    clientIceCandidates?: string | null;
    clientName?: string;
    clientIp?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(sessions).set(data).where(eq(sessions.sessionId, sessionId));
}

/** Mark notification as sent */
export async function markNotificationSent(sessionId: string, type: 'start' | 'end'): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const field = type === 'start' ? 'startNotificationSent' : 'endNotificationSent';
  await db.update(sessions).set({ [field]: true }).where(eq(sessions.sessionId, sessionId));
}

/** Get sessions for a host user */
export async function getSessionsForHost(hostUserId: number, limit: number = 50): Promise<Session[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(sessions)
    .where(eq(sessions.hostUserId, hostUserId))
    .orderBy(desc(sessions.createdAt))
    .limit(limit);
}

/** Get active sessions (waiting or connected) */
export async function getActiveSessions(hostUserId: number): Promise<Session[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(sessions)
    .where(
      and(
        eq(sessions.hostUserId, hostUserId),
        eq(sessions.status, 'waiting')
      )
    )
    .orderBy(desc(sessions.createdAt));
}

/** Clean up expired sessions */
export async function cleanupExpiredSessions(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date();
  const result = await db.update(sessions)
    .set({ status: 'expired', endedAt: now })
    .where(
      and(
        lt(sessions.expiresAt, now),
        eq(sessions.status, 'waiting')
      )
    );

  return 0; // MySQL doesn't return affected rows easily
}

// ============ Session Logging Functions ============

/** Log session activity */
export async function logSessionActivity(
  sessionId: number, 
  activityType: InsertSessionLog['activityType'],
  details?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(sessionLogs).values({
    sessionId,
    activityType,
    details: details ? JSON.stringify(details) : null,
  });
}

/** Get session logs */
export async function getSessionLogs(sessionId: number): Promise<typeof sessionLogs.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(sessionLogs)
    .where(eq(sessionLogs.sessionId, sessionId))
    .orderBy(desc(sessionLogs.createdAt));
}

// ============ Recording Functions ============

/** Save a recording metadata entry */
export async function createRecording(data: {
  sessionId: number;
  sessionStringId: string;
  recordedBy: number;
  fileKey: string;
  url: string;
  fileSize?: number;
  durationSeconds?: number;
  mimeType?: string;
  clientName?: string;
}): Promise<Recording | null> {
  const db = await getDb();
  if (!db) return null;

  await db.insert(recordings).values({
    sessionId: data.sessionId,
    sessionStringId: data.sessionStringId,
    recordedBy: data.recordedBy,
    fileKey: data.fileKey,
    url: data.url,
    fileSize: data.fileSize || null,
    durationSeconds: data.durationSeconds || null,
    mimeType: data.mimeType || 'video/webm',
    clientName: data.clientName || null,
  });

  // Get the last inserted recording
  const result = await db.select()
    .from(recordings)
    .where(eq(recordings.sessionStringId, data.sessionStringId))
    .orderBy(desc(recordings.createdAt))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/** Get recordings for a user */
export async function getRecordingsForUser(userId: number, limit: number = 50): Promise<Recording[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(recordings)
    .where(eq(recordings.recordedBy, userId))
    .orderBy(desc(recordings.createdAt))
    .limit(limit);
}

/** Get recordings for a session */
export async function getRecordingsForSession(sessionStringId: string): Promise<Recording[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(recordings)
    .where(eq(recordings.sessionStringId, sessionStringId))
    .orderBy(desc(recordings.createdAt));
}

/** Delete a recording */
export async function deleteRecording(recordingId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Verify ownership
  const rec = await db.select().from(recordings).where(eq(recordings.id, recordingId)).limit(1);
  if (rec.length === 0 || rec[0].recordedBy !== userId) return false;

  await db.delete(recordings).where(eq(recordings.id, recordingId));
  return true;
}

/** Get a recording by ID */
export async function getRecordingById(id: number): Promise<Recording | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(recordings).where(eq(recordings.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
