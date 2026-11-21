import { canSendPromo, contactStats, extractContact } from './client-contact';
import { saveClientContact } from './client-contact.service';

const siteLead = {
  communicationPlatform: 'MAX',
  urlCommunication: 'https://max.ru/+79161234567',
  clientTelegram: null,
  sourceOrder: 'WEBSITE',
  note: '🆕 Заявка с сайта\nИмя: Анна\nТелефон: 8 (916) 123-45-67\nEmail: Anna@Mail.ru',
};

describe('контакт из заказа', () => {
  it('заявка с сайта: имя, телефон, почта из примечания', () => {
    const c = extractContact(siteLead)!;
    expect(c.name).toBe('Анна');
    expect(c.phone).toBe('+79161234567');
    expect(c.email).toBe('anna@mail.ru');
    expect(c.identityKey).toBe('max:79161234567');
  });

  it('Telegram опознаётся по нику, с @ и без', () => {
    const a = extractContact({
      communicationPlatform: 'TELEGRAM',
      urlCommunication: '@Anna_Photo',
      sourceOrder: 'LOCAL',
    });
    const b = extractContact({
      communicationPlatform: 'AVITO',
      urlCommunication: 'https://avito.ru/x',
      clientTelegram: 'https://t.me/anna_photo',
      sourceOrder: 'AVITO',
    });
    expect(a!.identityKey).toBe('tg:anna_photo');
    expect(b!.identityKey).toBe('tg:anna_photo');
  });

  it('только телефон — опознаётся по телефону', () => {
    const c = extractContact({
      communicationPlatform: 'OZON',
      urlCommunication: '',
      sourceOrder: 'WEBSITE',
      note: 'Телефон: +7 999 000-11-22',
    });
    expect(c!.identityKey).toBe('phone:79990001122');
  });

  it('покупатель Ozon только с чатом площадки — не контакт', () => {
    expect(
      extractContact({
        communicationPlatform: 'OZON',
        urlCommunication: 'https://seller.ozon.ru/chat/123',
        sourceOrder: 'OZON',
      }),
    ).toBeNull();
  });

  it('статистика: покупки — только доведённые и не удалённые', () => {
    const d = new Date();
    const s = contactStats([
      {
        status: 'PAID',
        productCategory: 'PHOTO',
        totalOrder: 500,
        orderCreatedAt: d,
        deleted: false,
      },
      {
        status: 'LEAD',
        productCategory: 'CANVAS',
        totalOrder: 3000,
        orderCreatedAt: d,
        deleted: true,
      },
      {
        status: 'SENT',
        productCategory: 'PHOTO',
        totalOrder: 700,
        orderCreatedAt: d,
        deleted: false,
      },
    ]);
    expect(s).toEqual({
      ordersCount: 3,
      purchasesCount: 2,
      purchasedTotal: 1200,
      categories: ['CANVAS', 'PHOTO'],
      deletedCount: 1,
    });
  });

  it('акции — только с согласием и без отписки', () => {
    expect(
      canSendPromo({ marketingConsent: false, unsubscribedAt: null }),
    ).toBe(false);
    expect(
      canSendPromo({ marketingConsent: true, unsubscribedAt: new Date() }),
    ).toBe(false);
    expect(canSendPromo({ marketingConsent: true, unsubscribedAt: null })).toBe(
      true,
    );
  });
});

describe('запись контакта', () => {
  function fakeDb() {
    const contacts = new Map<string, any>();
    const links = new Map<string, any>();
    return {
      contacts,
      links,
      clientContact: {
        findUnique: async ({ where }: any) =>
          contacts.get(where.identityKey) ?? null,
        upsert: async ({ where, create, update }: any) => {
          const old = contacts.get(where.identityKey);
          const row = old
            ? { ...old, ...update }
            : { id: `c${contacts.size + 1}`, ...create };
          contacts.set(where.identityKey, row);
          return { id: row.id };
        },
      },
      clientContactOrder: {
        upsert: async ({ where, create, update }: any) => {
          links.set(
            where.orderId,
            links.has(where.orderId)
              ? { ...links.get(where.orderId), ...update }
              : create,
          );
        },
      },
    };
  }
  const base = {
    numberOrder: '20261121-001',
    status: 'LEAD',
    sourceOrder: 'WEBSITE',
    productCategory: 'PHOTO',
    totalOrder: 400,
  };

  it('второй заказ того же человека не затирает телефон и не плодит контакт', async () => {
    const db = fakeDb();
    await saveClientContact(db as any, {
      ...base,
      id: 'o1',
      createdAt: new Date('2026-10-01'),
      ...siteLead,
    });
    await saveClientContact(
      db as any,
      {
        ...base,
        id: 'o2',
        createdAt: new Date('2026-11-01'),
        communicationPlatform: 'MAX',
        urlCommunication: 'https://max.ru/+79161234567',
        note: 'Имя: Анна Петрова',
      },
      { deleted: true },
    );
    expect(db.contacts.size).toBe(1);
    const c = [...db.contacts.values()][0];
    expect(c.name).toBe('Анна Петрова');
    expect(c.phone).toBe('+79161234567');
    expect(c.email).toBe('anna@mail.ru');
    expect(c.firstOrderAt).toEqual(new Date('2026-10-01'));
    expect(c.lastOrderAt).toEqual(new Date('2026-11-01'));
    expect(db.links.get('o2').deleted).toBe(true);
  });
});
