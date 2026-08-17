-- Реальные цифры продавца вместо оценочных значений по умолчанию:
-- футболка с принтом обходится в 380 ₽ готовым изделием, налог сейчас не
-- платится (самозанятый с налоговым вычетом).
--
-- Прежние 260 + 70 были прикидкой по настройкам партнёра для локальных
-- заказов и к марткетплейсу отношения не имели.

ALTER TABLE "OzonUnitEconomics" ALTER COLUMN "blankCost" SET DEFAULT 380;
ALTER TABLE "OzonUnitEconomics" ALTER COLUMN "printCost" SET DEFAULT 0;
ALTER TABLE "OzonUnitEconomics" ALTER COLUMN "taxBasisPoints" SET DEFAULT 0;

-- Строка настроек создаётся лениво и могла успеть появиться со старыми
-- значениями по умолчанию. Обновляем только её — то есть ровно тот случай,
-- когда продавец ещё ничего не менял руками (260/70/6% в точности).
UPDATE "OzonUnitEconomics"
SET "blankCost" = 380, "printCost" = 0, "taxBasisPoints" = 0
WHERE "blankCost" = 260 AND "printCost" = 70 AND "taxBasisPoints" = 600;
