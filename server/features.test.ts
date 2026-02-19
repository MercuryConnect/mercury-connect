import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Mock the db module
vi.mock("./db", () => {
  const mockSession = {
    id: 1,
    sessionId: "abc123def456",
    passwordHash: "mocked",
    status: "waiting",
    hostUserId: 1,
    clientName: null,
    clientIp: null,
    hostOffer: null,
    clientAnswer: null,
    clientOffer: null,
    hostAnswer: null,
    hostIceCandidates: null,
    clientIceCandidates: null,
    startNotificationSent: false,
    endNotificationSent: false,
    calendarEventId: null,
    calendarSource: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    connectedAt: null,
    endedAt: null,
    expiresAt: new Date(Date.now() + 3600000),
  };

  const mockRecording = {
    id: 1,
    sessionId: 1,
    sessionStringId: "abc123def456",
    recordedBy: 1,
    fileKey: "recordings/abc123def456/test.webm",
    url: "https://s3.example.com/recordings/test.webm",
    fileSize: 1024000,
    durationSeconds: 120,
    mimeType: "video/webm",
    clientName: "Test Client",
    createdAt: new Date(),
  };

  return {
    getDb: vi.fn().mockResolvedValue({}),
    createSession: vi.fn().mockImplementation((_hostId: number, _expires: number, autoRecord: boolean = false) => Promise.resolve({
      session: { ...mockSession, autoRecord },
      password: "ABCD1234",
    })),
    createCalendarSession: vi.fn().mockResolvedValue({
      session: mockSession,
      password: "EFGH5678",
    }),
    getSessionBySessionId: vi.fn().mockResolvedValue(mockSession),
    getSessionById: vi.fn().mockResolvedValue(mockSession),
    updateSessionStatus: vi.fn().mockResolvedValue(undefined),
    updateSessionSignaling: vi.fn().mockResolvedValue(undefined),
    markNotificationSent: vi.fn().mockResolvedValue(undefined),
    getSessionsForHost: vi.fn().mockResolvedValue([mockSession]),
    getActiveSessions: vi.fn().mockResolvedValue([mockSession]),
    logSessionActivity: vi.fn().mockResolvedValue(undefined),
    getSessionLogs: vi.fn().mockResolvedValue([]),
    verifyPassword: vi.fn().mockReturnValue(true),
    hashPassword: vi.fn().mockReturnValue("hashed"),
    generateSessionId: vi.fn().mockReturnValue("abc123def456"),
    generateSessionPassword: vi.fn().mockReturnValue("ABCD1234"),
    getUserById: vi.fn().mockResolvedValue({
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@mercury.com",
      role: "admin",
    }),
    getUserByEmail: vi.fn().mockResolvedValue({
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@mercury.com",
      role: "admin",
    }),
    getUserByOpenId: vi.fn().mockResolvedValue({
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@mercury.com",
      role: "admin",
    }),
    upsertUser: vi.fn().mockResolvedValue(undefined),
    createRecording: vi.fn().mockResolvedValue(mockRecording),
    getRecordingsForUser: vi.fn().mockResolvedValue([mockRecording]),
    getRecordingsForSession: vi.fn().mockResolvedValue([mockRecording]),
    deleteRecording: vi.fn().mockResolvedValue(true),
    getRecordingById: vi.fn().mockResolvedValue(mockRecording),
    cleanupExpiredSessions: vi.fn().mockResolvedValue(0),
  };
});

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "recordings/test.webm",
    url: "https://s3.example.com/recordings/test.webm",
  }),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock opsplatform
vi.mock("./opsplatform", () => ({
  requestVerificationCode: vi.fn().mockResolvedValue({ success: true }),
  verifyCode: vi.fn().mockResolvedValue({ success: true, user: { id: "1", email: "test@mercury.com", name: "Test" } }),
}));

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@mercury.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("session.create", () => {
  it("creates a new session and returns session details", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.session.create({ expiresInMinutes: 60 });

    expect(result).toHaveProperty("sessionId");
    expect(result).toHaveProperty("password");
    expect(result).toHaveProperty("expiresAt");
    expect(result.sessionId).toBe("abc123def456");
    expect(result.password).toBe("ABCD1234");
  });
});

describe("session.list", () => {
  it("returns sessions for the authenticated user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.session.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("sessionId");
  });
});

describe("recording.list", () => {
  it("returns recordings for the authenticated user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.recording.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("url");
    expect(result[0]).toHaveProperty("sessionStringId");
    expect(result[0]).toHaveProperty("durationSeconds");
  });
});

describe("recording.upload", () => {
  it("uploads a recording and returns success", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Small base64 encoded test data
    const testBase64 = Buffer.from("test video data").toString("base64");

    const result = await caller.recording.upload({
      sessionId: "abc123def456",
      fileBase64: testBase64,
      durationSeconds: 120,
      mimeType: "video/webm",
    });

    expect(result.success).toBe(true);
    expect(result.recording).toBeTruthy();
    expect(result.recording).toHaveProperty("url");
  });
});

describe("recording.delete", () => {
  it("deletes a recording and returns success", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.recording.delete({ recordingId: 1 });

    expect(result.success).toBe(true);
  });
});

describe("recording.forSession", () => {
  it("returns recordings for a specific session", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.recording.forSession({ sessionId: "abc123def456" });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("calendar.getApiKey", () => {
  it("returns the calendar API key for admin users", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.calendar.getApiKey();

    expect(result).toHaveProperty("apiKey");
    expect(typeof result.apiKey).toBe("string");
    expect(result.apiKey.length).toBe(32);
  });
});

describe("calendar.createMeeting", () => {
  it("creates a meeting with valid API key and returns join URL", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // First get the API key from an admin context
    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const { apiKey } = await adminCaller.calendar.getApiKey();

    const result = await caller.calendar.createMeeting({
      apiKey,
      hostEmail: "test@mercury.com",
      expiresInMinutes: 120,
      calendarEventId: "cal-event-123",
      calendarSource: "ops-platform",
    });

    expect(result.success).toBe(true);
    expect(result).toHaveProperty("sessionId");
    expect(result).toHaveProperty("password");
    expect(result).toHaveProperty("joinUrl");
    expect(result).toHaveProperty("hostUrl");
    expect(result).toHaveProperty("expiresAt");
    expect(result.joinUrl).toContain("/join/");
    expect(result.joinUrl).toContain("?p=");
    expect(result.hostUrl).toContain("/viewer/");
  });

  it("rejects invalid API key", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.calendar.createMeeting({
        apiKey: "invalid-key",
        hostEmail: "test@mercury.com",
        expiresInMinutes: 120,
      })
    ).rejects.toThrow("Invalid API key");
  });
});

describe("calendar.getMeetingStatus", () => {
  it("returns meeting status with valid API key", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Get API key
    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const { apiKey } = await adminCaller.calendar.getApiKey();

    const result = await caller.calendar.getMeetingStatus({
      apiKey,
      sessionId: "abc123def456",
    });

    expect(result).toHaveProperty("sessionId");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("createdAt");
    expect(result).toHaveProperty("expiresAt");
    expect(result.status).toBe("waiting");
  });

  it("rejects invalid API key", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.calendar.getMeetingStatus({
        apiKey: "invalid-key",
        sessionId: "abc123def456",
      })
    ).rejects.toThrow("Invalid API key");
  });
});
