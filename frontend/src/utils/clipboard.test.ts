import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyPendingText, copyToClipboard } from './clipboard';

/**
 * Копирование текста, который ещё едет с сервера.
 *
 * Из-за этого на iPhone не работала кнопка «Скопировать сообщение клиенту»:
 * Safari разрешает запись в буфер только внутри нажатия, а ожидание ответа
 * сервера это право тратит. Тест сторожит само лекарство — запись должна
 * начинаться ДО того, как текст загрузился.
 */

const original = {
  clipboard: Object.getOwnPropertyDescriptor(navigator, 'clipboard'),
  secure: Object.getOwnPropertyDescriptor(window, 'isSecureContext'),
};

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'isSecureContext', {
    value: true,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  if (original.clipboard) Object.defineProperty(navigator, 'clipboard', original.clipboard);
  if (original.secure) Object.defineProperty(window, 'isSecureContext', original.secure);
  Reflect.deleteProperty(globalThis, 'ClipboardItem');
  vi.restoreAllMocks();
});

describe('копирование загружаемого текста', () => {
  it('начинает запись в буфер до того, как текст загрузился', async () => {
    // Главное свойство: между нажатием и обращением к буферу нет ожидания.
    const write = vi.fn().mockResolvedValue(undefined);
    setClipboard({ write, writeText: vi.fn() });
    (globalThis as Record<string, unknown>).ClipboardItem = class {
      items: Record<string, unknown>;
      constructor(items: Record<string, unknown>) {
        this.items = items;
      }
    };

    let resolveText: (v: string) => void = () => {};
    const slow = new Promise<string>((r) => {
      resolveText = r;
    });

    const copying = copyPendingText(() => slow);
    // Текст ещё не пришёл, а запись уже заказана.
    expect(write).toHaveBeenCalledTimes(1);

    resolveText('Здравствуйте! Ваш заказ…');
    expect(await copying).toBe(true);
  });

  it('там, где обещания в буфер класть нельзя, текст сначала загружается', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    const ok = await copyPendingText(() => Promise.resolve('текст сообщения'));

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('текст сообщения');
  });

  it('упавшая загрузка не выдаётся за успешное копирование', async () => {
    // Менеджер должен увидеть ошибку, а не отправить клиенту пустоту.
    setClipboard({ writeText: vi.fn() });
    await expect(
      copyPendingText(() => Promise.reject(new Error('сервер недоступен'))),
    ).rejects.toThrow('сервер недоступен');
  });

  it('отказ буфера при живом обещании доводится до запасного пути', async () => {
    const write = vi.fn().mockRejectedValue(new Error('отказано'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ write, writeText });
    (globalThis as Record<string, unknown>).ClipboardItem = class {
      items: Record<string, unknown>;
      constructor(items: Record<string, unknown>) {
        this.items = items;
      }
    };

    const ok = await copyPendingText(() => Promise.resolve('текст'));

    expect(write).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('текст');
    expect(ok).toBe(true);
  });

  it('готовый текст копируется обычным способом', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    expect(await copyToClipboard('готовая строка')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('готовая строка');
  });

  it('пустой текст не считается скопированным', async () => {
    setClipboard({ writeText: vi.fn() });
    expect(await copyToClipboard('')).toBe(false);
  });
});
