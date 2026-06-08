import { useEffect, useRef, useState } from 'react';
import { X, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { useOrderModal } from './OrderModalContext';
import { siteConfig } from '../../config/siteConfig';

interface FormState {
  name: string;
  phone: string;
  telegram: string;
  description: string;
  file: File | null;
}

const EMPTY: FormState = { name: '', phone: '', telegram: '', description: '', file: null };

/**
 * Премиальная модалка расчёта заказа. Сейчас — mock submit.
 * Точка интеграции помечена ниже: сюда подключается CRM API / Telegram Bot /
 * Email / WhatsApp без изменения остальной разметки.
 *
 * Обёртка монтирует внутренний компонент только когда модалка открыта —
 * благодаря этому форма каждый раз создаётся заново и подхватывает preset
 * через инициализатор useState, без синхронного setState в эффекте.
 */
export function OrderModal() {
  const { open } = useOrderModal();
  if (!open) return null;
  return <OrderModalInner />;
}

function OrderModalInner() {
  const { closeModal, preset, design } = useOrderModal();
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, description: preset }));
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc для закрытия + блокировка скролла body
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [closeModal]);

  const set = (k: keyof FormState, v: string | File | null) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    // ── ТОЧКА ИНТЕГРАЦИИ ───────────────────────────────────────────
    // Сейчас mock. Позже заменить на реальную отправку. Полезная нагрузка:
    //   const payload = {
    //     ...form,                         // имя, телефон, telegram, описание, файл
    //     design,                          // превью PNG (dataURL), цвет, transform
    //   };
    //   const data = new FormData();
    //   data.append('name', form.name); ...
    //   if (design?.previewDataUrl) data.append('preview', design.previewDataUrl);
    //   if (design) data.append('design', JSON.stringify({
    //     shirtColor: design.shirtColor, shirtColorName: design.shirtColorName,
    //     transform: design.transform, hasArtwork: design.hasArtwork,
    //   }));
    //   await fetch(`${API_URL}/order-photo/lead`, { method: 'POST', body: data });
    // или Telegram Bot API / Email / WhatsApp.
    await new Promise((r) => setTimeout(r, 900));
    // ───────────────────────────────────────────────────────────────

    setStatus('done');
  };

  return (
    <div
      className="modal-overlay fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4"
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <div
        ref={dialogRef}
        className="modal-card relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка модалки */}
        <div className="sticky top-0 bg-white/95 backdrop-blur px-6 pt-6 pb-3 rounded-t-3xl flex items-start justify-between z-10">
          <div>
            <h2 id="order-modal-title" className="text-xl font-bold text-slate-900">
              {status === 'done' ? 'Заявка отправлена' : 'Рассчитать заказ'}
            </h2>
            {status !== 'done' && (
              <p className="text-sm text-slate-500 mt-1">
                Ответим и согласуем цену и срок до начала работы
              </p>
            )}
          </div>
          <button
            onClick={closeModal}
            aria-label="Закрыть"
            className="p-2 -mr-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === 'done' ? (
          <div className="px-6 pb-8 pt-2 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <p className="text-slate-700 text-lg font-medium">
              Спасибо! Мы получили заявку и свяжемся с вами.
            </p>
            <button
              onClick={closeModal}
              className="mt-6 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
            >
              Готово
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 pb-8 pt-2 space-y-4">
            {/* Превью из конструктора */}
            {design?.previewDataUrl && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <img
                  src={design.previewDataUrl}
                  alt="Превью собранной футболки"
                  className="w-16 h-[4.5rem] object-contain rounded-lg bg-white shrink-0"
                />
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">Ваш макет из конструктора</div>
                  <div className="text-slate-500 text-xs mt-0.5">
                    Футболка: {design.shirtColorName}
                    {design.hasArtwork ? ' · макет прикреплён' : ' · без макета'}
                  </div>
                </div>
              </div>
            )}

            <Field label="Имя" required>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Как к вам обращаться"
                className="inp"
              />
            </Field>

            <Field label="Телефон" required>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+7 ___ ___-__-__"
                className="inp"
              />
            </Field>

            <Field label="Telegram (необязательно)">
              <input
                type="text"
                value={form.telegram}
                onChange={(e) => set('telegram', e.target.value)}
                placeholder="@username"
                className="inp"
              />
            </Field>

            <Field label="Описание заказа">
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Что хотите напечатать: фото, надпись, логотип, тираж…"
                rows={3}
                className="inp resize-none"
              />
            </Field>

            {/* Загрузка макета */}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,.ai,.psd,.cdr"
                className="hidden"
                onChange={(e) => set('file', e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-amber-500 hover:text-amber-700 hover:bg-amber-50/50 transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span className="font-medium truncate">
                  {form.file ? form.file.name : 'Загрузить макет'}
                </span>
              </button>
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-base shadow-lg shadow-amber-600/30 transition-colors disabled:opacity-70"
            >
              {status === 'sending' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Отправляем…
                </>
              ) : (
                'Отправить заявку'
              )}
            </button>

            <p className="text-xs text-center text-slate-400">
              Нажимая кнопку, вы соглашаетесь на обработку данных.
              Можно написать напрямую: {siteConfig.phone}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-amber-600">*</span>}
      </span>
      {children}
    </label>
  );
}
