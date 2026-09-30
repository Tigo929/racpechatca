import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DtoDeleteOrder } from './dto/delete-order.dto';

/**
 * Причина удаления обязательна.
 *
 * Проверка стоит на входе, а не только в окне: окно можно обойти, а данные
 * собираются ради статистики — дыра в них обесценивает всю затею.
 */
describe('причина удаления заявки', () => {
  const check = async (reason: unknown) => {
    const dto = plainToInstance(DtoDeleteOrder, { reason });
    return validate(dto);
  };

  it('нормальная причина принимается', async () => {
    expect(await check('дубль заявки — клиент отправил дважды')).toHaveLength(
      0,
    );
  });

  it('пустая и короткая — нет', async () => {
    // «х» и пустая строка — это не причина, а способ обойти вопрос.
    for (const bad of ['', '  ', 'х', 'аб']) {
      expect((await check(bad)).length).toBeGreaterThan(0);
    }
  });

  it('не строка — нет', async () => {
    for (const bad of [undefined, null, 42, {}]) {
      expect((await check(bad)).length).toBeGreaterThan(0);
    }
  });

  it('слишком длинная — нет: это уже переписка, а не причина', async () => {
    expect((await check('я'.repeat(501))).length).toBeGreaterThan(0);
    expect(await check('я'.repeat(500))).toHaveLength(0);
  });
});
