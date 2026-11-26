import { addressWords } from './ozon-points.service';

describe('addressWords', () => {
  it('убирает служебные слова из присланного адреса', () => {
    expect(addressWords('г. Москва, ул. Ленина, д. 5')).toEqual([
      'москва',
      'ленина',
      '5',
    ]);
  });
  it('оставляет номер пункта и дробь дома', () => {
    expect(addressWords('ПВЗ Ozon: Сиреневый бульвар 4/1')).toEqual([
      'сиреневый',
      'бульвар',
      '4/1',
    ]);
    expect(addressWords('56-27')).toEqual(['56-27']);
  });
  it('пустой ввод — пусто', () => {
    expect(addressWords('  , . ')).toEqual([]);
  });
});
