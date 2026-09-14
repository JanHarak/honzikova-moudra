export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type PwaInstallBannerState =
  | { show: false; mode: "standalone" | "hidden" }
  | { show: true; mode: "prompt" | "ios" };

export const INSTALL_BANNER_STORAGE_KEY = "hm-install-banner-hidden";

export type InstallBannerRuntimeState = {
  standalone: boolean;
  ios: boolean;
  hasBeforeInstallPrompt: boolean;
};

export function getInstallBannerState({
  standalone,
  ios,
  hasBeforeInstallPrompt,
}: InstallBannerRuntimeState): PwaInstallBannerState {
  if (standalone) return { show: false, mode: "standalone" };

  if (ios) return { show: true, mode: "ios" };

  if (hasBeforeInstallPrompt) return { show: true, mode: "prompt" };

  return { show: false, mode: "hidden" };
}
