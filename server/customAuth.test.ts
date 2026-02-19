import { describe, expect, it } from "vitest";
import { verifyAdminCredentials, isAdminEmail, ADMIN_USER } from "./customAuth";

describe("customAuth", () => {
  describe("verifyAdminCredentials", () => {
    it("returns true for correct credentials", () => {
      const result = verifyAdminCredentials(
        "operations@mercuryholdings.co",
        "1m1zt@h!8qhD7^Q1"
      );
      expect(result).toBe(true);
    });

    it("returns true for correct credentials with uppercase email", () => {
      const result = verifyAdminCredentials(
        "OPERATIONS@MERCURYHOLDINGS.CO",
        "1m1zt@h!8qhD7^Q1"
      );
      expect(result).toBe(true);
    });

    it("returns true for correct credentials with mixed case email", () => {
      const result = verifyAdminCredentials(
        "Operations@MercuryHoldings.co",
        "1m1zt@h!8qhD7^Q1"
      );
      expect(result).toBe(true);
    });

    it("returns false for incorrect email", () => {
      const result = verifyAdminCredentials(
        "wrong@email.com",
        "1m1zt@h!8qhD7^Q1"
      );
      expect(result).toBe(false);
    });

    it("returns false for incorrect password", () => {
      const result = verifyAdminCredentials(
        "operations@mercuryholdings.co",
        "wrongpassword"
      );
      expect(result).toBe(false);
    });

    it("returns false for both incorrect", () => {
      const result = verifyAdminCredentials(
        "wrong@email.com",
        "wrongpassword"
      );
      expect(result).toBe(false);
    });

    it("returns false for empty credentials", () => {
      const result = verifyAdminCredentials("", "");
      expect(result).toBe(false);
    });
  });

  describe("isAdminEmail", () => {
    it("returns true for admin email", () => {
      expect(isAdminEmail("operations@mercuryholdings.co")).toBe(true);
    });

    it("returns true for admin email with uppercase", () => {
      expect(isAdminEmail("OPERATIONS@MERCURYHOLDINGS.CO")).toBe(true);
    });

    it("returns false for non-admin email", () => {
      expect(isAdminEmail("other@email.com")).toBe(false);
    });
  });

  describe("ADMIN_USER", () => {
    it("has correct structure", () => {
      expect(ADMIN_USER).toEqual({
        id: 1,
        email: "operations@mercuryholdings.co",
        name: "Mercury Holdings Support",
        role: "admin",
      });
    });
  });
});
