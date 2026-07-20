import type { PartnerSettings } from '../types/index';
import { api } from './client';

export const partnerSettingsApi = {
  get: async (): Promise<PartnerSettings> => {
    const { data } = await api.get<PartnerSettings>('/partner-settings');
    return data;
  },

  update: async (patch: Partial<PartnerSettings>): Promise<PartnerSettings> => {
    const { data } = await api.patch<PartnerSettings>('/partner-settings', patch);
    return data;
  },
};
