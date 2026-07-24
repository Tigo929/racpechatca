import {
  detectProduct,
  evaluateCondition,
  evaluateScenario,
  isFilled,
  isStepRequired,
  pickRelevantAnswers,
  visibleSteps,
} from './scenario.engine';
import { SCENARIOS, findScenario, validateAllScenarios } from './scenario.registry';
import type { ProductScenario } from './scenario.types';

/** Маленький сценарий: проверяем движок, а не формулировки живых продуктов. */
const DEMO: ProductScenario = {
  key: 'DEMO',
  label: 'Демо',
  keywords: ['демо', 'проверка'],
  steps: [
    { key: 'what', label: 'Что делаем', field: { kind: 'text' } },
    {
      key: 'delivery',
      label: 'Доставка',
      field: {
        kind: 'select',
        options: [
          { value: 'PICKUP', label: 'Самовывоз' },
          { value: 'PVZ', label: 'ПВЗ' },
        ],
      },
    },
    {
      key: 'address',
      label: 'Адрес',
      field: { kind: 'text' },
      visibleWhen: { op: 'notEquals', field: 'delivery', value: 'PICKUP' },
    },
    {
      key: 'comment',
      label: 'Комментарий',
      field: { kind: 'textarea' },
      requiredWhen: { op: 'never' },
    },
  ],
};

describe('isFilled', () => {
  it('ноль — это ответ, а не пустое поле', () => {
    expect(isFilled(0)).toBe(true);
  });

  it('снятый флажок ответом не считается', () => {
    // Иначе панель отрапортует «всё собрано», хотя менеджер ничего не спросил.
    expect(isFilled(false)).toBe(false);
    expect(isFilled(true)).toBe(true);
  });

  it('пробелы — это пусто', () => {
    expect(isFilled('   ')).toBe(false);
    expect(isFilled('x')).toBe(true);
  });

  it('null и undefined пусты', () => {
    expect(isFilled(null)).toBe(false);
    expect(isFilled(undefined)).toBe(false);
  });
});

describe('evaluateCondition', () => {
  const a = { delivery: 'PVZ', qty: 5, flag: true };

  it('equals / notEquals / in', () => {
    expect(evaluateCondition({ op: 'equals', field: 'delivery', value: 'PVZ' }, a)).toBe(true);
    expect(evaluateCondition({ op: 'notEquals', field: 'delivery', value: 'PVZ' }, a)).toBe(false);
    expect(evaluateCondition({ op: 'in', field: 'delivery', values: ['PVZ', 'PICKUP'] }, a)).toBe(true);
  });

  it('gt работает только с числами', () => {
    expect(evaluateCondition({ op: 'gt', field: 'qty', value: 3 }, a)).toBe(true);
    expect(evaluateCondition({ op: 'gt', field: 'delivery', value: 3 }, a)).toBe(false);
  });

  it('and / or / not', () => {
    const cond = {
      op: 'and' as const,
      of: [
        { op: 'filled' as const, field: 'flag' },
        { op: 'not' as const, of: { op: 'equals' as const, field: 'delivery', value: 'PICKUP' } },
      ],
    };
    expect(evaluateCondition(cond, a)).toBe(true);
    expect(evaluateCondition({ op: 'or', of: [] }, a)).toBe(false);
  });

  it('never — всегда ложь', () => {
    expect(evaluateCondition({ op: 'never' }, a)).toBe(false);
  });

  it('отсутствующее поле не роняет вычисление', () => {
    expect(evaluateCondition({ op: 'equals', field: 'нет-такого', value: 'x' }, a)).toBe(false);
    expect(evaluateCondition({ op: 'filled', field: 'нет-такого' }, a)).toBe(false);
  });
});

describe('видимость и обязательность', () => {
  it('адрес появляется, только когда доставка не самовывоз', () => {
    expect(visibleSteps(DEMO, { delivery: 'PICKUP' }).map((s) => s.key)).not.toContain('address');
    expect(visibleSteps(DEMO, { delivery: 'PVZ' }).map((s) => s.key)).toContain('address');
  });

  it('скрытый шаг не может быть обязательным', () => {
    const address = DEMO.steps.find((s) => s.key === 'address')!;
    expect(isStepRequired(address, { delivery: 'PICKUP' })).toBe(false);
    expect(isStepRequired(address, { delivery: 'PVZ' })).toBe(true);
  });
});

describe('evaluateScenario', () => {
  it('считает только видимые обязательные шаги', () => {
    const p = evaluateScenario(DEMO, { delivery: 'PICKUP' });
    // what + delivery. address скрыт, comment необязателен.
    expect(p.requiredTotal).toBe(2);
    expect(p.requiredFilled).toBe(1);
    expect(p.missing.map((m) => m.key)).toEqual(['what']);
    expect(p.ready).toBe(false);
  });

  it('выбор доставки добавляет новый обязательный шаг', () => {
    const before = evaluateScenario(DEMO, { what: 'печать', delivery: 'PICKUP' });
    expect(before.ready).toBe(true);

    const after = evaluateScenario(DEMO, { what: 'печать', delivery: 'PVZ' });
    expect(after.ready).toBe(false);
    expect(after.missing.map((m) => m.key)).toEqual(['address']);
  });

  it('всё заполнено — можно оформлять', () => {
    const p = evaluateScenario(DEMO, { what: 'печать', delivery: 'PVZ', address: 'Москва' });
    expect(p).toMatchObject({ ready: true, requiredTotal: 3, requiredFilled: 3 });
    expect(p.missing).toHaveLength(0);
  });

  it('порядок подсказок — как в сценарии, а не случайный', () => {
    const p = evaluateScenario(DEMO, { delivery: 'PVZ' });
    expect(p.missing.map((m) => m.key)).toEqual(['what', 'address']);
  });
});

describe('pickRelevantAnswers', () => {
  it('выбрасывает ответы на скрытые и чужие шаги', () => {
    const cleaned = pickRelevantAnswers(DEMO, {
      what: 'печать',
      delivery: 'PICKUP',
      address: 'останется от прошлого выбора',
      чужое: 1,
    });
    expect(cleaned).toEqual({ what: 'печать', delivery: 'PICKUP' });
  });
});

describe('detectProduct', () => {
  it('узнаёт футболки по названию объявления', () => {
    const [best] = detectProduct('Печать на футболках DTF', SCENARIOS);
    expect(best.key).toBe('TSHIRT');
  });

  it('узнаёт фотопечать', () => {
    const [best] = detectProduct('Напечатать фото 10х15', SCENARIOS);
    expect(best.key).toBe('PHOTO');
  });

  it('не зависит от регистра и «ё»', () => {
    expect(detectProduct('НАНЕСЕНИЕ ПРИНТА', SCENARIOS)[0].key).toBe('TSHIRT');
  });

  it('на непонятном тексте молчит, а не угадывает', () => {
    // Пустой список = менеджер выбирает продукт сам. Это лучше, чем уверенно
    // подставить не тот сценарий и увести разговор не туда.
    expect(detectProduct('Здравствуйте, вы работаете сегодня?', SCENARIOS)).toEqual([]);
  });
});

describe('реестр продуктов', () => {
  it('описания сценариев целостны', () => {
    expect(validateAllScenarios()).toEqual([]);
  });

  it('ключи сценариев уникальны', () => {
    const keys = SCENARIOS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('findScenario находит продукт и не выдумывает несуществующий', () => {
    expect(findScenario('PHOTO')?.label).toBe('Печать фотографий');
    expect(findScenario('НЕТ')).toBeUndefined();
  });

  it('у каждого продукта спрашиваем согласованную сумму', () => {
    for (const s of SCENARIOS) {
      expect(s.steps.map((x) => x.key)).toContain('agreedTotal');
    }
  });
});
