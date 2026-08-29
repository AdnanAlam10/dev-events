import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SessionUser } from "@/database/types";

const COOKIE_NAME = "dev_event_session";
const DEMO_USERS: Record<string, SessionUser> = {
  organizer: {
    id: "demo-organizer",
    name: "DevEvent Demo Studio",
    email: "organizer@demo.devevent.local",
    role: "organizer",
  },
  admin: {
    id: "demo-admin",
    name: "DevEvent Demo Admin",
    email: "admin@demo.devevent.local",
    role: "admin",
  },
};

type SessionPayload = SessionUser & { expiresAt: number };

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return secret ?? "local-demo-session-secret-not-for-production";
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function encodeSession(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({ ...user, expiresAt: Date.now() + 8 * 60 * 60 * 1000 } satisfies SessionPayload),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string | undefined): SessionUser | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (decoded.expiresAt < Date.now() || !["organizer", "admin"].includes(decoded.role)) return null;
    const { expiresAt: _expiresAt, ...user } = decoded;
    return user;
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<SessionUser | null> {
  return decodeSession((await cookies()).get(COOKIE_NAME)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function createDemoSession(account: keyof typeof DEMO_USERS, code: string): Promise<SessionUser | null> {
  const expectedCode = process.env.DEMO_LOGIN_CODE;
  if (!expectedCode && process.env.NODE_ENV === "production") {
    throw new Error("DEMO_LOGIN_CODE is required in production.");
  }
  if (code !== (expectedCode ?? "DevEventDemo!2026")) return null;
  const user = DEMO_USERS[account];
  if (!user) return null;
  (await cookies()).set(COOKIE_NAME, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return user;
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}
