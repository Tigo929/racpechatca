import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { DesignerSubmitPayload } from './designer/designerTypes';

interface OrderModalCtx {
  open: boolean;
  /** Открыть модалку. preset — текст в поле «Описание»; design — данные из конструктора */
  openModal: (preset?: string, design?: DesignerSubmitPayload | null) => void;
  closeModal: () => void;
  preset: string;
  design: DesignerSubmitPayload | null;
}

const Ctx = createContext<OrderModalCtx | null>(null);

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
    <Ctx.Provider value={{ open, openModal, closeModal, preset, design }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOrderModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOrderModal must be used within OrderModalProvider');
  return ctx;
}
