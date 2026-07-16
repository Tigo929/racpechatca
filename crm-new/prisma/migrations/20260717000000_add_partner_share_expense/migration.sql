-- Новая категория расходов: доля партнёра (Гриши) с заказов футболок.
ALTER TYPE "EnumExpenseCategory" ADD VALUE IF NOT EXISTS 'PARTNER_SHARE' BEFORE 'OTHER';
