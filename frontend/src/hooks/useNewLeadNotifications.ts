import { useEffect, useRef } from 'react';

/**
 * Браузерное уведомление о новой заявке с сайта.
 *
 * Работает, пока открыта хотя бы одна вкладка CRM (в том числе в фоне —
 * счётчик заявок опрашивается фоном). Полностью закрытую вкладку это НЕ
 * покрывает: для неё нужен Web Push (service worker + подписка), это отдельная
 * задача. Здесь — простой и надёжный случай «сижу за ПК, CRM открыта».
 *
 * Логика: следим за числом входящих заявок. Первое значение после загрузки —
 * база (не шумим на уже накопленные заявки). Дальше рост числа = пришла новая
 * заявка → показываем уведомление. Клик по нему фокусирует окно и открывает
 * раздел «Обращения».
 */
export function useNewLeadNotifications(
  leadCount: number | undefined,
  enabled: boolean,
) {
  const baseline = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || leadCount == null) return;
    if (baseline.current == null) {
      baseline.current = leadCount;
      return;
    }
    if (leadCount > baseline.current) {
      const added = leadCount - baseline.current;
      notifyNewLead(added);
    }
    baseline.current = leadCount;
  }, [leadCount, enabled]);
}

function notifyNewLead(added: number) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const notification = new Notification('🖨 Новая заявка с сайта', {
      body:
        added > 1
          ? `Пришло ${added} новых заявок — их нужно обработать`
          : 'Пришла заявка — её нужно обработать',
      tag: 'new-site-lead', // одно уведомление, не плодим стопку
      requireInteraction: true, // висит, пока не кликнешь/закроешь
    });
    notification.onclick = () => {
      window.focus();
      // Ведём сразу в «Обращения».
      if (window.location.pathname !== '/crm/leads') {
        window.location.href = '/crm/leads';
      }
      notification.close();
    };
  } catch {
    // Некоторые браузеры кидают при создании Notification вне защищённого
    // контекста — молча пропускаем, счётчик в меню всё равно покажет заявку.
  }
}
