-- Имя подрядчика по холстам — для отчёта.
--
-- У партнёра по футболкам имя уже есть (partnerName). Холсты печатает
-- отдельное производство, и в отчёте владелец хочет видеть, кто именно.
ALTER TABLE "PartnerSettings"
  ADD COLUMN "canvasContractorName" TEXT NOT NULL DEFAULT 'Производство холстов';
