import { useContext } from 'react';
import { OrderModalContext } from './order-modal-context';

export function useOrderModal() {
  const context = useContext(OrderModalContext);
  if (!context) throw new Error('useOrderModal must be used within OrderModalProvider');
  return context;
}
