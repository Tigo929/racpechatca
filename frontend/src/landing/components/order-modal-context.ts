import { createContext } from 'react';
import type { DesignerSubmitPayload } from './designer/designerTypes';

export interface OrderModalContextValue {
  open: boolean;
  openModal: (preset?: string, design?: DesignerSubmitPayload | null) => void;
  closeModal: () => void;
  preset: string;
  design: DesignerSubmitPayload | null;
}

export const OrderModalContext = createContext<OrderModalContextValue | null>(null);
