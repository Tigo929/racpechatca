import type { ShipmentLead } from '../types/index';
import { api } from './client';

/** «Старший дня» по отгрузкам: кого план дня тегает в блоке отгрузок. Только админ. */
export const shipmentLeadApi = {
  get: async (): Promise<ShipmentLead> => {
    const { data } = await api.get<ShipmentLead>(
      '/order-photo/daily-plan/shipment-lead',
    );
    return data;
  },

  set: async (userId: string | null): Promise<ShipmentLead> => {
    const { data } = await api.patch<ShipmentLead>(
      '/order-photo/daily-plan/shipment-lead',
      { userId },
    );
    return data;
  },
};
