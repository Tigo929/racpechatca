/** Раздел следующего этапа: честно говорим, что здесь будет. */
export function SoonTab({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
      <h3 className="text-sm font-semibold text-gray-900">Следующий этап</h3>
      <p className="mt-2 text-xs text-gray-500 max-w-lg mx-auto">{text}</p>
    </div>
  );
}
