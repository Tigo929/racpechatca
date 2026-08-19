import { Logger } from '@nestjs/common';
import {
  fetch as undiciFetch,
  FormData as UndiciFormData,
  ProxyAgent,
  type Dispatcher,
} from 'undici';

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

/**
 * fetch к api.telegram.org: тот же интерфейс, но с учётом прокси.
 *
 * Зовём fetch из самого undici, а не встроенный в Node. Первая причина
 * нашлась на боевом сервере: агент создаётся установленным undici (8.x), а
 * глобальный fetch собран на версии, вшитой в Node, — интерфейс обработчика
 * запроса у них разошёлся, и передача «чужого» dispatcher роняла каждый
 * запрос с «invalid onRequestStart method». Бот молчал так же, как при
 * блокировке.
 *
 * Вторая причина — и она же ответ на вопрос, почему здесь нет развилки
 * «без прокси идём штатным fetch». Тело запроса собирается заранее, а какой
 * fetch его повезёт, решалось потом. Для multipart это смертельно: каждая
 * сборка undici узнаёт только свою FormData, чужую она молча приводит к
 * строке. Файл превращался в семнадцать байт текста «[object FormData]» —
 * Telegram отвечал «there is no document in the request», а мы показывали
 * «Telegram не принял ТЗ-файл». Текстовые сообщения при этом ходили: они
 * уходят обычным JSON.
 *
 * Поэтому путь один на всех: одна сборка undici и её же FormData ниже.
 * Развилка возвращаться не должна — она и создала расхождение.
 */
export function telegramFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const dispatcher = proxyDispatcher();
  // У undici свои типы Request/Response — по составу они совпадают с
  // глобальными в той части, которой пользуется код бота (ok, json, text).
  return undiciFetch(url, {
    ...init,
    ...(dispatcher ? { dispatcher } : {}),
  } as never) as unknown as Promise<Response>;
}

/**
 * FormData для запросов к Telegram — обязательно эта, а не глобальная.
 *
 * Тело multipart собирает та же сборка undici, что и отправляет: только свою
 * FormData она разбирает на части, чужую приводит к строке и файл теряет.
 * Blob можно брать глобальный — его undici принимает по составу, а не по
 * происхождению.
 */
export function telegramFormData(): FormData {
  return new UndiciFormData() as unknown as FormData;
}

/** Только для тестов: сбросить запомненный прокси между случаями. */
export function resetTelegramProxyCache(): void {
  cached = null;
  warnedAboutBadUrl = false;
}
