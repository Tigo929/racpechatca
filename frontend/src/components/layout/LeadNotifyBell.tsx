import { useEffect, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  disableWebPush,
  enableWebPush,
  prepareWebPush,
  pushEnvironment,
  syncExistingPush,
  testWebPush,
} from "../../utils/webpush";
import { getErrorMessage } from "../../utils/get-error-message";

export function LeadNotifyBell() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const environment = pushEnvironment();

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  useEffect(() => {
    if (environment !== "ready") return;
    let alive = true;
    const sync = () => {
      void syncExistingPush()
        .then((value) => {
          if (alive) setEnabled(value);
        })
        .catch(() => {
          if (alive) {
            setEnabled(false);
            setError(
              "Не удалось подтвердить подписку. Нажмите «Включить уведомления» ещё раз.",
            );
          }
        });
    };
    void prepareWebPush().catch(() => {
      /* show errors on explicit enable */
    });
    sync();
    window.addEventListener("focus", sync);
    return () => {
      alive = false;
      window.removeEventListener("focus", sync);
    };
  }, [environment]);

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      const subscribed = await enableWebPush();
      setEnabled(subscribed);
      if (subscribed)
        toast.success(
          "Уведомления о новых заявках включены на этом устройстве",
        );
    } catch (e) {
      setEnabled(false);
      setError(getErrorMessage(e, "Не удалось включить уведомления"));
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    setError("");
    try {
      await disableWebPush();
      setEnabled(false);
    } catch (e) {
      setError(getErrorMessage(e, "Не удалось отключить уведомления"));
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true);
    setError("");
    try {
      await testWebPush();
      toast.success(
        "Пробное уведомление отправлено. Проверьте уведомления устройства.",
      );
    } catch (e) {
      setError(getErrorMessage(e, "Не удалось отправить пробное уведомление"));
    } finally {
      setBusy(false);
    }
  };
  const Icon = enabled ? BellRing : Bell;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Уведомления о заявках"
        title={
          enabled
            ? "Push-уведомления включены"
            : "Настроить уведомления о заявках"
        }
        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-indigo-800 ${enabled ? "text-amber-300" : "text-indigo-300"}`}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-push-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 text-gray-900 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="lead-push-title" className="font-semibold text-lg">
                Уведомления о заявках
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="p-2"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Получайте уведомления о новых заявках с сайта, даже когда CRM
              закрыта. Нажатие на уведомление откроет «Обращения».
            </p>
            {environment === "install-ios" ? (
              <div className="text-sm rounded-xl bg-indigo-50 p-3">
                На iPhone или iPad откройте CRM в Safari → «Поделиться» → «На
                экран Домой». Затем запустите CRM с этого значка и включите
                уведомления здесь. Нужна iOS/iPadOS 16.4 или новее.
              </div>
            ) : environment !== "ready" ? (
              <p className="text-sm text-amber-700">
                {environment === "insecure"
                  ? "Откройте CRM по защищённому адресу https://raspechatkaa.ru/crm/."
                  : "Этот браузер не поддерживает push-уведомления. Обновите браузер или систему устройства."}
              </p>
            ) : (
              <>
                <p
                  role="status"
                  className={`text-sm font-medium ${enabled ? "text-emerald-700" : "text-gray-600"}`}
                >
                  {enabled
                    ? "Включены на этом устройстве"
                    : "Не включены на этом устройстве"}
                </p>
                {typeof Notification !== "undefined" &&
                  Notification.permission === "denied" && (
                    <p className="text-sm text-amber-700">
                      Уведомления запрещены. Разрешите их для CRM в настройках
                      уведомлений устройства или в разрешениях сайта.
                    </p>
                  )}
                {enabled ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy}
                      onClick={() => void test()}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Пробное уведомление
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void disable()}
                      className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
                    >
                      Отключить
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => void enable()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {busy ? "Подключение…" : "Включить уведомления"}
                  </button>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Разрешение включается отдельно на каждом устройстве. На телефоне
              также проверьте настройки режима «Фокусирование».
            </p>
          </section>
        </div>
      )}
    </>
  );
}
