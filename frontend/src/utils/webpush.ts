import { pushApi } from "../api/push";

export const SW_URL = "/order-photo-push/sw.js";
export const SW_SCOPE = "/crm/";
export type PushEnvironment =
  | "ready"
  | "install-ios"
  | "insecure"
  | "unsupported";
let prepared:
  | Promise<{ registration: ServiceWorkerRegistration; key: string }>
  | undefined;
let generation = 0;

export function pushEnvironment(): PushEnvironment {
  if (!window.isSecureContext) return "insecure";
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (ios && !standalone) return "install-ios";
  return "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
    ? "ready"
    : "unsupported";
}
export function pushSupported() {
  return pushEnvironment() === "ready";
}

function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function activeRegistration(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  if (registration.active) return Promise.resolve(registration);
  return new Promise((resolve, reject) => {
    const worker = registration.installing || registration.waiting;
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Не удалось запустить уведомления. Обновите CRM и повторите.",
        ),
      );
    }, 15000);
    const cleanup = () => {
      clearTimeout(timeout);
      worker?.removeEventListener("statechange", check);
    };
    const check = () => {
      if (registration.active || worker?.state === "activated") {
        cleanup();
        resolve(registration);
      } else if (worker?.state === "redundant") {
        cleanup();
        reject(
          new Error("Не удалось обновить уведомления. Перезагрузите CRM."),
        );
      }
    };
    worker?.addEventListener("statechange", check);
    check();
  });
}

export function prepareWebPush() {
  if (!prepared) {
    prepared = Promise.all([
      navigator.serviceWorker
        .register(SW_URL, { scope: SW_SCOPE, updateViaCache: "none" })
        .then(activeRegistration),
      pushApi.vapidKey(),
    ])
      .then(([registration, key]) => ({ registration, key }))
      .catch((error) => {
        prepared = undefined;
        throw error;
      });
  }
  return prepared;
}

/** Must be called directly from a click: Safari requires a user gesture here. */
export async function enableWebPush(): Promise<boolean> {
  if (!pushSupported())
    throw new Error(
      "Откройте CRM с главного экрана или в поддерживаемом браузере",
    );
  const currentGeneration = generation;
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      permission === "denied"
        ? "Разрешите уведомления для CRM в настройках устройства или браузера"
        : "Разрешение на уведомления не получено",
    );
  const { registration, key } = await prepareWebPush();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationKey(key),
    });
  if (currentGeneration !== generation) {
    await subscription.unsubscribe();
    return false;
  }
  await pushApi.subscribe(subscription.toJSON());
  return true;
}

/** Refresh binding after login; never requests permission or creates a subscription. */
export async function syncExistingPush(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const currentGeneration = generation;
  const { registration } = await prepareWebPush();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription || currentGeneration !== generation) return false;
  await pushApi.subscribe(subscription.toJSON());
  return true;
}

export async function disableWebPush(): Promise<void> {
  generation++;
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const script =
      registration.active?.scriptURL ||
      registration.waiting?.scriptURL ||
      registration.installing?.scriptURL;
    if (!script || new URL(script).pathname !== SW_URL) continue;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Unsubscribe locally even when CRM is unreachable (important on logout).
      const local = await subscription.unsubscribe();
      try {
        await pushApi.unsubscribe(subscription.endpoint);
      } catch (error) {
        if (!local) throw error;
      }
    }
  }
}

export async function testWebPush() {
  const { registration } = await prepareWebPush();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) throw new Error("Сначала включите уведомления");
  await pushApi.test(subscription.endpoint);
}
