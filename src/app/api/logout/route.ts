import { NextResponse } from "next/server";
import { auditAction } from "@/lib/audit";
import { clearSessionCookieOptions, getCurrentUser, sessionCookieName } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  await auditAction({ user, action: "LOGOUT", entity: "auth", entityId: user?.id || "anonymous", details: { email: user?.email ?? null, role: user?.role ?? null } });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", clearSessionCookieOptions(request));
  return response;
}
