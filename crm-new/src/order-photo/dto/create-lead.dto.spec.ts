import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { DtoCreateLead } from './create-lead.dto';

// Та же конфигурация, что в main.ts: whitelist молча выбрасывает поля,
// которых нет в DTO. Именно так терялся комментарий клиента.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const meta: ArgumentMetadata = { type: 'body', metatype: DtoCreateLead };

const base = {
  name: 'Анна',
  phone: '+7 900 000-00-00',
  contactMethod: 'telegram',
  contactValue: '@anna',
  productSlug: 'photo-10x15',
  productName: 'Фото 10x15',
  quantity: 20,
  unitPrice: 15,
  total: 300,
  delivery: 'pickup',
};

async function pass(body: Record<string, unknown>): Promise<DtoCreateLead> {
  return (await pipe.transform(body, meta)) as DtoCreateLead;
}

describe('заявка с сайта: приём полей', () => {
  it('комментарий клиента доходит до CRM', async () => {
    const dto = await pass({ ...base, comment: 'Нужно к пятнице' });
    expect(dto.comment).toBe('Нужно к пятнице');
  });

  it('принимает всё, что реально шлёт сайт', async () => {
    const dto = await pass({
      ...base,
      leadId: 'web-photo-abc123',
      productCategory: 'PHOTO',
      comment: 'Плёнка, аккуратно',
      photosArchiveUrl: 'https://example.ru/api/leads/archive/lead-1.zip',
      photosCount: 12,
      photosFailed: false,
      cloudLink: 'https://disk.yandex.ru/d/abc',
      yclid: 'yclid-12345',
      yandexClientId: '1700000000000000000',
      pageUrl: 'https://example.ru/catalog/photo-10x15',
      submittedAt: '2026-08-12T09:00:00.000Z',
    });

    // Ни одно из полей сайта не должно потеряться по дороге.
    expect(dto.leadId).toBe('web-photo-abc123');
    expect(dto.comment).toBe('Плёнка, аккуратно');
    expect(dto.photosCount).toBe(12);
    expect(dto.cloudLink).toContain('disk.yandex.ru');
    expect(dto.yclid).toBe('yclid-12345');
    expect(dto.yandexClientId).toBe('1700000000000000000');
    expect(dto.submittedAt).toBe('2026-08-12T09:00:00.000Z');
  });

  it('поле, которого нет в DTO, действительно выбрасывается', async () => {
    // Документирует механику бага: незнакомое поле исчезает без ошибки,
    // поэтому расхождение имён сайт↔CRM ничем себя не выдаёт.
    const dto = await pass({ ...base, somethingUnknown: 'значение' });
    expect(
      (dto as unknown as Record<string, unknown>).somethingUnknown,
    ).toBeUndefined();
  });

  it('цену клиент подменить не может — она перепроверяется отдельно', async () => {
    const dto = await pass({ ...base, unitPrice: 15, quantity: 20, total: 1 });
    // DTO пропускает числа как есть; несходимость ловит resolveLeadMoney.
    expect(dto.total).toBe(1);
  });
});

describe('заявка с сайта: контакт клиента', () => {
  it('без телефона, но с мессенджером — принимается', async () => {
    const { phone: _phone, ...withoutPhone } = base;
    const dto = await pass(withoutPhone);
    expect(dto.phone).toBeUndefined();
    expect(dto.contactValue).toBe('@anna');
  });

  it('без мессенджера, но с телефоном — принимается', async () => {
    const { contactMethod: _m, contactValue: _v, ...withoutContact } = base;
    const dto = await pass(withoutContact);
    expect(dto.phone).toBe('+7 900 000-00-00');
  });

  it('без обоих контактов — отказ: отвечать будет некуда', async () => {
    const { phone: _p, contactMethod: _m, contactValue: _v, ...bare } = base;
    await expect(pass(bare)).rejects.toThrow();
  });

  it('телефон-обрубок по-прежнему не проходит', async () => {
    await expect(pass({ ...base, phone: '123' })).rejects.toThrow();
  });
});
