import { NextResponse } from "next/server";
import { accessRole } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ROLE_NAMES, defaultPermissionCodesForRole, expandPermissionCode, hasPermissionCode } from "@/lib/default-role-permissions";

export function authError(message = "Authentication required.", status = 401) {
  return NextResponse.json({ message }, { status });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { error: authError() as NextResponse, user: null };
  return { user, error: null };
}

export async function requireRole(roles: string[]) {
  const { user, error } = await requireUser();
  if (error) return { user: null, error };
  if (!roles.includes(accessRole(user))) {
    return { user: null, error: authError("Access denied.", 403) };
  }
  return { user, error: null };
}

export async function requirePermission(code: string) {
  const { user, error } = await requireUser();
  if (error) return { user: null, error };
  if (accessRole(user) === "admin") return { user, error: null };
  const allowed = await prisma.rolePermission.findFirst({
    where: { role: user.role || "", permission: { code: { in: expandPermissionCode(code) } } },
    select: { id: true },
  });
  if (allowed || defaultRoleAllows(user.role || "", code)) return { user, error: null };
  return { user: null, error: authError("Access denied.", 403) };
}

export async function requireAnyPermission(codes: string[]) {
  const { user, error } = await requireUser();
  if (error) return { user: null, error };
  if (accessRole(user) === "admin") return { user, error: null };
  const allowed = await prisma.rolePermission.findFirst({
    where: { role: user.role || "", permission: { code: { in: Array.from(new Set(codes.flatMap(expandPermissionCode))) } } },
    select: { id: true },
  });
  if (allowed || codes.some((code) => defaultRoleAllows(user.role || "", code))) return { user, error: null };
  return { user: null, error: authError("Access denied.", 403) };
}

function defaultRoleAllows(role: string, code: string) {
  if (!DEFAULT_ROLE_NAMES.includes(role as any)) return false;
  return hasPermissionCode(new Set(defaultPermissionCodesForRole(role)), code);
}

export async function requireAdmin() {
  const { user, error } = await requireUser();
  if (error) return { user: null, error };
  if (accessRole(user) !== "admin") {
    return { user: null, error: authError("Only administrators can perform this action.", 403) };
  }
  return { user, error: null };
}

