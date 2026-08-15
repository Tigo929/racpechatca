import { Logger } from '@nestjs/common';
import { ProxyAgent, type Dispatcher } from 'undici';

/**
 * Запросы к Telegram — через прокси, если он задан.
 *
 * С боевого сервера api.telegram.org недоступен: 443-й порт не открывается
 * ни по одному из адресов Telegram, при этом Авито, Яндекс и GHCR с той же
 * машины отвечают. Это фильтрация на пути, а не наша сеть, и починить её
 * со стороны кода нельзя — можно только выйти наружу через посредника.
 *
 * Прокси включается переменной TELEGRAM_PROXY_URL и распространяется ТОЛЬКО
 * на Telegram: остальные интеграции ходят напрямую, им посредник не нужен и
 * лишний узел на пути — лишняя точка отказа.
 *
 * Формат: http://user:pass@host:port (подойдёт и обычный HTTP-прокси —
 * к HTTPS-адресам он применяется методом CONNECT, трафик остаётся
 * зашифрованным между нами и Telegram, посредник видит только адрес).
 *
 * Переменная не задана — работаем как раньше, напрямую. Так код одинаково
 * живёт и в разработке, и на сервере, и после снятия блокировки.
 */

const logger = new Logger('TelegramFetch');

let cached: { url: string; dispatcher: Dispatcher } | null = null;
let warnedAboutBadUrl = false;

function proxyDispatcher(): Dispatcher | undefined {
  const url = process.env.TELEGRAM_PROXY_URL?.trim();
  if (!url) return undefined;

  if (cached?.url === url) return cached.dispatcher;

  try {
    const dispatcher = new ProxyAgent(url);
    cached = { url, dispatcher };
    // Адрес не логируем целиком: в нём логин и пароль от прокси.
    logger.log(`Telegram ходит через прокси ${new URL(url).host}`);
    warnedAboutBadUrl = false;
    return dispatcher;
  } catch {
    // Кривой адрес не должен ронять отправку: лучше попробовать напрямую
    // (вдруг блокировку сняли), чем не отправить вообще ничего.
    if (!warnedAboutBadUrl) {
      warnedAboutBadUrl = true;
      logger.error('TELEGRAM_PROXY_URL задан, но не разбирается как адрес — иду напрямую');
    }
    return undefined;
  }
}

/** fetch к api.telegram.org: тот же интерфейс, но с учётом прокси. */
export function telegramFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const dispatcher = proxyDispatcher();
  // dispatcher — расширение undici поверх стандартного RequestInit, поэтому
  // типов в lib.dom для него нет; без прокси ключ вообще не добавляется.
  return dispatcher
    ? fetch(url, { ...init, dispatcher } as RequestInit)
    : fetch(url, init);
}

/** Только для тестов: сбросить запомненный прокси между случаями. */
export function resetTelegramProxyCache(): void {
  cached = null;
  warnedAboutBadUrl = false;
}
