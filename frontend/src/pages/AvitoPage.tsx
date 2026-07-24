import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CheckCheck,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { avitoApi } from '../api/avito';
import { getErrorMessage } from '../utils/get-error-message';
import type { AvitoChat, AvitoMessage } from '../types/index';

function timeLabel(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return date.toLocaleString('ru-RU', {
    day: sameDay ? undefined : '2-digit',
    month: sameDay ? undefined : '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function messagePreview(chat: AvitoChat) {
  if (chat.lastMessageText) return chat.lastMessageText;
  if (chat.lastMessageType === 'image') return 'Изображение';
  if (chat.lastMessageType === 'voice') return 'Голосовое сообщение';
  if (chat.lastMessageType) return chat.lastMessageType;
  return 'Сообщений пока нет';
}

function messageText(message: AvitoMessage) {
  if (message.text) return message.text;
  if (message.type === 'image') return 'Изображение';
  if (message.type === 'voice') return 'Голосовое сообщение';
  if (message.type === 'deleted') return 'Сообщение удалено';
  return message.type;
}

function clientInitial(chat: AvitoChat) {
  return (chat.clientName?.trim()[0] || 'A').toUpperCase();
}

export default function AvitoPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const chatsQuery = useQuery({
    queryKey: ['avito', 'chats', unreadOnly],
    queryFn: () => avitoApi.getChats({ limit: 80, unreadOnly }),
    refetchInterval: 30_000,
  });

  const chats = chatsQuery.data ?? [];
  const selected = useMemo(
    () => chats.find((chat) => chat.avitoChatId === selectedId) ?? chats[0],
    [chats, selectedId],
  );

  useEffect(() => {
    if (!selectedId && chats[0]) setSelectedId(chats[0].avitoChatId);
  }, [chats, selectedId]);

  const messagesQuery = useQuery({
    queryKey: ['avito', 'messages', selected?.avitoChatId],
    queryFn: () => avitoApi.getMessages(selected!.avitoChatId, { limit: 100 }),
    enabled: !!selected,
    refetchInterval: 20_000,
  });

  const syncMutation = useMutation({
    mutationFn: () => avitoApi.sync(80),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['avito'] });
      toast.success(
        result.skipped
          ? 'Синхронизация уже идёт'
          : `Обновлено: ${result.chatsSynced ?? 0} чатов`,
      );
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'Не удалось синхронизировать Avito')),
  });

  const sendMutation = useMutation({
    mutationFn: () => avitoApi.sendMessage(selected!.avitoChatId, text.trim()),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({
        queryKey: ['avito', 'messages', selected?.avitoChatId],
      });
      void qc.invalidateQueries({ queryKey: ['avito', 'chats'] });
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'Не удалось отправить сообщение')),
  });

  const readMutation = useMutation({
    mutationFn: (chatId: string) => avitoApi.markRead(chatId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['avito'] });
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'Не удалось отметить чат прочитанным')),
  });

  const messages = messagesQuery.data ?? [];
  const unreadTotal = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!text.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }
    sendMutation.mutate();
  };

  return (
    <AppShell
      title="Avito"
      subtitle={
        chatsQuery.isLoading
          ? 'Загрузка диалогов'
          : unreadTotal > 0
            ? `${chats.length} диалогов · ${unreadTotal} непрочитано`
            : `${chats.length} диалогов`
      }
      onRefresh={() => syncMutation.mutate()}
      actions={
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-1.5 px-3.5 min-h-[44px] bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <RefreshCw size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Синхронизировать</span>
        </button>
      }
    >
      <div className="grid min-h-[calc(100vh-170px)] grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="min-h-0 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2.5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">Диалоги</h2>
              <p className="text-xs text-gray-500">Авито мессенджер</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              Новые
            </label>
          </div>

          <div className="max-h-[420px] overflow-y-auto lg:max-h-[calc(100vh-235px)]">
            {chatsQuery.isLoading ? (
              <p className="py-12 text-center text-sm text-gray-400">
                Загрузка...
              </p>
            ) : chats.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <MessageCircle
                  size={26}
                  className="mx-auto text-gray-300"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm text-gray-500">Диалогов пока нет.</p>
                <button
                  onClick={() => syncMutation.mutate()}
                  className="mt-3 text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                  Проверить Avito
                </button>
              </div>
            ) : (
              chats.map((chat) => {
                const active = selected?.avitoChatId === chat.avitoChatId;
                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedId(chat.avitoChatId)}
                    className={`flex w-full gap-3 border-b border-gray-100 px-3 py-3 text-left transition-colors ${
                      active ? 'bg-amber-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">
                      {chat.clientAvatarUrl ? (
                        <img
                          src={chat.clientAvatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        clientInitial(chat)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {chat.clientName || 'Клиент Avito'}
                        </p>
                        <span className="ml-auto flex-shrink-0 text-[11px] text-gray-400">
                          {timeLabel(chat.lastMessageAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {chat.lastDirection === 'OUT' ? 'Вы: ' : ''}
                        {messagePreview(chat)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="truncate text-[11px] text-gray-400">
                          {chat.itemTitle || 'Без объявления'}
                        </span>
                        {chat.unreadCount > 0 && (
                          <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[11px] font-bold leading-4 text-white">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="min-h-0 rounded-lg border border-gray-200 bg-white">
          {selected ? (
            <div className="flex h-full min-h-[560px] flex-col">
              <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">
                  {selected.clientAvatarUrl ? (
                    <img
                      src={selected.clientAvatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    clientInitial(selected)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-gray-900">
                    {selected.clientName || 'Клиент Avito'}
                  </h2>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    {selected.itemTitle && (
                      <span className="truncate">{selected.itemTitle}</span>
                    )}
                    {selected.itemPrice && <span>{selected.itemPrice}</span>}
                    {selected.itemUrl && (
                      <a
                        href={selected.itemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:text-indigo-900"
                      >
                        Объявление <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
                {selected.unreadCount > 0 && (
                  <button
                    onClick={() => readMutation.mutate(selected.avitoChatId)}
                    disabled={readMutation.isPending}
                    title="Отметить прочитанным"
                    aria-label="Отметить прочитанным"
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
                  >
                    <CheckCheck size={18} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-4 sm:px-5">
                {messagesQuery.isLoading ? (
                  <p className="py-12 text-center text-sm text-gray-400">
                    Загрузка сообщений...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="py-12 text-center text-sm text-gray-400">
                    История пустая.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((message) => {
                      const mine = message.direction === 'OUT';
                      return (
                        <div
                          key={message.id}
                          className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                              mine
                                ? 'bg-indigo-700 text-white'
                                : 'border border-gray-200 bg-white text-gray-900'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {messageText(message)}
                            </p>
                            <div
                              className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
                                mine ? 'text-indigo-200' : 'text-gray-400'
                              }`}
                            >
                              {message.sentBy?.username && (
                                <span>{message.sentBy.username}</span>
                              )}
                              <span>{timeLabel(message.sentAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <form
                onSubmit={submit}
                className="border-t border-gray-100 bg-white p-3"
              >
                <div className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="Написать клиенту..."
                    className="min-h-[52px] flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={sendMutation.isPending || !text.trim()}
                    title="Отправить"
                    aria-label="Отправить сообщение"
                    className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <Send size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-1 text-right text-[11px] text-gray-400">
                  {text.length}/1000
                </div>
              </form>
            </div>
          ) : (
            <div className="flex min-h-[560px] items-center justify-center px-6 text-center">
              <div>
                <MessageCircle
                  size={30}
                  className="mx-auto text-gray-300"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Выберите диалог слева.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
