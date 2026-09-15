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
  return Boolean(db && vapidKey() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
}

function withPushTimeout<T>(operation: Promise<T>, code = "WEB_PUSH_TIMEOUT"): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(code)), 20000);
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function invokeInstallation(body: Record<string, unknown>) {
  if (!db) throw Error("BACKEND_REQUIRED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const result = await db.functions.invoke("hm-installation", { body, signal: controller.signal });
    if (controller.signal.aborted) throw Error("WEB_PUSH_TIMEOUT");
    if (result.error) throw result.error;
    return result.data;
  } finally {
    clearTimeout(timer);
  }
}

async function webPermission() {
  // Run before any async work so Safari still sees the user's tap.
  const permission = Notification.permission === "default"
    ? await withPushTimeout(Notification.requestPermission())
    : Notification.permission;
  if (permission !== "granted") throw Error("PERMISSION_DENIED");
}

function readyWorker() {
  return withPushTimeout(navigator.serviceWorker.ready, "SERVICE_WORKER_TIMEOUT");
}

async function webInstallation() {
  const saved = localStorage.getItem(WEB_INSTALLATION_KEY);
  if (saved) return JSON.parse(saved) as WebInstallation;
  if (!db) throw Error("BACKEND_REQUIRED");
  const data = await invokeInstallation({ action: "register" });
  localStorage.setItem(WEB_INSTALLATION_KEY, JSON.stringify(data));
  return data as WebInstallation;
}

async function updateWebInstallation(
  enabled: boolean,
  subscription: PushSubscription | null,
) {
  const installation = await webInstallation();
  await invokeInstallation({
      action: "update",
      ...installation,
      enabled,
      permission: Notification.permission,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      provider: "webpush",
      token: subscription ? JSON.stringify(subscription.toJSON()) : undefined,
  });
}

export async function setWebPush(enabled: boolean) {
  if (!webPushAvailable()) throw Error("WEB_PUSH_UNAVAILABLE");
  if (!enabled) {
    await updateWebInstallation(false, null);
    return;
  }
  await webPermission();
  const subscription = await requestWebSubscription(await readyWorker());
  await updateWebInstallation(true, subscription);
}

async function requestWebSubscription(registration: ServiceWorkerRegistration) {
  const current = await withPushTimeout(registration.pushManager.getSubscription());
  if (current) return current;
  return withPushTimeout(registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapidKey()!),
  }));
}

export async function ensureWebPush() {
  if (!webPushAvailable()) throw Error("WEB_PUSH_UNAVAILABLE");
  await webPermission();
  const current = await requestWebSubscription(await readyWorker());
  await updateWebInstallation(
    localStorage.getItem("hm-news") === "true",
    current,
  );
}

export async function setWebDaily(enabled: boolean, time: string) {
  const installation = await webInstallation();
  await invokeInstallation({ action: "daily", ...installation, enabled, time });
}

export async function showTestWebNotification() {
  if (!webPushAvailable()) throw Error("WEB_PUSH_UNAVAILABLE");
  await webPermission();
  const registration = await readyWorker();
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
