import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const sessionCookieName = "cafm_session";
export const sandboxAdmin = {
  id: "admin-local",
  name: "System Administrator",
  email: "admin@cafm.local",
  role: "Admin",
  department: "Administration",
  team: null,
};
export const sandboxAdmins = [
  sandboxAdmin,
];
export const sandboxAdminPassword = "Admin@12345";
export const sandboxAdminPasswords: Record<string, string> = {
  "admin@cafm.local": sandboxAdminPassword,
};
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || process.env.DATABASE_URL || "cafm-development-session-secret";
}

function signSessionValue(userId: string, expiresAt: number) {
  return createHmac("sha256", sessionSecret()).update(`${userId}.${expiresAt}`).digest("hex");
}

export function createSessionToken(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds;
  return `${userId}.${expiresAt}.${signSessionValue(userId, expiresAt)}`;
}

function requestUsesHttps(request: Request) {
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol = new URL(request.url).protocol;
  return protocol === "https:" || forwardedProto === "https";
}

export function sessionCookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: requestUsesHttps(request),
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  };
}

export function clearSessionCookieOptions(request: Request) {
  return {
    ...sessionCookieOptions(request),
    maxAge: 0,
  };
}

function verifySessionToken(token: string) {
  const [userId, expiresAtValue, signature] = token.split(".");
  const expiresAt = Number(expiresAtValue);
  if (!userId || !signature || !Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;
  const expected = signSessionValue(userId, expiresAt);
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return userId;
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const userId = token ? verifySessionToken(token) : null;
  if (!userId) return null;

  if (!process.env.DATABASE_URL) {
    return sandboxAdmins.find((admin) => admin.id === userId) ?? null;
  }

  try {
    return await prisma.user.findFirst({
      where: { id: userId, active: true },
      select: { id: true, name: true, email: true, role: true, department: true, team: { select: { code: true, name: true } } },
    });
  } catch {
    return null;
  }
}
