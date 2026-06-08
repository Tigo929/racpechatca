import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';
import { siteConfig } from '../../config/siteConfig';
import { productPages } from '../data/productPages';

/**
 * SEO-текстовый блок. Ключевые фразы вписаны естественно в осмысленный текст,
 * без переспама. Город берётся из siteConfig.
 */
export function SeoText() {
  const c = siteConfig.city;

  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Reveal>
          <article className="prose-custom">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-6">
              Как выбрать футболку с принтом
            </h2>

            <div className="space-y-4 text-slate-600 leading-relaxed text-[1.02rem]">
              <p>
                <strong className="text-slate-900">Печать на футболках в {c}</strong> — это
                простой способ создать вещь с личным смыслом или укрепить бренд компании.
                Прежде чем заказать <strong className="text-slate-900">футболку с принтом
                на заказ</strong>, определитесь с задачей: это подарок, элемент гардероба
                или корпоративный мерч. От этого зависят ткань, цвет и тип изображения.
              </p>
              <p>
                Если вы хотите <strong className="text-slate-900">футболку с фото</strong>,
                выбирайте чёткий снимок в хорошем разрешении — так принт получится
                детализированным и ярким. Для надписей и мемов важны читаемый шрифт и
                контраст с цветом ткани. Мы бесплатно проверим ваш макет и подскажем,
                как добиться лучшего результата.
              </p>
              <p>
                Компаниям, которым нужны <strong className="text-slate-900">футболки с
                логотипом компании</strong>, стоит заранее подготовить векторный логотип и
                фирменные цвета. Это гарантирует точное попадание в бренд. Мы печатаем{' '}
                <strong className="text-slate-900">корпоративный мерч</strong> любыми
                тиражами — от пробной партии до крупного заказа на мероприятие.
              </p>
              <p>
                Отдельная категория — <strong className="text-slate-900">подарок с
                индивидуальным принтом</strong>. Парные футболки, дизайн с важной датой,
                именем или внутренней шуткой превращают обычную вещь в личный,
                запоминающийся подарок. Поможем с идеей, доработаем макет и упакуем
                заказ, даже если времени почти не осталось.
              </p>
            </div>

            {/* Внутренняя перелинковка на SEO-страницы товаров */}
            <p className="mt-6 text-slate-600">
              Также заказывают:{' '}
              {productPages.map((p, i) => (
                <span key={p.slug}>
                  <Link to={`/${p.slug}`} className="text-indigo-700 font-medium hover:text-amber-700 underline-offset-2 hover:underline">
                    {p.title.toLowerCase()}
                  </Link>
                  {i < productPages.length - 1 ? ', ' : '.'}
                </span>
              ))}
            </p>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
