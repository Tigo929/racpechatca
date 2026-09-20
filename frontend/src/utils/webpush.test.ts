import { vi } from "vitest";
import { pushApi } from "../api/push";

vi.mock("../api/push", () => ({
  pushApi: {
    vapidKey: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    test: vi.fn(),
  },
}));

async function setup(permission: NotificationPermission = "default") {
  vi.resetModules();
  const subscription = {
    endpoint: "https://web.push.apple.com/test",
    toJSON: () => ({ endpoint: "test", keys: {} }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const registration = {
    active: { scriptURL: "https://crm.test/order-photo-push/sw.js" },
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    },
  };
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", {
    permission,
    requestPermission: vi.fn().mockResolvedValue("granted"),
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(registration),
      getRegistrations: vi.fn().mockResolvedValue([registration]),
      get ready() {
        throw new Error("Must not wait on an unrelated worker scope");
      },
    },
  });
  vi.mocked(pushApi.vapidKey).mockResolvedValue("BA".repeat(43));
  vi.mocked(pushApi.subscribe).mockResolvedValue(undefined);
  return { utils: await import("./webpush"), registration, subscription };
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

it("asks permission before any asynchronous registration/key lookup, then registers the CRM scope", async () => {
  const { utils } = await setup();
  const result = utils.enableWebPush();
  expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
  expect(pushApi.vapidKey).not.toHaveBeenCalled();
  expect(await result).toBe(true);
  expect(navigator.serviceWorker.register).toHaveBeenCalledWith(
    "/order-photo-push/sw.js",
    { scope: "/crm/", updateViaCache: "none" },
  );
  expect(pushApi.subscribe).toHaveBeenCalledTimes(1);
});
it("does not report success when CRM rejects the subscription", async () => {
  const { utils } = await setup();
  vi.mocked(pushApi.subscribe).mockRejectedValue(new Error("offline"));
  await expect(utils.enableWebPush()).rejects.toThrow("offline");
});
it("does not subscribe after a denied permission", async () => {
  const { utils, registration } = await setup();
  vi.mocked(Notification.requestPermission).mockResolvedValue("denied");
  await expect(utils.enableWebPush()).rejects.toThrow("Разрешите");
  expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
});
it("does not silently re-enable a device which was explicitly unsubscribed", async () => {
  const { utils, registration } = await setup("granted");
  expect(await utils.syncExistingPush()).toBe(false);
  expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
});
it("unsubscribes on the device even when the CRM request fails", async () => {
  const { utils, registration, subscription } = await setup("granted");
  registration.pushManager.getSubscription.mockResolvedValue(subscription);
  vi.mocked(pushApi.unsubscribe).mockRejectedValue(new Error("offline"));
  await utils.disableWebPush();
  expect(subscription.unsubscribe).toHaveBeenCalled();
});
it("shows installation instructions for iPhone Safari outside the home-screen app", async () => {
  const { utils } = await setup();
  const ua = navigator.userAgent;
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: "iPhone Safari",
  });
  expect(utils.pushEnvironment()).toBe("install-ios");
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: ua,
  });
});
