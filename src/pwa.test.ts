import { describe, expect, it } from "vitest";
import { getInstallBannerState } from "./pwa";

describe("getInstallBannerState", () => {
  it("shows banner on supported desktop installs", () => {
    expect(
      getInstallBannerState({
        standalone: false,
        ios: false,
        hasBeforeInstallPrompt: true,
      }),
    ).toEqual({ show: true, mode: "prompt" });
  });

  it("shows banner with ios instructions", () => {
    expect(
      getInstallBannerState({
        standalone: false,
        ios: true,
        hasBeforeInstallPrompt: false,
      }),
    ).toEqual({ show: true, mode: "ios" });
  });

  it("hides banner when app is already installed", () => {
    expect(
      getInstallBannerState({
        standalone: true,
        ios: false,
        hasBeforeInstallPrompt: true,
      }),
    ).toEqual({ show: false, mode: "standalone" });
  });
});
