import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./api", () => ({ db: { functions: { invoke } } }));
import { ensureWebPush, setWebPush, webPushAvailable } from "./pwa";

describe("PWA notification setup", () => {
  let permission: { permission: string; requestPermission: ReturnType<typeof vi.fn> };
  let worker: { ready: Promise<unknown> };
  let getSubscription: ReturnType<typeof vi.fn>;
  let subscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "AQID");
    permission = { permission: "default", requestPermission: vi.fn(async () => "granted") };
    const subscription = { toJSON: () => ({ endpoint: "https://push.example/test" }) };
    getSubscription = vi.fn(async () => subscription);
    subscribe = vi.fn(async () => subscription);
    worker = { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) };
    vi.stubGlobal("Notification", permission);
    vi.stubGlobal("window", { PushManager: {}, Notification: permission });
    vi.stubGlobal("navigator", { serviceWorker: worker });
    const storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    invoke.mockReset().mockResolvedValue({ data: { id: "installation", credential: "credential" }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([setWebPush.bind(null, true), ensureWebPush])("requests permission synchronously from the tap before waiting for the worker", async (enable) => {
    const result = enable();
    expect(permission.requestPermission).toHaveBeenCalledOnce();
    expect(getSubscription).not.toHaveBeenCalled();
    await result;
    expect(subscribe).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalled();
  });

  it("releases settings when the worker never becomes ready", async () => {
    vi.useFakeTimers();
    permission.permission = "granted";
    worker.ready = new Promise(() => {});
    const result = expect(ensureWebPush()).rejects.toThrow("SERVICE_WORKER_TIMEOUT");
    await vi.advanceTimersByTimeAsync(20000);
    await result;
    expect(invoke).not.toHaveBeenCalled();
  });

  it("can disable news without waiting for a worker or asking for permission", async () => {
    worker.ready = new Promise(() => {});
    await setWebPush(false);
    expect(permission.requestPermission).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenLastCalledWith("hm-installation", expect.objectContaining({ body: expect.objectContaining({ enabled: false }) }));
  });

  it("rejects denied permission without re-prompting", async () => {
    permission.permission = "denied";
    await expect(ensureWebPush()).rejects.toThrow("PERMISSION_DENIED");
    expect(permission.requestPermission).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("requires service worker support", () => {
    vi.stubGlobal("navigator", {});
    expect(webPushAvailable()).toBe(false);
  });
});
