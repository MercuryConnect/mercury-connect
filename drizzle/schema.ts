import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Remote desktop sessions table
 * Tracks active and completed remote support sessions
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique session identifier for URLs */
  sessionId: varchar("sessionId", { length: 32 }).notNull().unique(),
  /** Hashed session password */
  passwordHash: varchar("passwordHash", { length: 128 }).notNull(),
  /** Session status */
  status: mysqlEnum("status", ["waiting", "connecting", "connected", "disconnected", "expired"]).default("waiting").notNull(),
  /** Support staff user ID (creator of the session) */
  hostUserId: int("hostUserId").references(() => users.id),
  /** Client's display name (optional) */
  clientName: varchar("clientName", { length: 255 }),
  /** Client's IP address for logging */
  clientIp: varchar("clientIp", { length: 45 }),
  /** WebRTC signaling data - host's offer */
  hostOffer: text("hostOffer"),
  /** WebRTC signaling data - client's answer */
  clientAnswer: text("clientAnswer"),
  /** WebRTC signaling data - client's offer (for desktop agent flow) */
  clientOffer: text("clientOffer"),
  /** WebRTC signaling data - host's answer (for desktop agent flow) */
  hostAnswer: text("hostAnswer"),
  /** ICE candidates from host */
  hostIceCandidates: text("hostIceCandidates"),
  /** ICE candidates from client */
  clientIceCandidates: text("clientIceCandidates"),
  /** Whether email notification was sent for session start */
  startNotificationSent: boolean("startNotificationSent").default(false),
  /** Whether email notification was sent for session end */
  endNotificationSent: boolean("endNotificationSent").default(false),
  /** Whether to auto-start recording when client joins */
  autoRecord: boolean("autoRecord").default(false),
  /** Calendar event ID (for Ops Platform calendar integration) */
  calendarEventId: varchar("calendarEventId", { length: 255 }),
  /** Calendar source identifier */
  calendarSource: varchar("calendarSource", { length: 64 }),
  /** Session creation timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Last activity timestamp */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Session connection timestamp */
  connectedAt: timestamp("connectedAt"),
  /** Session end timestamp */
  endedAt: timestamp("endedAt"),
  /** Session expiration timestamp */
  expiresAt: timestamp("expiresAt").notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Session activity logs for audit trail
 */
export const sessionLogs = mysqlTable("sessionLogs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").references(() => sessions.id).notNull(),
  /** Type of activity */
  activityType: mysqlEnum("activityType", [
    "session_created",
    "client_joined",
    "host_connected",
    "control_started",
    "control_ended",
    "clipboard_sync",
    "disconnected",
    "reconnected",
    "session_ended",
    "client_disconnected"
  ]).notNull(),
  /** Additional details as JSON */
  details: text("details"),
  /** Timestamp of the activity */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SessionLog = typeof sessionLogs.$inferSelect;
export type InsertSessionLog = typeof sessionLogs.$inferInsert;

/**
 * Session recordings table
 * Stores metadata for recorded sessions (files stored in S3)
 */
export const recordings = mysqlTable("recordings", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to sessions.id */
  sessionId: int("sessionId").references(() => sessions.id).notNull(),
  /** String session ID for easy lookup */
  sessionStringId: varchar("sessionStringId", { length: 32 }).notNull(),
  /** User who initiated the recording */
  recordedBy: int("recordedBy").references(() => users.id).notNull(),
  /** S3 file key */
  fileKey: text("fileKey").notNull(),
  /** Public URL to the recording */
  url: text("url").notNull(),
  /** File size in bytes */
  fileSize: bigint("fileSize", { mode: "number" }),
  /** Duration in seconds */
  durationSeconds: int("durationSeconds"),
  /** MIME type */
  mimeType: varchar("mimeType", { length: 64 }).default("video/webm"),
  /** Client name at time of recording */
  clientName: varchar("clientName", { length: 255 }),
  /** Recording creation timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = typeof recordings.$inferInsert;
