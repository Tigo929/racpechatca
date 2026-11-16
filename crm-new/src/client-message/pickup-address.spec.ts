import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePickupAddress } from './business';

/**
 * Адрес самовывоза в сообщении клиенту.
 *
 * Клиент едет по тому адресу, который мы написали. Ошибка здесь стоит
 * человеку поездки через весь город, а нам — заказа: разбираться он
 * будет уже стоя у чужого подъезда.
 *
 * По фотозаказам забирают у исполнителя, и адрес зависит от того, кто
 * заказ ведёт. Логины в базе заведены по-разному, поэтому правило
 * сверяет части имени, а не строку целиком.
 */

const photo = (username?: string) => ({
  productCategory: 'PHOTO',
  executor: username ? { username } : null,
});

describe('адрес самовывоза по исполнителю', () => {
  it('у Тиграна Гуляна — Сиреневый бульвар', () => {
    // В базе исполнитель заведён одним словом — «Tigran».
    const address = 'Сиреневый бульвар, 4/1, подъезд 1';
    expect(resolvePickupAddress(photo('Tigran'))).toBe(address);
    expect(resolvePickupAddress(photo('tigran'))).toBe(address);
    expect(resolvePickupAddress(photo('Гулян Тигран Саакович'))).toBe(address);
    expect(resolvePickupAddress(photo('Tigran_Gulyan'))).toBe(address);
  });

  it('у Максима Кузьмина — прежний Измайловский 7к2', () => {
    // Новое правило не должно перехватывать чужие заказы.
    const address = 'Измайловский проезд, 7к2, подъезд 1';
    expect(resolvePickupAddress(photo('Maxim_Kuzmin'))).toBe(address);
    expect(resolvePickupAddress(photo('Самогов'))).toBe(address);
    expect(resolvePickupAddress(photo('максим'))).toBe(address);
  });

  it('без исполнителя адрес не выдумываем', () => {
    /*
      Раньше в этом случае подставлялся общий адрес, и клиент ехал
      не туда. Пока заказ не взят в работу, адреса ещё нет.
    */
    expect(resolvePickupAddress(photo())).toBeNull();
    expect(resolvePickupAddress(photo('Alexey_Semenov'))).toBeNull();
  });

  it('холст забирают у подрядчика независимо от исполнителя', () => {
    expect(
      resolvePickupAddress({
        productCategory: 'CANVAS',
        executor: { username: 'Tigran' },
      }),
    ).toBe('Балашиха, улица Поповка, 7');
  });

  it('футболки у исполнителя с личным адресом едут к нему', () => {
    // Личный адрес исполнителя важнее адреса направления: заказ лежит
    // там, где его собрали.
    expect(
      resolvePickupAddress({
        productCategory: 'TSHIRT',
        executor: { username: 'Tigran' },
      }),
    ).toBe('Сиреневый бульвар, 4/1, подъезд 1');
  });
});

describe('копия правил во фронтенде', () => {
  it('совпадает с серверной', () => {
    /*
      Файл с реквизитами живёт в двух местах: сервер собирает текст для
      автоматической отправки, браузер — для кнопки «скопировать». Копии
      уже расходились, и клиент получал разные адреса в зависимости от
      того, как менеджер отправил сообщение.

      Сверяем сами правила — адреса и наборы частей имени. Остальной файл
      в сравнение не берём: там код отформатирован под разную ширину
      строки, и падение на переносе строки научило бы только одному —
      отключать проверку.
    */
    const cut = (text: string) =>
      text
        .slice(
          text.indexOf('const izmailovskySevenPickupAddress'),
          text.indexOf('Логин к сравнимому виду'),
        )
        .replace(/\s+/g, ' ')
        .trim();

    const backend = cut(
      readFileSync(join(__dirname, 'business.ts'), 'utf8'),
    );
    const frontend = cut(
      readFileSync(
        join(__dirname, '../../../frontend/src/config/business.ts'),
        'utf8',
      ),
    );
    expect(frontend).toBe(backend);
  });
});
