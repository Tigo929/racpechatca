import { useCallback, useState, type ReactNode } from 'react';
import type { DesignerSubmitPayload } from './designer/designerTypes';
import { OrderModalContext } from './order-modal-context';

export function OrderModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState('');
  const [design, setDesign] = useState<DesignerSubmitPayload | null>(null);

  const openModal = useCallback((p = '', d: DesignerSubmitPayload | null = null) => {
    setPreset(p);
    setDesign(d);
    setOpen(true);
  }, []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <OrderModalContext.Provider value={{ open, openModal, closeModal, preset, design }}>
      {children}
    </OrderModalContext.Provider>
  );
}
