-- Этап 17: происхождение заказа.
-- Только добавление значений перечисления: существующие значения не трогаются,
-- данные не переписываются. Историческая переклассификация идёт отдельной
-- командой (npm run origin:backfill) с dry-run по умолчанию.
ALTER TYPE "EnumSourceOrder" ADD VALUE IF NOT EXISTS 'WEBSITE';
ALTER TYPE "EnumSourceOrder" ADD VALUE IF NOT EXISTS 'UNKNOWN';
