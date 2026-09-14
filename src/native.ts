import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { Preferences } from "@capacitor/preferences";
import { db } from "./api";
import { safeTarget } from "./domain";
export const native = Capacitor.isNativePlatform();
const WidgetData = registerPlugin<{
  save(options: { json: string }): Promise<void>;
}>("WidgetData");
export async function syncWidgetPlan(plan: unknown) {
  if (native) await WidgetData.save({ json: JSON.stringify(plan) });
}
export async function getPermissions() {
  if (!native) return "Na webu nedostupné";
  const [l, p] = await Promise.all([
    LocalNotifications.checkPermissions(),
    PushNotifications.checkPermissions(),
  ]);
  return `Denní: ${l.display}; novinky: ${p.receive}`;
}
export async function setDailyReminder(enabled: boolean, time: string) {
  if (!native) throw Error("NATIVE_REQUIRED");
  if (!/^\d{2}:\d{2}$/.test(time)) throw Error("INVALID_TIME");
  await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
  if (!enabled) return;
  const p = await LocalNotifications.requestPermissions();
  if (p.display !== "granted") throw Error("PERMISSION_DENIED");
  const [hour, minute] = time.split(":").map(Number);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1,
        title: "Honzíkova moudra",
        body: "Dnešní moudro na tebe čeká",
        schedule: { on: { hour, minute }, repeats: true },
        extra: { path: "/denni" },
      },
    ],
  });
}
async function installation() {
  const saved = await Preferences.get({ key: "hm-installation" });
  if (saved.value)
    return JSON.parse(saved.value) as { id: string; credential: string };
  if (!db) throw Error("BACKEND_REQUIRED");
  const { data, error } = await db.functions.invoke("hm-installation", {
    body: { action: "register" },
  });
  if (error) throw error;
  await Preferences.set({
    key: "hm-installation",
    value: JSON.stringify(data),
  });
  return data as { id: string; credential: string };
}
async function updateEndpoint(enabled: boolean, token?: string) {
  const auth = await installation();
  const { error } = await db!.functions.invoke("hm-installation", {
    body: {
      action: "update",
      ...auth,
      enabled,
      token,
      permission: (await PushNotifications.checkPermissions()).receive,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  if (error) throw error;
}
export async function setNewQuotes(enabled: boolean) {
  if (!native) throw Error("NATIVE_REQUIRED");
  if (enabled) {
    const p = await PushNotifications.requestPermissions();
    if (p.receive !== "granted") throw Error("PERMISSION_DENIED");
    await updateEndpoint(true);
    await PushNotifications.register();
  } else await updateEndpoint(false);
}
export function initNative(navigate: (path: string) => void) {
  if (!native) return () => {};
  const handles: Promise<{ remove: () => Promise<void> }>[] = [];
  const origin = import.meta.env.VITE_SITE_URL || location.origin;
  const open = async (url: string) => {
    const path = safeTarget(url, origin);
    if (!path) return;
    const incoming = new URL(url);
    const code = incoming.searchParams.get("code");
    if (path.startsWith("/auth/callback") && code && db) {
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (error) {
        navigate("/prihlaseni?chyba=odkaz");
        return;
      }
    }
    navigate(path);
  };
  handles.push(
    App.addListener("appUrlOpen", (e) => {
      void open(e.url);
    }),
  );
  void App.getLaunchUrl().then((v) => {
    if (v) void open(v.url);
  });
  handles.push(
    LocalNotifications.addListener("localNotificationActionPerformed", () =>
      navigate("/denni"),
    ),
  );
  handles.push(
    PushNotifications.addListener("pushNotificationActionPerformed", (e) => {
      const path = e.notification.data?.path;
      if (typeof path === "string") void open(new URL(path, origin).href);
    }),
  );
  handles.push(
    PushNotifications.addListener("registration", (t) => {
      void updateEndpoint(
        localStorage.getItem("hm-news") === "true",
        t.value,
      ).catch(() => {
        console.warn("Push endpoint registration failed");
      });
    }),
  );
  handles.push(
    App.addListener("appStateChange", (s) => {
      if (s.isActive && localStorage.getItem("hm-news") === "true")
        void PushNotifications.checkPermissions().then((p) =>
          p.receive === "granted"
            ? PushNotifications.register()
            : updateEndpoint(false),
        );
    }),
  );
  return () => {
    handles.forEach(async (h) => (await h).remove());
  };
}
