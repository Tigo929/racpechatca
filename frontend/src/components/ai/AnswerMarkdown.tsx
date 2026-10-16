import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Ответ агента как текст, а не как исходник.
 *
 * Модель отвечает разметкой: заголовки, списки, таблицы, пути к файлам в
 * обратных кавычках. Пока мы показывали это как есть, человек читал
 * «**Выручка (P&L) 31 день** | 264 685 ₽ |» и сам разбирал, где здесь
 * число. Таблица из десяти строк превращалась в стену палок.
 *
 * Разметку разбираем, но HTML из ответа НЕ выполняем: текст приходит от
 * модели, а она пересказывает в том числе чужие данные — примечания
 * клиентов, названия товаров. Это ровно тот случай, когда «просто
 * вставить как html» однажды вставляет чужой скрипт.
 */
export function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="mt-3 text-base font-semibold text-gray-900 first:mt-0">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="mt-3 text-base font-semibold text-gray-900 first:mt-0">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-3 text-sm font-semibold text-gray-900 first:mt-0">{children}</h4>
          ),
          p: ({ children }) => <p className="text-gray-800">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5 text-gray-800">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5 text-gray-800">{children}</ol>
          ),
          li: ({ children }) => <li className="marker:text-gray-400">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
            >
              {children}
            </a>
          ),
          /*
            Путь к файлу и имя поля — то, чем агент доказывает ответ.
            Моноширинным и с подложкой: их выделяют и копируют.
          */
          code: ({ className, children }) => {
            const block = (className ?? '').includes('language-');
            if (block) {
              return (
                <code className="block overflow-x-auto rounded-lg bg-gray-900 p-3 font-mono text-[12px] leading-relaxed text-gray-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[12px] text-gray-800">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-200 pl-3 text-gray-600">
              {children}
            </blockquote>
          ),
          /*
            Таблицы агент любит и строит их часто — именно в них он
            сводит деньги. Горизонтальная прокрутка своя: на телефоне
            широкая таблица иначе растягивает весь экран.
          */
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-gray-200 px-2.5 py-1.5 text-left font-semibold text-gray-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-2.5 py-1.5 align-top text-gray-800 tabular-nums">
              {children}
            </td>
          ),
          hr: () => <hr className="my-3 border-gray-200" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
