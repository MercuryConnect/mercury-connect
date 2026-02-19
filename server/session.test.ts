import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// Mock the database functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    createSession: vi.fn(),
    getSessionBySessionId: vi.fn(),
    getSessionsForHost: vi.fn(),
    getActiveSessions: vi.fn(),
    updateSessionStatus: vi.fn(),
    updateSessionSignaling: vi.fn(),
    logSessionActivity: vi.fn(),
    markNotificationSent: vi.fn(),
    verifyPassword: vi.fn(),
    getUserById: vi.fn(),
  };
});

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { "x-forwarded-for": "192.168.1.1" },
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("session.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new session for authenticated user", async () => {
    const mockSession = {
      id: 1,
      sessionId: "abc123def456",
      passwordHash: "hashed",
      status: "waiting",
      hostUserId: 1,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
    };

    vi.mocked(db.createSession).mockResolvedValue({
      session: mockSession as any,
      password: "ABCD1234",
    });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.session.create({ expiresInMinutes: 60 });

    expect(result).toHaveProperty("sessionId");
    expect(result).toHaveProperty("password");
    expect(result).toHaveProperty("expiresAt");
    expect(db.createSession).toHaveBeenCalledWith(1, 60, false);
  });

  it("throws error when session creation fails", async () => {
    vi.mocked(db.createSession).mockResolvedValue(null);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.session.create({ expiresInMinutes: 60 }))
      .rejects.toThrow("Failed to create session");
  });
});

describe("session.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session details for the host", async () => {
    const mockSession = {
      id: 1,
      sessionId: "abc123def456",
      status: "waiting",
      hostUserId: 1,
      clientName: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    };

    vi.mocked(db.getSessionBySessionId).mockResolvedValue(mockSession as any);

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.session.get({ sessionId: "abc123def456" });

    expect(result.sessionId).toBe("abc123def456");
    expect(result.status).toBe("waiting");
  });

  it("throws error when session not found", async () => {
    vi.mocked(db.getSessionBySessionId).mockResolvedValue(null);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.session.get({ sessionId: "nonexistent" }))
      .rejects.toThrow("Session not found");
  });

  it("throws error when user is not the host", async () => {
    const mockSession = {
      id: 1,
      sessionId: "abc123def456",
      hostUserId: 2, // Different user
    };

    vi.mocked(db.getSessionBySessionId).mockResolvedValue(mockSession as any);

    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.session.get({ sessionId: "abc123def456" }))
      .rejects.toThrow("Unauthorized");
  });
});

describe("signaling.join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows client to join with valid password", async () => {
    const mockSession = {
      id: 1,
      sessionId: "abc123def456",
      passwordHash: "correcthash",
      status: "waiting",
      hostUserId: 1,
      expiresAt: new Date(Date.now() + 3600000),
      startNotificationSent: false,
      hostOffer: null,
    };

    vi.mocked(db.getSessionBySessionId).mockResolvedValue(mockSession as any);
    vi.mocked(db.verifyPassword).mockReturnValue(true);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, name: "Host" } as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.signaling.join({
      sessionId: "abc123def456",
      password: "ABCD1234",
      clientName: "Test Client",
    });

    expect(result.success).toBe(true);
    expect(db.updateSessionSignaling).toHaveBeenCalled();
    expect(db.logSessionActivity).toHaveBeenCalled();
  });

  it("rejects invalid password", async () => {
    const mockSession = {
      id: 1,
      sessionId: "abc123def456",
      passwordHash: "correcthash",
      status: "waiting",
      expiresAt: new Date(Date.now() + 3600000),
    };

    vi.mocked(db.getSessionBySessionId).mockResolvedValue(mockSession as any);
    vi.mocked(db.verifyPassword).mockReturnValue(false);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.signaling.join({
      sessionId: "abc123def456",
      password: "WRONG",
    })).rejects.toThrow("Invalid password");
  });

  it("rejects expired session", async () => {
    const mockSession = {
      id: 1,
      sessionId: "abc123def456",
      status: "expired",
      expiresAt: new Date(Date.now() - 3600000), // Expired
    };

    vi.mocked(db.getSessionBySessionId).mockResolvedValue(mockSession as any);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.signaling.join({
      sessionId: "abc123def456",
      password: "ABCD1234",
    })).rejects.toThrow("Session has expired");
  });
});

describe("password utilities", () => {
  it("generates unique session IDs", () => {
    const id1 = db.generateSessionId();
    const id2 = db.generateSessionId();
    
    expect(id1).toHaveLength(24);
    expect(id2).toHaveLength(24);
    expect(id1).not.toBe(id2);
  });

  it("generates 8-character passwords", () => {
    const password = db.generateSessionPassword();
    
    expect(password).toHaveLength(8);
    expect(password).toMatch(/^[A-F0-9]+$/);
  });

  it("hashes passwords to SHA-256 hex", () => {
    const password = "TESTPASS";
    const hash = db.hashPassword(password);
    
    expect(hash).toHaveLength(64); // SHA-256 hex
    // Same password should produce same hash
    expect(db.hashPassword(password)).toBe(hash);
    // Different password should produce different hash
    expect(db.hashPassword("DIFFERENT")).not.toBe(hash);
  });
});
