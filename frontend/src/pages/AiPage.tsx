import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Loader2, Send, Wrench } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { aiApi, type AiAnswer } from '../api/ai';
import { getErrorMessage } from '../utils/get-error-message';

/**
 * Разговор с ИИ-агентом.
 *
 * Агент видит две вещи: базу CRM (только чтение) и код обоих проектов —
 * CRM и сайта. Поэтому у него можно спросить не только «сколько заказов»,
 * но и «почему заказ не переходит в Отправлен»: ответ он берёт из того
 * самого кода, по которому система и работает.
 *
 * История разговора живёт на сервере, здесь — только её номер. Браузеру
 * незачем возить с собой ответы инструментов на десятки тысяч знаков.
 */

interface Line {
  role: 'you' | 'agent';
  text: string;
  tools?: string[];
}

const EXAMPLES = [
  'Сколько заказов зависло больше трёх дней и у кого?',
  'Почему заказ нельзя перевести в «Отправлен» без исполнителя?',
  'Где на сайте считается сумма заказа фотопечати?',
  'Какая выручка за последние 7 дней и что на неё повлияло?',
];

export function AiPage() {
  const [lines, setLines] = useState<Line[]>([]);
  const [question, setQuestion] = useState('');
  const [session, setSession] = useState<string | undefined>();
  const bottom = useRef<HTMLDivElement>(null);

  const health = useQuery({
    queryKey: ['ai', 'health'],
    queryFn: aiApi.health,
    staleTime: 60_000,
  });

  const ask = useMutation({
    mutationFn: (text: string) => aiApi.ask(text, session),
    onSuccess: (answer: AiAnswer) => {
      setSession(answer.session);
      setLines((prev) => [
        ...prev,
        { role: 'agent', text: answer.answer, tools: answer.tools },
      ]);
    },
    onError: (error) => {
      setLines((prev) => [
        ...prev,
        { role: 'agent', text: `Не получилось: ${getErrorMessage(error)}` },
      ]);
    },
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, ask.isPending]);

  function send(text: string) {
    const clean = text.trim();
    if (!clean || ask.isPending) return;
    setLines((prev) => [...prev, { role: 'you', text: clean }]);
    setQuestion('');
    ask.mutate(clean);
  }

  const offline = health.data?.status && health.data.status !== 'ok';

  return (
    <AppShell
      title="ИИ-агент"
      width="narrow"
      /* Что он сейчас видит — важнее названия модели: по этой строке сразу
         понятно, почему он вдруг отвечает «не нашёл». */
      subtitle={
        health.isLoading
          ? 'проверяю подключение…'
          : offline
            ? 'агент недоступен'
            : `${health.data?.tools ?? 0} инструментов: база CRM и код проектов`
      }
    >
      <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-3xl flex-col">

        <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4">
          {lines.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Спросите о заказах, деньгах, рекламе — или о том, как устроена
                сама система: агент читает код CRM и сайта и отвечает со
                ссылкой на файл и строку.
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => send(example)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-left text-xs text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-700"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lines.map((line, index) => (
            <article
              key={index}
              className={
                line.role === 'you'
                  ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white'
                  : 'max-w-[92%] rounded-2xl rounded-bl-sm bg-gray-50 px-4 py-3 text-sm text-gray-800'
              }
            >
              <p className="whitespace-pre-wrap break-words">{line.text}</p>
              {line.tools && line.tools.length > 0 && (
                /* Чем пользовался агент — это и есть проверяемость ответа. */
                <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
                  <Wrench size={10} />
                  {[...new Set(line.tools)].join(', ')}
                </p>
              )}
            </article>
          ))}

          {ask.isPending && (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" /> читаю данные и код…
            </p>
          )}
          <div ref={bottom} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(question);
          }}
          className="mt-3 flex items-end gap-2"
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              // Enter отправляет, Shift+Enter — перенос строки: вопрос обычно
              // в одну строку, и лишнее нажатие на кнопку здесь раздражает.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(question);
              }
            }}
            rows={2}
            placeholder="Спросите что-нибудь о заказах, деньгах или о коде системы"
            className="min-h-[52px] flex-1 resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={ask.isPending || !question.trim()}
            className="inline-flex h-[52px] items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {ask.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Спросить
          </button>
        </form>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
          <CornerDownLeft size={10} /> Enter — отправить, Shift+Enter — новая строка.
          Агент только читает: изменить заказ или отправить сообщение он не может.
        </p>
      </div>
    </AppShell>
  );
}
