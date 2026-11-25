import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Copy, Share2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { copyToClipboard } from "../../utils/clipboard";

/**
 * Запасной путь, когда скопировать текст клиенту не вышло.
 *
 * На телефоне буфер иногда не даётся: в приложении с главного экрана,
 * в старом Safari, без разрешения. Раньше менеджер видел «не удалось» —
 * и всё: текст клиенту было не взять. Теперь открывается окно с самим
 * текстом — он уже выделен, держи пальцем и копируй, — и кнопка
 * «Поделиться», которая на телефоне открывает системное меню отправки
 * прямо в Telegram, MAX или WhatsApp: копировать вообще не нужно.
 */
export function ClientTextFallback({
  text,
  title,
  onClose,
}: {
  text: string;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    // Есть «Поделиться» — поле не трогаем: фокус открыл бы клавиатуру
    // на телефоне и закрыл половину окна.
    if (canShare) return;
    const t = setTimeout(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(0, text.length);
    }, 50);
    return () => clearTimeout(t);
  }, [text, canShare]);

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          {canShare
            ? "Нажмите «Поделиться» и выберите мессенджер клиента — или скопируйте текст вручную."
            : "Текст выделен — скопируйте его вручную (долгое нажатие → «Скопировать»)."}
        </p>
        <textarea
          ref={ref}
          value={text}
          readOnly={false}
          onChange={() => undefined}
          rows={10}
          // 16px: иначе iPhone приближает экран к полю.
          className="w-full rounded-lg border border-gray-200 p-3 text-base leading-relaxed text-gray-800"
        />
        <div className="flex flex-wrap gap-2">
          {canShare && (
            <button
              type="button"
              autoFocus
              onClick={() => {
                navigator
                  .share({ text })
                  .then(onClose)
                  .catch(() => undefined);
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Share2 size={16} aria-hidden="true" /> Поделиться
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              if (await copyToClipboard(text)) {
                toast.success("Скопировано");
                onClose();
              } else {
                ref.current?.focus();
                ref.current?.setSelectionRange(0, text.length);
                toast("Выделите текст и скопируйте вручную", { icon: "✋" });
              }
            }}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            <Copy size={16} aria-hidden="true" /> Скопировать
          </button>
        </div>
      </div>
    </Modal>
  );
}
