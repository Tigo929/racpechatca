import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Modal } from '../ui/Modal';
import { photosShortfall, pluralPhotos } from '../../utils/photos-shortfall';

/**
 * Недобор фотографий.
 *
 * Проверяется то, о чём просил владелец: когда файлов на сервере меньше,
 * чем фотографий в заказе, окно заявки красное целиком — мимо такого
 * не пройти. И обратное, не менее важное: в обычном заказе красного нет,
 * иначе на цвет перестанут смотреть.
 */

describe('правило недобора', () => {
  it('доехало меньше обещанного — недобор', () => {
    expect(photosShortfall({ photosExpected: 172, photosArrived: 84 })).toEqual({
      expected: 172,
      arrived: 84,
      missing: 88,
    });
  });

  it('всё доехало — тревожить незачем', () => {
    expect(photosShortfall({ photosExpected: 40, photosArrived: 40 })).toBeNull();
  });

  it('чисел нет — значит сверять нечего', () => {
    // Фотографии пришли мимо сайта: в переписке, ссылкой на облако.
    expect(photosShortfall({})).toBeNull();
  });

  it('менеджер подтвердил сбор — тревога снята', () => {
    expect(
      photosShortfall({
        photosExpected: 40,
        photosArrived: 12,
        photosResolvedAt: '2026-10-29T10:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('число склоняется по-русски', () => {
    // «не хватает 1 фотографий» читается как опечатка и подрывает доверие
    // ко всему сообщению.
    expect(pluralPhotos(1)).toBe('фотографии');
    expect(pluralPhotos(11)).toBe('фотографий');
    expect(pluralPhotos(21)).toBe('фотографии');
    expect(pluralPhotos(88)).toBe('фотографий');
  });
});

describe('окно заявки', () => {
  it('в тревоге окрашено целиком, а не одной строкой', () => {
    const { container } = render(
      <Modal open onClose={() => {}} title="Заявка" tone="alert">
        <p>тело</p>
      </Modal>,
    );
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.className).toContain('ring-red-500');
    expect(dialog.className).toContain('bg-red-50');
    expect(dialog.className).not.toContain('bg-white');
  });

  it('обычное окно остаётся белым', () => {
    const { container } = render(
      <Modal open onClose={() => {}} title="Заявка">
        <p>тело</p>
      </Modal>,
    );
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.className).toContain('bg-white');
    expect(dialog.className).not.toContain('ring-red-500');
  });

  it('заголовок называет причину, а не только цвет', () => {
    // Окно открывают и с телефона, и в чужих цветовых настройках:
    // на один лишь цвет полагаться нельзя.
    render(
      <Modal open onClose={() => {}} title="Заявка — не хватает фотографий" tone="alert">
        <p>тело</p>
      </Modal>,
    );
    expect(screen.getByText('Заявка — не хватает фотографий')).toBeInTheDocument();
  });
});
