import { ensureDefaultRbac } from "@/lib/rbac-seed";

let defaultRbacPromise: Promise<void> | null = null;

export function ensureDefaultRbacOnce() {
  if (!defaultRbacPromise) {
    defaultRbacPromise = ensureDefaultRbac().catch((error) => {
      defaultRbacPromise = null;
      throw error;
    });
  }
  return defaultRbacPromise;
}
