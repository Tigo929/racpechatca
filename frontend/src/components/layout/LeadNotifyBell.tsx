import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { enableWebPush, pushSupported } from '../../utils/webpush';

/**
 * Кнопка «уведомления о заявках» в шапке.
 *
 * Браузер разрешает включить уведомления только по клику пользователя —
 * поэтому это кнопка, а не автоматический запрос. После «Разрешить» новые
 * заявки показываются системным уведомлением (см. useNewLeadNotifications),
 * пока открыта вкладка CRM.
 */
export function LeadNotifyBell() {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [perm, setPerm] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  );

  // Разрешение могли выдать/отозвать в другой вкладке — подхватываем при
  // возврате фокуса, чтобы иконка не врала.
  useEffect(() => {
    if (!supported) return;
    const sync = () => setPerm(Notification.permission);
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, [supported]);

  // Если разрешение уже выдано (например, включил уведомления ДО появления
  // Web Push) — тихо до-подписываем на пуш при загрузке, без повторного клика.
  // Иначе такой пользователь считал бы, что всё включено, а подписки нет.
  useEffect(() => {
    if (perm === 'granted' && pushSupported()) {
      enableWebPush().catch(() => {
        /* нет поддержки/сеть — уведомления в открытой вкладке всё равно есть */
      });
    }
  }, [perm]);

  if (!supported) return null;

  const request = async () => {
    if (perm === 'denied') {
      toast.error(
        'Уведомления запрещены в браузере — включите их для сайта в настройках',
      );
      return;
    }
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result !== 'granted') {
      toast('Уведомления не включены');
      return;
    }
    toast.success('Уведомления о заявках включены');
    // Пробный сигнал — сразу видно, что работает.
    try {
      new Notification('🔔 Уведомления включены', {
        body: 'Теперь новые заявки с сайта будут приходить сюда',
        tag: 'lead-notify-test',
      });
    } catch {
      /* пусто */
    }
    // Плюс подписка на Web Push — чтобы приходило и при закрытой вкладке. Если
    // не вышло (нет поддержки/сеть) — не страшно: пока вкладка открыта,
    // уведомления всё равно работают.
    if (pushSupported()) {
      try {
        await enableWebPush();
      } catch {
        toast('Фон включён частично: при закрытой вкладке может не прийти');
      }
    }
  };

  const granted = perm === 'granted';
  const Icon = granted ? BellRing : perm === 'denied' ? BellOff : Bell;

  return (
    <button
      onClick={request}
      aria-label={granted ? 'Уведомления о заявках включены' : 'Включить уведомления о заявках'}
      title={
        granted
          ? 'Уведомления о заявках включены'
          : perm === 'denied'
            ? 'Уведомления запрещены в браузере'
            : 'Включить уведомления о заявках'
      }
      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        granted
          ? 'text-amber-300 hover:text-amber-200 hover:bg-indigo-800'
          : 'text-indigo-300 hover:text-white hover:bg-indigo-800'
      }`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
