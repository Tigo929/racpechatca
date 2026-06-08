/**
 * Контент лендинга. Тексты вынесены отдельно от разметки, чтобы их легко
 * редактировать и переиспользовать на будущих SEO-страницах.
 */
import type { ComponentType } from 'react';
import {
  Camera,
  Type as TypeIcon,
  Building2,
  Users,
  Briefcase,
  Package,
  ShieldCheck,
  Sparkles,
  Clock,
  Image as ImageIcon,
  Gift,
  Layers,
} from 'lucide-react';

export interface TrustItem {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}

export const trustItems: TrustItem[] = [
  { icon: Layers, title: 'От 1 штуки', text: 'Печатаем и одну футболку, и крупный тираж' },
  { icon: Sparkles, title: 'Помощь с макетом', text: 'Подскажем и доведём ваш дизайн до печати' },
  { icon: ShieldCheck, title: 'Износостойкая печать', text: 'Принт держится при стирке и носке' },
  { icon: Clock, title: 'Быстрая выдача', text: 'Срочные заказы — в приоритете' },
  { icon: ImageIcon, title: 'Фото перед выдачей', text: 'Показываем результат до того, как вы заберёте' },
  { icon: Gift, title: 'Подарочная упаковка', text: 'Аккуратно упакуем, если это подарок' },
];

export interface GiftCard {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}

export const giftCards: GiftCard[] = [
  { icon: Gift, title: 'Парню / девушке', text: 'Фото вашего момента, дата встречи или внутренняя шутка' },
  { icon: Users, title: 'Другу', text: 'Мем, цитата или дружеский прикол, который поймёт только он' },
  { icon: Sparkles, title: 'Для пары', text: 'Парные футболки с общим смыслом и дизайном' },
  { icon: Gift, title: 'На день рождения', text: 'Имя, возраст, поздравление — личный подарок за минуты' },
  { icon: Users, title: 'Для команды', text: 'Единый стиль для компании друзей или спортивной команды' },
];

export interface BusinessCard {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}

export const businessCards: BusinessCard[] = [
  { icon: Building2, title: 'Футболки с логотипом', text: 'Брендированная одежда в фирменных цветах компании' },
  { icon: Briefcase, title: 'Форма для сотрудников', text: 'Единый узнаваемый стиль для команды и сервиса' },
  { icon: Package, title: 'Мерч для мероприятий', text: 'Промо-одежда для конференций, выставок и акций' },
  { icon: Layers, title: 'Тиражи любого объёма', text: 'От пробной партии до крупного корпоративного заказа' },
];

export interface CatalogItem {
  slug: string;
  /** SEO-friendly заголовок карточки */
  title: string;
  description: string;
  /** Цена-заглушка */
  priceFrom: number;
  icon: ComponentType<{ className?: string }>;
  /** Цвет акцента превью футболки */
  previewColor: string;
}

export const catalogItems: CatalogItem[] = [
  {
    slug: 'futbolka-s-foto',
    title: 'Футболки с принтом на заказ',
    description: 'Фото, рисунок, надпись — любое нанесение от 1 штуки',
    priceFrom: 990,
    icon: Camera,
    previewColor: '#1E1B4B',
  },
  {
    slug: 'futbolka-s-nadpisyu',
    title: 'Футболка с надписью',
    description: 'Любая фраза, цитата, имя или мем — печатаем любой текст',
    priceFrom: 790,
    icon: TypeIcon,
    previewColor: '#0F172A',
  },
  {
    slug: 'futbolki-s-logotipom',
    title: 'Футболки с логотипом компании',
    description: 'Корпоративные футболки в фирменных цветах, любой тираж',
    priceFrom: 690,
    icon: Building2,
    previewColor: '#312E81',
  },
  {
    slug: 'parnye-futbolki',
    title: 'Парные футболки на заказ',
    description: 'Комплект с общим принтом для пары, друзей или команды',
    priceFrom: 1490,
    icon: Users,
    previewColor: '#4338CA',
  },
  {
    slug: 'korporativnyy-merch',
    title: 'Корпоративный мерч',
    description: 'Брендированная одежда под ключ — от дизайна до выдачи',
    priceFrom: 590,
    icon: Package,
    previewColor: '#D97706',
  },
];

export interface Step {
  n: number;
  title: string;
  text: string;
}

export const orderSteps: Step[] = [
  { n: 1, title: 'Оставьте заявку', text: 'Выберите футболку или пришлите свою идею и макет' },
  { n: 2, title: 'Проверим макет', text: 'Оценим качество изображения и подскажем, как улучшить' },
  { n: 3, title: 'Согласуем цену и срок', text: 'Зафиксируем стоимость и дату готовности до начала работы' },
  { n: 4, title: 'Напечатаем', text: 'Аккуратно нанесём принт износостойким методом печати' },
  { n: 5, title: 'Вы получите заказ', text: 'Покажем фото результата и подготовим к выдаче' },
];

export interface Review {
  name: string;
  role: string;
  text: string;
  rating: number;
}

/** Placeholder-отзывы — заменить реальными */
export const reviews: Review[] = [
  {
    name: 'Анна К.',
    role: 'Подарок другу',
    text: 'Заказывала футболку с нашей общей фотографией в подарок. Сделали быстро, качество печати отличное, фото перед выдачей очень успокоило. Друг в восторге!',
    rating: 5,
  },
  {
    name: 'Дмитрий М.',
    role: 'Корпоративный заказ',
    text: 'Нужна была партия футболок с логотипом для конференции. Помогли с макетом, уложились в срок, цвета попали в брендбук идеально. Будем заказывать ещё.',
    rating: 5,
  },
  {
    name: 'Екатерина С.',
    role: 'Парные футболки',
    text: 'Делали парные футболки на годовщину. Дизайн помогли доработать, упаковали как подарок. Очень довольны, принт после стирки как новый.',
    rating: 5,
  },
  {
    name: 'Игорь В.',
    role: 'Футболка с надписью',
    text: 'Срочно нужна была футболка с надписью на день рождения. Сделали в тот же день, выглядит дорого. Спасибо за оперативность!',
    rating: 5,
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

export const faqItems: FaqItem[] = [
  {
    q: 'Можно заказать одну футболку?',
    a: 'Да, мы печатаем от 1 штуки. Минимального тиража нет — вы можете заказать как единичную футболку в подарок, так и крупную партию для компании.',
  },
  {
    q: 'Помогаете ли вы с макетом?',
    a: 'Конечно. Подскажем, подходит ли ваше изображение для печати, поможем с расположением принта и при необходимости доработаем макет вместе с вами.',
  },
  {
    q: 'Сколько занимает изготовление?',
    a: 'Сроки зависят от тиража и загрузки. Единичные заказы часто готовы в день обращения, тиражи — по согласованию. Точный срок назовём до начала работы.',
  },
  {
    q: 'Можно ли заказать футболки для компании?',
    a: 'Да, мы делаем корпоративный мерч: футболки с логотипом, форму для сотрудников и промо-одежду для мероприятий. Тиражи — от пробной партии до крупных.',
  },
  {
    q: 'Какие изображения подходят для печати?',
    a: 'Лучше всего подходят чёткие изображения в хорошем разрешении. Пришлите файл — мы бесплатно проверим качество и скажем, как добиться лучшего результата.',
  },
  {
    q: 'Можно ли сделать подарок в упаковке?',
    a: 'Да, аккуратно упакуем заказ для подарка. Также перед выдачей показываем фото готовой футболки, чтобы вы были уверены в результате.',
  },
];

/** Структура будущих SEO-страниц услуг */
export interface FuturePage {
  path: string;
  title: string;
}

export const futurePages: FuturePage[] = [
  { path: '/futbolki-v-podarok', title: 'Футболки в подарок' },
  { path: '/futbolki-dlya-biznesa', title: 'Футболки для бизнеса' },
  { path: '/futbolki-s-logotipom', title: 'Футболки с логотипом' },
  { path: '/futbolki-s-foto', title: 'Футболки с фото' },
  { path: '/korporativnyy-merch', title: 'Корпоративный мерч' },
  { path: '/kontakty', title: 'Контакты' },
];

/** Доступные цвета футболок для конструктора */
export interface ShirtColor {
  name: string;
  hex: string;
  /** Цвет принта/текста, читаемый на этом фоне */
  ink: string;
}

export const shirtColors: ShirtColor[] = [
  { name: 'Белая', hex: '#FFFFFF', ink: '#1E1B4B' },
  { name: 'Чёрная', hex: '#0F172A', ink: '#FFFFFF' },
  { name: 'Индиго', hex: '#312E81', ink: '#FFFFFF' },
  { name: 'Песочная', hex: '#E7DFD2', ink: '#1E1B4B' },
  { name: 'Янтарная', hex: '#D97706', ink: '#FFFFFF' },
  { name: 'Графит', hex: '#475569', ink: '#FFFFFF' },
];
