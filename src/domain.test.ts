import { describe, it, expect } from "vitest";
import { validateText, pragueDate, safeTarget } from "./domain";
describe("public contracts", () => {
  it("validates Unicode and trimmed text", () => {
    expect(validateText("   ")).toBeTruthy();
    expect(validateText("🙂".repeat(500))).toBeNull();
    expect(validateText("a".repeat(501))).toBeTruthy();
  });
  it("uses Prague midnight across DST", () => {
    expect(pragueDate(new Date("2026-03-29T22:30:00Z"))).toBe("2026-03-30");
    expect(pragueDate(new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-25");
  });
  it("restricts incoming deep links", () => {
    expect(
      safeTarget("honzikovamoudra://moudra/abc", "https://example.test"),
    ).toBe("/moudra/abc");
    expect(
      safeTarget("https://evil.test/moudra/abc", "https://example.test"),
    ).toBeNull();
    expect(
      safeTarget("https://example.test/admin", "https://example.test"),
    ).toBeNull();
    expect(
      safeTarget("javascript:alert(1)", "https://example.test"),
    ).toBeNull();
  });
});
describe("auth deep links", () => {
  it("keeps callback parameters only on the allowlisted route", () => {
    expect(
      safeTarget(
        "honzikovamoudra://auth/callback?code=secret",
        "https://example.test",
      ),
    ).toBe("/auth/callback?code=secret");
    expect(
      safeTarget("honzikovamoudra://admin?code=secret", "https://example.test"),
    ).toBeNull();
  });
});
