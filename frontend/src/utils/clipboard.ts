/**
 * Копирование текста в буфер — одно на всю CRM.
 *
 * Копий было три: в карточке заказа, в кнопке приветствия и в контакте
 * клиента. Вели себя по-разному — одна умела запасной путь без защищённого
 * соединения, другая молча падала, третья не сообщала об ошибке вовсе.
 * Менеджер нажимал кнопку, видел «скопировано» и отправлял клиенту пустоту.
 *
 * Про iPhone отдельно. Менеджер копирует с телефона, а Safari на iOS
 * запасной путь через execCommand выполняет только если текст выделен
 * по-настоящему: textarea.select() там не выделяет ничего, если поле
 * помечено readOnly или не попало в вёрстку. Поэтому поле реально
 * вставляется в документ, выделяется через setSelectionRange, и только
 * потом копируется. Прокрутку это не дёргает: поле стоит в текущем
 * положении экрана и прозрачно.
 */

/** Запасной путь: работает там, где Clipboard API недоступен (iOS, http). */
function copyViaSelection(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  // Не readOnly: iOS отказывается выделять содержимое такого поля.
  area.setAttribute('readonly', '');
  area.removeAttribute('readonly');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  // Шрифт 16px: Safari на iPhone приближает экран к полю с мелким шрифтом.
  area.style.fontSize = '16px';
  document.body.appendChild(area);
  try {
    area.focus();
    area.select();
    // select() на iOS не выделяет — диапазон задаём явно.
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

/**
 * Скопировать текст. Возвращает false, если не вышло, — вызывающий обязан
 * сказать об этом человеку, а не делать вид, что всё хорошо.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Отказ разрешения или потерянный жест пользователя — пробуем запасной
      // путь, он в этих случаях часто ещё работает.
    }
  }
  return copyViaSelection(text);
}
