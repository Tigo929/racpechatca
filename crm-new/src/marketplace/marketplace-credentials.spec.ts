import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from 'src/prisma/prisma.service';
import { MarketplaceAccountService } from './marketplace-account.service';
import { encryptSecret } from './secret-box';
import type { OzonService } from './ozon/ozon.service';

/**
 * Ключ кабинета, зашифрованный другим мастер-секретом.
 *
 * Ключи Ozon шифруются MARKETPLACE_SECRET, а если его не завели — JWT_SECRET.
 * Поэтому смена JWT_SECRET (например после утечки) без заданного
 * MARKETPLACE_SECRET делает все сохранённые ключи нечитаемыми, и раздел
 * маркетплейсов перестаёт отдавать данные.
 *
 * Сама поломка неизбежна — секрет действительно другой. Проверяем, что о ней
 * говорят словами: раньше наружу уходила ошибка AES в виде 500 без текста, и
 * отличить это от любой другой поломки было нельзя.
 */

function makeService(storedSecret: string, currentSecret: string) {
  const row = {
    id: 'acc-1',
    marketplace: 'OZON',
    title: 'Основной магазин',
    externalId: 'client-123',
    apiKeySecret: encryptSecret('ozon-api-key', storedSecret),
    apiKeyHint: '…-key',
  };
  const prisma = {
    marketplaceAccount: {
      findUnique: jest.fn().mockResolvedValue(row),
    },
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'MARKETPLACE_SECRET' ? '' : currentSecret,
    ),
  };
  return new MarketplaceAccountService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    {} as unknown as OzonService,
  );
}

it('тем же секретом ключ читается', async () => {
  const service = makeService('секрет-один', 'секрет-один');

  await expect(service.credentials('acc-1')).resolves.toEqual({
    clientId: 'client-123',
    apiKey: 'ozon-api-key',
  });
});

it('другим секретом — внятный отказ, а не голая ошибка шифрования', async () => {
  const service = makeService('старый-jwt-секрет', 'новый-jwt-секрет');

  await expect(service.credentials('acc-1')).rejects.toBeInstanceOf(
    ConflictException,
  );
});

it('в отказе есть и название кабинета, и что делать', async () => {
  // Сообщение читает владелец, а не разработчик: ему нужно понять, какой
  // кабинет сломался и что ключ надо ввести заново.
  const service = makeService('старый-jwt-секрет', 'новый-jwt-секрет');

  await expect(service.credentials('acc-1')).rejects.toThrow(
    /Основной магазин/,
  );
  await expect(service.credentials('acc-1')).rejects.toThrow(/заново/);
});

it('сам ключ в сообщение не попадает', async () => {
  // Отказ видит интерфейс и пишется в lastCheckError — секрету там не место.
  const service = makeService('старый-jwt-секрет', 'новый-jwt-секрет');

  await expect(service.credentials('acc-1')).rejects.not.toThrow(
    /ozon-api-key/,
  );
});
