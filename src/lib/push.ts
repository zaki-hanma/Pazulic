// Push-Benachrichtigungen (Erinnerungen). Der Server schickt sie zur richtigen Zeit.
import { supabase } from "./supabase";

export const VAPID_PUBLIC = "BMS5MfWhmuUOy9WU_FUeAPz5yapMNoFnOzCmXDLY1RxMZQuWuRjDaLOd-xXgO0hxFAPW8iTJ9iNDh00KyMFQq2U";

export const REMIND_OPTIONS: { v: number; t: string }[] = [
  { v: -1, t: "keine" }, { v: 0, t: "zum Start" }, { v: 5, t: "5 Min. vorher" }, { v: 10, t: "10 Min. vorher" },
  { v: 15, t: "15 Min. vorher" }, { v: 30, t: "30 Min. vorher" }, { v: 60, t: "1 Std. vorher" }, { v: 120, t: "2 Std. vorher" }, { v: 1440, t: "1 Tag vorher" },
];
export const DEFAULT_REMIND: Record<string, number> = { lernen: 5, wiederholung: 5, unterwegs: -1, arbeit: -1, _other: 30, _google: 30 };
export const remindText = (v: number) => REMIND_OPTIONS.find((o) => o.v === v)?.t ?? `${v} Min. vorher`;

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function urlB64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registration() {
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("./sw.js"));
  await navigator.serviceWorker.ready;
  return reg;
}

export async function pushStatus(): Promise<"unsupported" | "denied" | "on" | "off"> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch { return "off"; }
}

export async function enablePush(): Promise<{ ok: boolean; msg?: string }> {
  if (!pushSupported()) return { ok: false, msg: "Dieser Browser kann keine Benachrichtigungen. Auf dem Handy: Pazulic in Chrome öffnen und „App installieren“." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, msg: "Du hast Benachrichtigungen nicht erlaubt. Erlaube sie in den Browser- bzw. Handy-Einstellungen für Pazulic." };
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) });
  const j = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, msg: "Speichern hat nicht geklappt. Bitte nochmal versuchen." };
  return { ok: true };
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) { await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
}

export async function testPush(): Promise<{ ok: boolean; devices: number }> {
  const { data, error } = await supabase.functions.invoke("send-reminders", { method: "POST", body: { test: true } });
  if (error) return { ok: false, devices: 0 };
  return { ok: (data?.sent ?? 0) > 0, devices: data?.devices ?? 0 };
}
