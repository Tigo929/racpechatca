import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';
import { EnumTshirtSize } from 'src/generated/prisma/enums';
import { DtoSetStock } from './dto/set-stock.dto';

/** Порядок размеров для вывода (S..3XL); enum-порядок не гарантирован. */
const SIZE_ORDER: EnumTshirtSize[] = [
  EnumTshirtSize.S,
  EnumTshirtSize.M,
  EnumTshirtSize.L,
  EnumTshirtSize.XL,
  EnumTshirtSize.XXL,
  EnumTshirtSize.XXXL,
];

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Все остатки, отсортированы S..3XL, затем по цвету. */
  async list() {
    const rows = await this.prisma.tshirtStock.findMany();
    return rows.sort(
      (a, b) =>
        SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size) ||
        a.color.localeCompare(b.color),
    );
  }

  /** Установить остаток для размера×цвета (админ). */
  async setQuantity(dto: DtoSetStock) {
    return this.prisma.tshirtStock.upsert({
      where: { size_color: { size: dto.size, color: dto.color } },
      update: { quantity: dto.quantity },
      create: { size: dto.size, color: dto.color, quantity: dto.quantity },
    });
  }

  /**
   * Списать остатки под заказ (вызывается при переходе в «Отправлен»).
   * Блокирует, если на складе недостаточно. Идемпотентно: если по заказу
   * уже есть движения — повторно не списывает.
   * Позиции с неотслеживаемым размером/цветом (нет строки склада) пропускаются.
   */
  async consumeForOrder(orderId: string, tx: Prisma.TransactionClient) {
    const already = await tx.stockMovement.count({ where: { orderId } });
    if (already > 0) return;

    const items = await tx.itemTshirt.findMany({
      where: { orderId },
      select: { size: true, color: true, quantity: true },
    });
    if (items.length === 0) return;

    // Агрегируем потребность по размеру+цвету.
    const need = new Map<
      string,
      { size: EnumTshirtSize; color: string; qty: number }
    >();
    for (const it of items) {
      const key = `${it.size}|${it.color}`;
      const cur = need.get(key);
      if (cur) cur.qty += it.quantity;
      else need.set(key, { size: it.size, color: it.color, qty: it.quantity });
    }

    for (const n of need.values()) {
      // Блокируем строку остатка на время транзакции (без гонок).
      await tx.$queryRaw`
        SELECT "id" FROM "TshirtStock"
        WHERE "size" = ${n.size}::"EnumTshirtSize" AND "color" = ${n.color}
        FOR UPDATE
      `;
      const stock = await tx.tshirtStock.findUnique({
        where: { size_color: { size: n.size, color: n.color } },
      });
      // Размер/цвет не на учёте склада — не ограничиваем.
      if (!stock) continue;
      if (stock.quantity < n.qty) {
        throw new ConflictException(
          `Недостаточно на складе: ${n.size} ${n.color} — есть ${stock.quantity}, нужно ${n.qty}.`,
        );
      }
      await tx.tshirtStock.update({
        where: { id: stock.id },
        data: { quantity: stock.quantity - n.qty },
      });
      await tx.stockMovement.create({
        data: { orderId, size: n.size, color: n.color, quantity: n.qty },
      });
    }
  }

  /**
   * Вернуть склад по заказу (откат из «Отправлен» / удаление заказа).
   * Возвращает ровно столько, сколько было списано (по журналу движений).
   */
  async returnForOrder(orderId: string, tx: Prisma.TransactionClient) {
    const movements = await tx.stockMovement.findMany({ where: { orderId } });
    if (movements.length === 0) return;

    for (const m of movements) {
      await tx.tshirtStock.updateMany({
        where: { size: m.size, color: m.color },
        data: { quantity: { increment: m.quantity } },
      });
    }
    await tx.stockMovement.deleteMany({ where: { orderId } });
  }
}
