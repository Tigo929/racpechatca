import { TelegramStickerLinkService } from './telegram-sticker-link.service';

describe('TelegramStickerLinkService', () => {
  it('builds and validates a signed sticker URL', () => {
    const service = new TelegramStickerLinkService({
      get: jest.fn((key: string) =>
        ({
          PUBLIC_BASE_URL: 'https://crm.example.test/',
          TELEGRAM_WEBHOOK_SECRET: 'secret',
        })[key],
      ),
    } as never);

    const url = service.buildStickerUrl('order-1');

    expect(url).toMatch(
      /^https:\/\/crm\.example\.test\/telegram\/tshirt-orders\/order-1\/sticker\.pdf\?token=/,
    );
    const token = new URL(url!).searchParams.get('token');
    expect(service.isValid('order-1', token ?? '')).toBe(true);
    expect(service.isValid('order-2', token ?? '')).toBe(false);
    expect(service.isValid('order-1', 'bad-token')).toBe(false);
  });
});
