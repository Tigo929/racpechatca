import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Upload, Wand2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PRINT_TEMPLATES } from './templates';
import { PrintDesignerEngine } from './engine';

/** Пресеты масштаба экспорта: шаблон мелкий (только viewBox), для печати ×N. */
const EXPORT_SCALES = [
  { value: 5, label: '×5' },
  { value: 8, label: '×8 (реком.)' },
  { value: 10, label: '×10' },
  { value: 1, label: '×1 (как шаблон)' },
];

const COLORS = ['#e26d5c', '#3d7ea6', '#5c9e6b', '#c9a227', '#8e6bb0', '#4aa3a3'];

export default function PrintDesignerPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PrintDesignerEngine | null>(null);
  const [templateId, setTemplateId] = useState(PRINT_TEMPLATES[0]?.id ?? '');
  const [slotCount, setSlotCount] = useState(0);
  const [active, setActive] = useState(0);
  const [filled, setFilled] = useState<boolean[]>([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [exportScale, setExportScale] = useState(8);
  const [busy, setBusy] = useState(false);

  const template = PRINT_TEMPLATES.find((t) => t.id === templateId);

  // Пересоздаём движок при смене шаблона.
  useEffect(() => {
    if (!hostRef.current || !template) return;
    const engine = new PrintDesignerEngine(
      hostRef.current,
      { viewBox: template.viewBox, paths: template.paths },
      { onSelect: (i) => setActive(i) },
    );
    engineRef.current = engine;
    setSlotCount(engine.slotCount);
    setFilled(new Array(engine.slotCount).fill(false));
    setActive(0);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [template]);

  const pickPhoto = (i: number, file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      engineRef.current?.setImage(i, String(reader.result));
      setFilled((f) => {
        const next = [...f];
        next[i] = true;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const doExport = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (filled.some((f) => !f)) {
      toast.error('Заполните все буквы фото перед экспортом');
      return;
    }
    setBusy(true);
    try {
      const blob = await engine.toBlob(exportScale);
      const ord = orderNumber.trim() || 'order';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ozon-${ord}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success('PNG сохранён');
    } catch {
      toast.error('Не удалось собрать PNG');
    } finally {
      setBusy(false);
    }
  };

  const exportW = template ? Math.round(template.viewBox[0] * exportScale) : 0;
  const exportH = template ? Math.round(template.viewBox[1] * exportScale) : 0;

  return (
    <AppShell
      title="Дизайнер принта"
      subtitle="Фото в буквы шаблона → PNG для печати (DTF, прозрачный фон)"
      width="wide"
      actions={
        <button
          onClick={doExport}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60"
        >
          <Download size={14} /> {busy ? 'Собираю…' : 'Скачать PNG'}
        </button>
      }
    >
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Холст */}
        <div className="flex-1 min-w-0">
          <div
            className="rounded-xl overflow-hidden border border-gray-200"
            // Шахматка — чтобы прозрачный фон DTF был виден в редакторе.
            style={{
              backgroundColor: '#e9e9e9',
              backgroundImage:
                'linear-gradient(45deg,#cfcfcf 25%,transparent 25%),linear-gradient(-45deg,#cfcfcf 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#cfcfcf 75%),linear-gradient(-45deg,transparent 75%,#cfcfcf 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
            }}
          >
            <div ref={hostRef} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Клик по букве — выбрать. Тащи внутри буквы — двигать фото. Колёсико —
            приблизить/отдалить. Прозрачные области (фон и «дырки» букв) в печать
            уйдут прозрачными.
          </p>
        </div>

        {/* Панель */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {PRINT_TEMPLATES.length > 1 && (
            <div>
              <label className="text-xs text-gray-500">Шаблон</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {PRINT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">Номер заказа Ozon</label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="напр. 19549334-0128"
              className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Идёт в имя файла (Ozon-№.png) и в ТЗ. На картинке номера нет.
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500">Размер экспорта</label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {EXPORT_SCALES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setExportScale(s.value)}
                  className={`px-2.5 py-1 text-xs rounded-lg border ${
                    exportScale === s.value
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Пропорция шаблона. Сейчас: {exportW}×{exportH} px.
            </p>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Буквы (слева-направо)</div>
            <div className="space-y-2">
              {Array.from({ length: slotCount }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => {
                    engineRef.current?.setActive(i);
                  }}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                    active === i
                      ? 'border-amber-500 bg-amber-50/60'
                      : 'border-gray-200'
                  }`}
                >
                  <span
                    className="w-7 h-7 rounded-md grid place-items-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 text-sm">
                    Буква {i + 1}
                    <span
                      className={`block text-[11px] ${filled[i] ? 'text-emerald-600' : 'text-gray-400'}`}
                    >
                      {filled[i] ? 'фото загружено' : 'нет фото'}
                    </span>
                  </div>
                  <label
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Upload size={12} />
                    {filled[i] ? 'Заменить' : 'Фото'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        pickPhoto(i, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-[11px] text-gray-500 flex gap-2">
            <Wand2 size={14} className="shrink-0 mt-0.5 text-gray-400" />
            Модуль на тесте. Дальше подключим к заказу: статус «Разработка макета»
            и отправку готового PNG в согласование.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
