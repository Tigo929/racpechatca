import { addOrder, emptyBucket, type OrderRow } from './reports.service';
import { costSettingsFrom } from './order-cogs';

describe('free client delivery still has carrier cost', () => {
  it.each(['PHOTO', 'CANVAS', 'TSHIRT'])(
    '%s pays carrier even when client is not charged',
    (productCategory) => {
      const base: OrderRow = {
        productCategory,
        deliveryMethod: 'YANDEX_PVZ',
        deliveryCost: 0,
        totalOrder: 1200,
        createdAt: new Date(),
        sentAt: null,
        clientPaidAt: null,
        completedAt: null,
        statusChangedAt: null,
        items: [],
        tshirtItems: [],
        canvasItems: [],
        accruals: [],
      };
      const settings = costSettingsFrom(null);
      const free = emptyBucket(),
        charged = emptyBucket(),
        pickup = emptyBucket();
      addOrder(free, base, settings);
      addOrder(
        charged,
        { ...base, deliveryCost: 300, totalOrder: 1500 },
        settings,
      );
      addOrder(pickup, { ...base, deliveryMethod: 'PICKUP' }, settings);
      expect(free.deliveryPaid).toBe(99);
      expect(charged.deliveryPaid).toBe(99);
      expect(pickup.deliveryPaid).toBe(0);
    },
  );
});
