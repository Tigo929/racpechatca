import { Send } from 'lucide-react';
import { telegramUrl } from '../../config/siteConfig';

/** Фиксированная Telegram-кнопка в правом нижнем углу для быстрого контакта. */
export function TelegramFab() {
  return (
    <a
      href={telegramUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Написать в Telegram"
      className="fab hidden sm:flex fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#229ED9] hover:bg-[#1b8ec2] items-center justify-center shadow-2xl shadow-sky-900/30"
    >
      <Send className="w-6 h-6 text-white -translate-x-0.5 translate-y-0.5" />
    </a>
  );
}
