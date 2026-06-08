import { siteConfig } from '../../config/siteConfig';
import { tshirtPhotos } from '../../assets/portfolio';

export interface PortfolioItem {
  id: string;
  src?: string;
  alt: string;
  caption: string;
  color: string;
  ink: string;
}

const c = siteConfig.city;

export const portfolioItems: PortfolioItem[] = [
  {
    id: '1',
    src: tshirtPhotos.photo1,
    caption: 'Живой принт — носишь с гордостью',
    alt: `Мужчина в футболке с принтом Adventure у озера — печать в ${c}`,
    color: '#0F172A', ink: '#D97706',
  },
  {
    id: '2',
    src: tshirtPhotos.photo4,
    caption: 'Парные футболки — один смысл на двоих',
    alt: `Пара в одинаковых футболках с принтом — парные футболки в ${c}`,
    color: '#0F172A', ink: '#D97706',
  },
  {
    id: '3',
    src: tshirtPhotos.photo2,
    caption: 'Готовый заказ — чётко и насыщенно',
    alt: `Футболка с принтом — флэтлей, качество печати в ${c}`,
    color: '#0F172A', ink: '#D97706',
  },
  {
    id: '4',
    src: tshirtPhotos.photo5,
    caption: 'Принт крупным планом',
    alt: `Принт Adventure Awaits крупным планом — детализация печати в ${c}`,
    color: '#0F172A', ink: '#D97706',
  },
  {
    id: '5',
    src: tshirtPhotos.photo3,
    caption: 'Качество ткани — мягко и плотно',
    alt: `Текстура ткани футболки крупным планом — качество в ${c}`,
    color: '#0F172A', ink: '#FFFFFF',
  },
  {
    id: '6',
    caption: 'Корпоративный мерч для команды',
    alt: `Команда в брендированных футболках — корпоративный мерч в ${c}`,
    color: '#312E81', ink: '#FFFFFF',
  },
];
