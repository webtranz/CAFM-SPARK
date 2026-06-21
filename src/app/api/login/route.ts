import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { auditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sandboxAdminPasswords, sandboxAdmins, sessionCookieName } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const builtInAdmins = sandboxAdmins.map((admin) => ({
  name: admin.name,
  email: admin.email,
  password: sandboxAdminPasswords[admin.email],
}));

async function ensureBuiltInAdmin(email: string, password: string) {
  const admin = builtInAdmins.find((item) => item.email === email && item.password === password);
  if (!admin) return null;

  const existing = await prisma.user.findUnique({ where: { email: admin.email } });
  if (existing?.active) return existing;

  const passwordHash = await bcrypt.hash(admin.password, 10);
  return prisma.user.upsert({
    where: { email: admin.email },
    update: {
      name: admin.name,
      role: "Admin",
      department: "Administration",
      passwordHash,
      active: true,
    },
    create: {
      name: admin.name,
      email: admin.email,
      role: "Admin",
      department: "Administration",
      passwordHash,
      active: true,
    },
  });
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (!process.env.DATABASE_URL) {
      const sandboxAdmin = sandboxAdmins.find((admin) => admin.email === input.email && sandboxAdminPasswords[admin.email] === input.password);
      if (!sandboxAdmin) {
        return apiError(new Error("Invalid login."), "Invalid login", 401);
      }

      const response = NextResponse.json({ ok: true, user: { name: sandboxAdmin.name, email: sandboxAdmin.email, role: sandboxAdmin.role } });
      response.cookies.set(sessionCookieName, createSessionToken(sandboxAdmin.id), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return response;
    }

    const builtInUser = await ensureBuiltInAdmin(input.email, input.password);

    const user = builtInUser ?? await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.active) {
      void auditAction({ user: null, action: "LOGIN_FAILED", entity: "auth", entityId: input.email, details: { email: input.email, reason: user ? "inactive_user" : "unknown_user" } });
      return apiError(new Error("Invalid login."), "Invalid login", 401);
    }

    const valid = Boolean(builtInUser) || await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      void auditAction({ user, action: "LOGIN_FAILED", entity: "auth", entityId: user.id, details: { email: input.email, reason: "invalid_password" } });
      return apiError(new Error("Invalid login."), "Invalid login", 401);
    }

    const response = NextResponse.json({ ok: true, user: { name: user.name, email: user.email, role: user.role } });
    response.cookies.set(sessionCookieName, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    void auditAction({ user, action: "LOGIN_SUCCESS", entity: "auth", entityId: user.id, details: { email: user.email, role: user.role, active: user.active } });
    return response;
  } catch (error) {
    return apiError(error, "Login failed");
  }
}
