import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { jwtVerify } from "jose";
import { ENV } from "./env";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  if (!cookieHeader) {
    return new Map();
  }
  const cookies = new Map<string, string>();
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies.set(name, rest.join('='));
    }
  });
  return cookies;
}

async function authenticateCustomJwt(cookieValue: string): Promise<User | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(cookieValue, secret, {
      algorithms: ["HS256"],
    });
    
    // Check if this is a custom login JWT (has email field)
    if (payload.email && payload.sub) {
      // Get user from database by openId
      const openId = `admin_${payload.sub}`;
      const user = await db.getUserByOpenId(openId);
      return user || null;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // First try custom JWT authentication
    const cookies = parseCookies(opts.req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    
    if (sessionCookie) {
      // Try custom JWT first
      user = await authenticateCustomJwt(sessionCookie);
      
      // If custom JWT fails, try OAuth authentication
      if (!user) {
        user = await sdk.authenticateRequest(opts.req);
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
