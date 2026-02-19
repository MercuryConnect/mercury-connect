import { createHash } from "crypto";

// Hardcoded admin credentials
// Email: operations@mercuryholdings.co
// Password hash is SHA-256 of the password
const ADMIN_EMAIL = "operations@mercuryholdings.co";
const ADMIN_PASSWORD_HASH = createHash("sha256").update("1m1zt@h!8qhD7^Q1").digest("hex");

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: "admin";
}

export const ADMIN_USER: AdminUser = {
  id: 1,
  email: ADMIN_EMAIL,
  name: "Mercury Holdings Support",
  role: "admin",
};

/**
 * Verify admin credentials
 */
export function verifyAdminCredentials(email: string, password: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = createHash("sha256").update(password).digest("hex");
  
  return normalizedEmail === ADMIN_EMAIL && passwordHash === ADMIN_PASSWORD_HASH;
}

/**
 * Check if email matches admin email
 */
export function isAdminEmail(email: string): boolean {
  return email.toLowerCase().trim() === ADMIN_EMAIL;
}
