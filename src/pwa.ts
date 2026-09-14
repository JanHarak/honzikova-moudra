import { db } from "./api";

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
const WEB_INSTALLATION_KEY = "hm-web-installation";

type WebInstallation = { id: string; credential: string };

function vapidKey() {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
}

function decodeBase64Url(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function webPushAvailable() {
  return Boolean(
    !window.matchMedia("(display-mode: standalone)").matches ||
      "serviceWorker" in navigator,
  ) && Boolean(db && vapidKey() && "PushManager" in window && "Notification" in window);
}

async function webInstallation() {
  const saved = localStorage.getItem(WEB_INSTALLATION_KEY);
  if (saved) return JSON.parse(saved) as WebInstallation;
  if (!db) throw Error("BACKEND_REQUIRED");
  const { data, error } = await db.functions.invoke("hm-installation", {
    body: { action: "register" },
  });
  if (error) throw error;
  localStorage.setItem(WEB_INSTALLATION_KEY, JSON.stringify(data));
  return data as WebInstallation;
}

async function updateWebInstallation(
  enabled: boolean,
  subscription: PushSubscription | null,
) {
  const installation = await webInstallation();
  const { error } = await db!.functions.invoke("hm-installation", {
    body: {
      action: "update",
      ...installation,
      enabled,
      permission: Notification.permission,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      provider: "webpush",
      token: subscription ? JSON.stringify(subscription.toJSON()) : undefined,
    },
  });
  if (error) throw error;
}

export async function setWebPush(enabled: boolean) {
  if (!webPushAvailable()) throw Error("WEB_PUSH_UNAVAILABLE");
  const registration = await navigator.serviceWorker.ready;
  if (!enabled) {
    await updateWebInstallation(false, null);
    return;
  }
  const subscription = await requestWebSubscription(registration);
  await updateWebInstallation(true, subscription);
}

async function requestWebSubscription(registration: ServiceWorkerRegistration) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw Error("PERMISSION_DENIED");
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapidKey()!),
  });
}

export async function ensureWebPush() {
  if (!webPushAvailable()) throw Error("WEB_PUSH_UNAVAILABLE");
  const registration = await navigator.serviceWorker.ready;
  const subscription = registration.pushManager;
  const current = await subscription.getSubscription();
  await updateWebInstallation(
    localStorage.getItem("hm-news") === "true",
    current || (await requestWebSubscription(registration)),
  );
}

export async function setWebDaily(enabled: boolean) {
  const installation = await webInstallation();
  const { error } = await db!.functions.invoke("hm-installation", {
    body: { action: "daily", ...installation, enabled },
  });
  if (error) throw error;
}

export async function showTestWebNotification() {
  if (!webPushAvailable()) throw Error("WEB_PUSH_UNAVAILABLE");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw Error("PERMISSION_DENIED");
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Honzíkova moudra", {
    body: "Testovací upozornění funguje.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { path: "/denni" },
  });
}

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
