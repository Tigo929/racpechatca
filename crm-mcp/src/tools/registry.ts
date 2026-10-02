/**
 * Все инструменты сервера в одном списке.
 *
 * Порядок здесь — порядок, в котором их увидит модель, и он не случайный:
 * сначала то, о чём спрашивают чаще всего (заказы, деньги, реклама),
 * в конце — проверка данных. Модель читает список сверху, и первым ей
 * должен попасться инструмент, отвечающий на вопрос владельца, а не самый
 * технический.
 */

import { adTools } from './ads.js';
import { channelTools } from './channels.js';
import { marketplaceTools } from './marketplace.js';
import { moneyTools } from './money.js';
import { orderTools } from './orders.js';
import { productionTools } from './production.js';
import { qualityTools } from './quality.js';
import { salaryTools } from './salary.js';
import { sqlTools } from './sql.js';
import type { Tool } from './types.js';

export const allTools: Tool[] = [
  ...orderTools,
  ...moneyTools,
  ...adTools,
  ...channelTools,
  ...productionTools,
  ...salaryTools,
  ...marketplaceTools,
  ...qualityTools,
  // Запасной выход в конце списка намеренно: модель читает инструменты
  // сверху, и произвольный SQL должен попасться ей последним — после того,
  // как она не нашла готового ответа выше.
  ...sqlTools,
];

/**
 * Дубль имени — молчаливая потеря инструмента: второй перезапишет первый,
 * и модель никогда не узнает, что спрашивала не то. Проверяется при старте.
 */
export function assertUniqueNames(tools: Tool[] = allTools): void {
  const seen = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool.name)) {
      throw new Error(`Два инструмента с именем «${tool.name}» — один перезапишет другой.`);
    }
    seen.add(tool.name);
  }
}
