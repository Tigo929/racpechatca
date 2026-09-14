import type { AnalyticsPeriod } from '../metrics/analytics-period';
import type { Freshness } from '../metrics/metrics-contract';
import { compare, percent, ratio, type Comparison } from '../metrics/ratios';
import type {
  BehaviorIssue,
  BehaviorIssues,
  BehaviorQuality,
  BehaviorQualityNote,
  BehaviorSummary,
  DeviceBehavior,
  DeviceGap,
  DevicesBehavior,
  ErrorByKey,
  FormErrors,
  Funnel,
  FunnelComparisonStep,
  FunnelKey,
  FunnelStep,
  IssueRule,
  IssueSeverity,
  PageBehavior,
  PagesBehavior,
  PathPage,
  PathsBehavior,
  SampleStatus,
  StepBasis,
} from './behavior-contract';
import {
  BEHAVIOR_GOALS_AVAILABLE_FROM,
  DIRECTION_GOALS_AVAILABLE_FROM,
  MIN_FORM_ERROR_VISITS,
  MIN_LEADS_FOR_RATE,
  MIN_SAMPLE_VISITS,
  MIN_STEP_ENTRANTS,
  THRESHOLDS,
} from './behavior-rules';

/**
 * Чистые вычисления поведенческого слоя (этап 10). Ни одного обращения к
 * базе: сервис собирает агрегаты периода в `BehaviorInput`, здесь из них
 * получаются воронки, ошибки, страницы, устройства, пути и карточки.
 *
 * Единицы измерения (см. behavior-contract): шаги воронок считаются в
 * целевых визитах; события и посетители показываются рядом, но никогда
 * не подменяют визиты. Нулевой знаменатель → null (ratios.ts), а не 0 %.
 */

export interface GoalCount {
  reaches: number;
  visits: number;
}

export interface EngagementSums {
  bounces: number;
  pageviews: number;
  durationSeconds: number;
}

export interface DeviceInput {
  deviceCategory: string;
  visits: number;
  sumDailyUsers: number;
  matchedAccepted: number;
  goals: Map<string, GoalCount>;
  engagement: EngagementSums | null;
}

export interface LandingInput {
  normalizedPath: string;
  visits: number;
  sumDailyUsers: number;
  matchedAccepted: number;
  goals: Map<string, GoalCount>;
}

export interface ParamInput {
  deviceCategory: string;
  key: string;
  value: string;
  visits: number;
  users: number;
  paramsNumber: number;
}

export interface PathInput {
  normalizedPath: string;
  visits: number | null;
  pageviews: number | null;
  users: number;
}

export interface BehaviorInput {
  period: AnalyticsPeriod;
  visits: number;
  sumDailyUsers: number;
  /** Достижения целей за период по идентификатору события (из MetrikaDailyGoal). */
  goalTotals: Map<string, GoalCount>;
  /** Уникальные посетители периода (снимок счётчика); null — снимка нет. */
  periodUsers: number | null;
  /** Посетители периода по событиям из снимка; null — снимка за период нет. */
  goalUsers: Map<string, number> | null;
  byDevice: DeviceInput[];
  byLanding: LandingInput[];
  params: ParamInput[];
  paths: Record<
    'entry_lead' | 'viewed_lead' | 'exit_all' | 'exit_nolead',
    PathInput[]
  >;
  /** Сколько строк поведенческих наборов есть за период — 0 значит «не синхронизировано». */
  behaviorRows: number;
  freshness: Freshness;
}

// ---------------------------------------------------------------------------
// Вспомогательное

const goal = (m: Map<string, GoalCount>, event: string): GoalCount =>
  m.get(event) ?? { reaches: 0, visits: 0 };

/** Визиты с параметром `key` (= любое значение или конкретное); при нескольких значениях в визите — по одному на значение. */
export function paramVisits(
  params: ParamInput[],
  key: string,
  value?: string,
): { visits: number; users: number; paramsNumber: number } {
  let visits = 0;
  let users = 0;
  let paramsNumber = 0;
  for (const p of params) {
    if (p.key !== key) continue;
    if (value !== undefined && p.value !== value) continue;
    visits += p.visits;
    users += p.users;
    paramsNumber += p.paramsNumber;
  }
  return { visits, users, paramsNumber };
}

export function sampleStatus(visits: number): SampleStatus {
  if (visits <= 0) return 'INSUFFICIENT_DATA';
  return visits < MIN_SAMPLE_VISITS ? 'LOW_SAMPLE' : 'OK';
}

function baseNotes(input: BehaviorInput): BehaviorQualityNote[] {
  const notes: BehaviorQualityNote[] = [];
  if (input.behaviorRows === 0) notes.push('BEHAVIOR_NOT_SYNCED');
  if (input.period.from < BEHAVIOR_GOALS_AVAILABLE_FROM) {
    notes.push(
      input.period.to < BEHAVIOR_GOALS_AVAILABLE_FROM
        ? 'PERIOD_BEFORE_BEHAVIOR_GOALS'
        : 'PARTIAL_BEHAVIOR_PERIOD',
    );
  }
  if (input.freshness.status === 'STALE') notes.push('METRIKA_STALE');
  if (input.freshness.status === 'NO_DATA') notes.push('METRIKA_NO_DATA');
  return notes;
}

function qualityOf(
  input: BehaviorInput,
  extra: BehaviorQualityNote[] = [],
): BehaviorQuality {
  const notes = [...new Set([...baseNotes(input), ...extra])];
  const completeness: BehaviorQuality['completeness'] =
    notes.includes('BEHAVIOR_NOT_SYNCED') ||
    notes.includes('PERIOD_BEFORE_BEHAVIOR_GOALS') ||
    notes.includes('METRIKA_NO_DATA')
      ? 'unavailable'
      : notes.length > 0
        ? 'partial'
        : 'complete';
  return { completeness, notes };
}

/** Сравнивать с предыдущим периодом можно, только если он целиком после даты доступности шагов. */
export function comparable(
  previous: BehaviorInput | null,
  availableFrom: string = BEHAVIOR_GOALS_AVAILABLE_FROM,
): previous is BehaviorInput {
  return (
    previous !== null &&
    previous.behaviorRows > 0 &&
    previous.period.from >= availableFrom
  );
}

// ---------------------------------------------------------------------------
// Воронки

interface StepDef {
  key: string;
  label: string;
  basis: StepBasis;
  /** goal: идентификатор события; param: `key` или `key=value`. */
  ref: string | null;
  availableFrom: string | null;
  /** Шаг существует в ТЗ, но не измеряется — причина. */
  notMeasured?: string;
}

const NOT_MEASURED_ATTEMPT_TSHIRT =
  'Событие submit_tshirt_order отправляется сайтом, но цели в счётчике нет (BEHAVIOR_EVENT_CONTRACT § 2.2, gap G2).';

const FUNNEL_DEFS: Record<
  FunnelKey,
  {
    title: string;
    description: string;
    steps: StepDef[];
    availableFrom: string;
  }
> = {
  global: {
    title: 'Общая воронка заявки',
    description:
      'Все формы сайта: визит → начали заполнять → форма прошла проверку → сервер принял заявку. Шаги — целевые визиты.',
    availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
    steps: [
      {
        key: 'visit',
        label: 'Визиты',
        basis: 'visits',
        ref: null,
        availableFrom: null,
      },
      {
        key: 'form_started',
        label: 'Начали заполнять форму',
        basis: 'goal',
        ref: 'form_started',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
      {
        key: 'lead_submit_attempt',
        label: 'Отправили форму (проверка пройдена)',
        basis: 'goal',
        ref: 'lead_submit_attempt',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
      {
        key: 'lead_submitted',
        label: 'Заявка принята сервером',
        basis: 'goal',
        ref: 'lead_submitted',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
    ],
  },
  photo: {
    title: 'Фотопечать',
    description:
      'Начало формы фотопечати определяется по параметру визита productSlug (только форма товара фото); заявка — цель lead_submitted_photo.',
    availableFrom: DIRECTION_GOALS_AVAILABLE_FROM,
    steps: [
      {
        key: 'catalog',
        label: 'Просмотр каталога / товара',
        basis: 'goal',
        ref: null,
        availableFrom: null,
        notMeasured:
          'События просмотра каталога фото нет; есть только e-commerce «detail», который целью не является (§ 2.4).',
      },
      {
        key: 'form_started_photo',
        label: 'Начали форму фотопечати',
        basis: 'param',
        ref: 'productSlug',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
      {
        key: 'lead_submitted_photo',
        label: 'Заявка на фото принята',
        basis: 'goal',
        ref: 'lead_submitted_photo',
        availableFrom: DIRECTION_GOALS_AVAILABLE_FROM,
      },
    ],
  },
  tshirt: {
    title: 'Футболки',
    description:
      'Конструктор своей футболки: открыли → выбрали размер → дошли до формы → заявка. Крой/цвет и попытка отправки целями не измеряются.',
    availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
    steps: [
      {
        key: 'view_custom_tshirt',
        label: 'Открыли конструктор',
        basis: 'goal',
        ref: 'view_custom_tshirt',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
      {
        key: 'choose_type_color',
        label: 'Выбрали крой / цвет',
        basis: 'goal',
        ref: null,
        availableFrom: null,
        notMeasured:
          'События choose_shirt_type и choose_color отправляются, но целей в счётчике нет (gap G2).',
      },
      {
        key: 'choose_size',
        label: 'Выбрали размер',
        basis: 'goal',
        ref: 'choose_size',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
      {
        key: 'add_tshirt_lead',
        label: 'Дошли до формы заявки',
        basis: 'goal',
        ref: 'add_tshirt_lead',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
      {
        key: 'submit_tshirt_order',
        label: 'Отправили форму',
        basis: 'goal',
        ref: null,
        availableFrom: null,
        notMeasured: NOT_MEASURED_ATTEMPT_TSHIRT,
      },
      {
        key: 'lead_submitted_tshirt',
        label: 'Заявка на футболку принята',
        basis: 'goal',
        ref: 'lead_submitted_tshirt',
        availableFrom: DIRECTION_GOALS_AVAILABLE_FROM,
      },
    ],
  },
  canvas: {
    title: 'Холсты',
    description:
      'Взаимодействие с конфигуратором холста (выбор формата/размера, форма) по параметру визита product=canvas; заявка — цель lead_submitted_canvas. Загрузки фото на сайте нет.',
    availableFrom: DIRECTION_GOALS_AVAILABLE_FROM,
    steps: [
      {
        key: 'canvas_interaction',
        label: 'Выбирали формат / размер холста',
        basis: 'param',
        ref: 'product=canvas',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
      {
        key: 'canvas_upload',
        label: 'Загрузили фото',
        basis: 'goal',
        ref: null,
        availableFrom: null,
        notMeasured:
          'На сайте нет загрузки фото для холста: фото присылают в переписке (§ 2.3). Шаг не существует, а не «0».',
      },
      {
        key: 'lead_submitted_canvas',
        label: 'Заявка на холст принята',
        basis: 'goal',
        ref: 'lead_submitted_canvas',
        availableFrom: DIRECTION_GOALS_AVAILABLE_FROM,
      },
    ],
  },
  contact: {
    title: 'Форма контактов',
    description:
      'Обращение через страницу «Контакты»: начало формы и заявка определяются по параметрам визита form=contact и product=contact (отдельной цели нет).',
    availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
    steps: [
      {
        key: 'contact_form',
        label: 'Начали форму контактов',
        basis: 'param',
        ref: 'form=contact',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
      {
        key: 'contact_lead',
        label: 'Обращение принято',
        basis: 'param',
        ref: 'product=contact',
        availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      },
    ],
  },
};

function stepCounts(
  def: StepDef,
  input: BehaviorInput,
): { events: number | null; visits: number | null; users: number | null } {
  if (def.notMeasured) return { events: null, visits: null, users: null };
  if (def.basis === 'visits')
    return { events: null, visits: input.visits, users: input.periodUsers };
  if (def.basis === 'goal' && def.ref) {
    const g = goal(input.goalTotals, def.ref);
    const users = input.goalUsers?.get(def.ref);
    return { events: g.reaches, visits: g.visits, users: users ?? null };
  }
  if (def.basis === 'param' && def.ref) {
    const [key, value] = def.ref.split('=');
    const p = paramVisits(input.params, key, value);
    return { events: p.paramsNumber, visits: p.visits, users: null };
  }
  return { events: null, visits: null, users: null };
}

export function computeFunnel(
  key: FunnelKey,
  input: BehaviorInput,
  previous: BehaviorInput | null,
): Funnel {
  const def = FUNNEL_DEFS[key];
  const steps: FunnelStep[] = [];
  let prevVisits: number | null = null;
  let firstVisits: number | null = null;
  const unavailable = input.period.to < def.availableFrom;
  for (const s of def.steps) {
    const counts =
      unavailable && s.basis !== 'visits'
        ? { events: null, visits: null, users: null }
        : stepCounts(s, input);
    const availability: FunnelStep['availability'] = s.notMeasured
      ? 'not_measured'
      : unavailable && s.basis !== 'visits'
        ? 'insufficient_data'
        : 'measured';
    const visits = counts.visits;
    const step: FunnelStep = {
      key: s.key,
      label: s.label,
      event: s.ref,
      basis: s.basis,
      availability,
      availableFrom: s.availableFrom,
      events: counts.events,
      visits,
      users: counts.users,
      stepConversion:
        availability === 'measured' ? percent(visits, prevVisits) : null,
      cumulativeConversion:
        availability === 'measured' ? percent(visits, firstVisits) : null,
      dropoff:
        availability === 'measured' && prevVisits !== null && visits !== null
          ? prevVisits - visits
          : null,
      dropoffRate:
        availability === 'measured' && prevVisits !== null && visits !== null
          ? percent(prevVisits - visits, prevVisits)
          : null,
      note:
        s.notMeasured ??
        (s.basis === 'param'
          ? 'Шаг по параметрам визита: визит считается, если параметр в нём был; при нескольких значениях — по одному на значение.'
          : null),
    };
    steps.push(step);
    if (availability === 'measured' && visits !== null) {
      if (firstVisits === null) firstVisits = visits;
      prevVisits = visits;
    }
  }
  const entrants =
    steps.find((s) => s.availability === 'measured')?.visits ?? 0;
  const extra: BehaviorQualityNote[] = [];
  if (unavailable)
    extra.push(
      key === 'global' || key === 'tshirt' || key === 'contact'
        ? 'PERIOD_BEFORE_BEHAVIOR_GOALS'
        : 'PERIOD_BEFORE_DIRECTION_GOALS',
    );
  else if (input.period.from < def.availableFrom)
    extra.push('PARTIAL_BEHAVIOR_PERIOD');
  if (sampleStatus(entrants) !== 'OK') extra.push('LOW_SAMPLE');
  if (input.goalUsers === null) extra.push('NO_PERIOD_GOAL_SNAPSHOT');

  let comparison: FunnelComparisonStep[] | null = null;
  if (comparable(previous, def.availableFrom) && !unavailable) {
    const prev = computeFunnel(key, previous, null);
    comparison = steps
      .filter((s) => s.availability === 'measured')
      .map((s) => {
        const p = prev.steps.find((x) => x.key === s.key);
        return {
          key: s.key,
          visits: compare(s.visits, p?.visits ?? null),
          stepConversion: compare(s.stepConversion, p?.stepConversion ?? null),
        };
      });
  } else {
    extra.push('COMPARISON_UNAVAILABLE');
  }
  return {
    key,
    title: def.title,
    description: def.description,
    steps,
    sample: { visits: entrants, status: sampleStatus(entrants) },
    comparison,
    quality: qualityOf(input, extra),
  };
}

export const FUNNEL_KEYS: FunnelKey[] = [
  'global',
  'photo',
  'tshirt',
  'canvas',
  'contact',
];

// ---------------------------------------------------------------------------
// Ошибки форм

const FIELD_LABELS: Record<string, string> = {
  name: 'Имя',
  phone: 'Телефон',
  contactValue: 'Контакт (мессенджер / e-mail)',
  contacts: 'Контакты',
  consent: 'Согласие на обработку данных',
  agreed: 'Согласие на обработку данных',
  delivery: 'Способ получения',
  paperType: 'Тип бумаги',
  comment: 'Комментарий',
  quantity: 'Количество',
  form: 'Форма целиком',
  unknown: 'Не определено',
};

export function computeErrors(
  input: BehaviorInput,
  previous: BehaviorInput | null,
): FormErrors {
  const formError = goal(input.goalTotals, 'form_error');
  const formStarted = goal(input.goalTotals, 'form_started');
  const attempt = goal(input.goalTotals, 'lead_submit_attempt');
  const serverError = goal(input.goalTotals, 'submit_tshirt_order_error');
  const fieldMap = new Map<string, ErrorByKey>();
  for (const p of input.params) {
    if (p.key !== 'field') continue;
    const cur = fieldMap.get(p.value) ?? {
      key: p.value,
      label: FIELD_LABELS[p.value] ?? p.value,
      visits: 0,
      users: 0,
      events: 0,
      shareOfErrors: null,
    };
    cur.visits += p.visits;
    cur.users += p.users;
    cur.events += p.paramsNumber;
    fieldMap.set(p.value, cur);
  }
  const totalFieldEvents = [...fieldMap.values()].reduce(
    (s, f) => s + f.events,
    0,
  );
  const byField = [...fieldMap.values()]
    .map((f) => ({ ...f, shareOfErrors: percent(f.events, totalFieldEvents) }))
    .sort((a, b) => b.events - a.events);
  const byDevice = input.byDevice
    .map((d) => {
      const e = goal(d.goals, 'form_error');
      const s = goal(d.goals, 'form_started');
      return {
        deviceCategory: d.deviceCategory,
        formErrorVisits: e.visits,
        formErrorEvents: e.reaches,
        formStartedVisits: s.visits,
        errorRate: percent(e.visits, s.visits),
      };
    })
    .sort((a, b) => b.formErrorVisits - a.formErrorVisits);
  const byLanding = input.byLanding
    .map((l) => {
      const e = goal(l.goals, 'form_error');
      const s = goal(l.goals, 'form_started');
      return {
        normalizedPath: l.normalizedPath,
        visits: l.visits,
        formErrorVisits: e.visits,
        formStartedVisits: s.visits,
        errorRate: percent(e.visits, s.visits),
        sample: sampleStatus(l.visits),
      };
    })
    .filter((l) => l.formErrorVisits > 0 || l.formStartedVisits > 0)
    .sort(
      (a, b) => b.formErrorVisits - a.formErrorVisits || b.visits - a.visits,
    );
  const errorRate = percent(formError.visits, formStarted.visits);
  let comparison: FormErrors['comparison'] = null;
  const extra: BehaviorQualityNote[] = [];
  if (input.period.to < DIRECTION_GOALS_AVAILABLE_FROM)
    extra.push('PERIOD_BEFORE_DIRECTION_GOALS');
  else if (input.period.from < DIRECTION_GOALS_AVAILABLE_FROM)
    extra.push('PARTIAL_BEHAVIOR_PERIOD');
  if (comparable(previous, DIRECTION_GOALS_AVAILABLE_FROM)) {
    const pe = goal(previous.goalTotals, 'form_error');
    const ps = goal(previous.goalTotals, 'form_started');
    comparison = {
      formErrorVisits: compare(formError.visits, pe.visits),
      errorRate: compare(errorRate, percent(pe.visits, ps.visits)),
    };
  } else {
    extra.push('COMPARISON_UNAVAILABLE');
  }
  if (sampleStatus(formStarted.visits) !== 'OK') extra.push('LOW_SAMPLE');
  return {
    period: input.period,
    totals: {
      formErrorEvents: formError.reaches,
      formErrorVisits: formError.visits,
      formStartedVisits: formStarted.visits,
      attemptEvents: attempt.reaches,
      attemptVisits: attempt.visits,
      errorRate,
      errorsPerAttempt: percent(
        formError.reaches,
        attempt.reaches + formError.reaches,
      ),
      serverErrorEvents: serverError.reaches,
      serverErrorVisits: serverError.visits,
    },
    byField,
    byDevice,
    byLanding,
    comparison,
    quality: qualityOf(input, extra),
  };
}

// ---------------------------------------------------------------------------
// Страницы

export function computePages(input: BehaviorInput): PagesBehavior {
  const lead = goal(input.goalTotals, 'lead_submitted');
  const started = goal(input.goalTotals, 'form_started');
  const siteLeadConversion = percent(lead.visits, input.visits);
  const siteFormStartRate = percent(started.visits, input.visits);
  const rows: PageBehavior[] = input.byLanding
    .map((l) => {
      const s = goal(l.goals, 'form_started');
      const a = goal(l.goals, 'lead_submit_attempt');
      const ld = goal(l.goals, 'lead_submitted');
      const e = goal(l.goals, 'form_error');
      const sample = sampleStatus(l.visits);
      const leadConversion = percent(ld.visits, l.visits);
      return {
        normalizedPath: l.normalizedPath,
        visits: l.visits,
        sumDailyUsers: l.sumDailyUsers,
        formStartedVisits: s.visits,
        attemptVisits: a.visits,
        leadVisits: ld.visits,
        formErrorVisits: e.visits,
        matchedAccepted: l.matchedAccepted,
        formStartRate: percent(s.visits, l.visits),
        leadConversion,
        errorRate: percent(e.visits, s.visits),
        sample,
        leadConversionVsSite:
          sample === 'OK' &&
          leadConversion !== null &&
          siteLeadConversion !== null
            ? leadConversion - siteLeadConversion
            : null,
      };
    })
    .sort((a, b) => b.visits - a.visits);
  const extra: BehaviorQualityNote[] = [];
  if (rows.every((r) => r.sample !== 'OK')) extra.push('LOW_SAMPLE');
  return {
    period: input.period,
    siteLeadConversion,
    siteFormStartRate,
    minSampleVisits: MIN_SAMPLE_VISITS,
    rows,
    quality: qualityOf(input, extra),
  };
}

// ---------------------------------------------------------------------------
// Устройства

const DEVICE_ORDER = ['desktop', 'mobile', 'tablet', 'other'];

export function computeDevices(input: BehaviorInput): DevicesBehavior {
  const rows: DeviceBehavior[] = input.byDevice
    .map((d) => {
      const s = goal(d.goals, 'form_started');
      const a = goal(d.goals, 'lead_submit_attempt');
      const ld = goal(d.goals, 'lead_submitted');
      const e = goal(d.goals, 'form_error');
      return {
        deviceCategory: d.deviceCategory,
        visits: d.visits,
        sumDailyUsers: d.sumDailyUsers,
        formStartedVisits: s.visits,
        attemptVisits: a.visits,
        leadVisits: ld.visits,
        formErrorVisits: e.visits,
        matchedAccepted: d.matchedAccepted,
        formStartRate: percent(s.visits, d.visits),
        attemptRate: percent(a.visits, s.visits),
        leadConversion: percent(ld.visits, d.visits),
        errorRate: percent(e.visits, s.visits),
        engagement: d.engagement
          ? {
              bounceRate: percent(d.engagement.bounces, d.visits),
              pageDepth: ratio(d.engagement.pageviews, d.visits),
              avgDurationSeconds: ratio(d.engagement.durationSeconds, d.visits),
            }
          : null,
        sample: sampleStatus(d.visits),
      };
    })
    .sort(
      (a, b) =>
        DEVICE_ORDER.indexOf(a.deviceCategory) -
        DEVICE_ORDER.indexOf(b.deviceCategory),
    );
  return {
    period: input.period,
    rows,
    gap: deviceGap(rows),
    minSampleVisits: MIN_SAMPLE_VISITS,
    quality: qualityOf(
      input,
      rows.every((r) => r.sample !== 'OK') ? ['LOW_SAMPLE'] : [],
    ),
  };
}

/**
 * Разрыв mobile / desktop по конверсии в заявку; если заявок мало у обоих —
 * по доле начавших форму (более частое событие). Сравнение только при
 * достаточной выборке у обоих устройств.
 */
export function deviceGap(rows: DeviceBehavior[]): DeviceGap {
  const mobile = rows.find((r) => r.deviceCategory === 'mobile');
  const desktop = rows.find((r) => r.deviceCategory === 'desktop');
  if (
    !mobile ||
    !desktop ||
    mobile.sample !== 'OK' ||
    desktop.sample !== 'OK'
  ) {
    return {
      metric: 'leadConversion',
      mobile: mobile?.leadConversion ?? null,
      desktop: desktop?.leadConversion ?? null,
      ratio: null,
      status: 'INSUFFICIENT_DATA',
    };
  }
  const useLeads = desktop.leadVisits + mobile.leadVisits >= MIN_LEADS_FOR_RATE;
  const metric: DeviceGap['metric'] = useLeads
    ? 'leadConversion'
    : 'formStartRate';
  const m = useLeads ? mobile.leadConversion : mobile.formStartRate;
  const d = useLeads ? desktop.leadConversion : desktop.formStartRate;
  if (d === null || m === null || d === 0) {
    return {
      metric,
      mobile: m,
      desktop: d,
      ratio: null,
      status:
        d === 0 && m !== null && m > 0 ? 'COMPARABLE' : 'INSUFFICIENT_DATA',
    };
  }
  return { metric, mobile: m, desktop: d, ratio: m / d, status: 'COMPARABLE' };
}

// ---------------------------------------------------------------------------
// Пути (агрегаты)

const PATH_TOP = 20;

function pathList(
  rows: PathInput[],
  total: number,
  field: 'visits' | 'pageviews',
): PathPage[] {
  return [...rows]
    .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
    .slice(0, PATH_TOP)
    .map((r) => ({
      normalizedPath: r.normalizedPath,
      visits: r.visits,
      pageviews: r.pageviews,
      users: r.users,
      share: percent(r[field], total),
    }));
}

export function computePaths(input: BehaviorInput): PathsBehavior {
  const sum = (rows: PathInput[], f: 'visits' | 'pageviews') =>
    rows.reduce((s, r) => s + (r[f] ?? 0), 0);
  const leadVisits = sum(input.paths.entry_lead, 'visits');
  const leadPageviews = sum(input.paths.viewed_lead, 'pageviews');
  const noLeadVisits = sum(input.paths.exit_nolead, 'visits');
  const allVisits = sum(input.paths.exit_all, 'visits');
  return {
    period: input.period,
    entryLead: pathList(input.paths.entry_lead, leadVisits, 'visits'),
    viewedLead: pathList(input.paths.viewed_lead, leadPageviews, 'pageviews'),
    exitNoLead: pathList(input.paths.exit_nolead, noLeadVisits, 'visits'),
    exitAll: pathList(input.paths.exit_all, allVisits, 'visits'),
    totals: { leadVisits, leadPageviews, noLeadVisits, allVisits },
    dataGap:
      'Reports API Метрики не отдаёт порядок страниц и событий внутри визита: здесь агрегаты (с какой страницы начинались визиты с заявкой, какие страницы в них смотрели, где визиты без заявки закончились), а не последовательности. Полные пути — только через Logs API по отдельному решению.',
    quality: qualityOf(input, leadVisits === 0 ? ['LOW_SAMPLE'] : []),
  };
}

// ---------------------------------------------------------------------------
// «Требует внимания»

const fmtPct = (v: number | null): string =>
  v === null ? '—' : `${(Math.round(v * 10) / 10).toLocaleString('ru-RU')} %`;
const fmtInt = (v: number | null): string =>
  v === null ? '—' : Math.round(v).toLocaleString('ru-RU');

function issue(
  rule: IssueRule,
  severity: IssueSeverity,
  scope: BehaviorIssue['scope'],
  title: string,
  fact: string,
  hypothesis: string,
  recommendation: string,
  evidence: BehaviorIssue['evidence'],
): BehaviorIssue {
  return {
    id: `${rule}:${scope.kind}:${scope.key}`,
    rule,
    severity,
    title,
    fact,
    hypothesis,
    recommendation,
    evidence,
    causality: 'NOT_ESTABLISHED',
    scope,
  };
}

export interface IssueContext {
  funnels: Funnel[];
  errors: FormErrors;
  pages: PagesBehavior;
  devices: DevicesBehavior;
  previousLeadRate: { visits: number; leadVisits: number } | null;
}

export function computeIssues(
  input: BehaviorInput,
  previous: BehaviorInput | null,
  ctx: IssueContext,
): BehaviorIssues {
  const issues: BehaviorIssue[] = [];
  const skipped: BehaviorIssues['skipped'] = [];
  const period = `${input.period.from}..${input.period.to}`;

  // 11.1 Large funnel drop-off — по каждой воронке, по измеренным шагам.
  for (const f of ctx.funnels) {
    const measured = f.steps.filter(
      (s) => s.availability === 'measured' && s.visits !== null,
    );
    let anyChecked = false;
    for (let i = 1; i < measured.length; i++) {
      const prevStep = measured[i - 1];
      const step = measured[i];
      if ((prevStep.visits ?? 0) < MIN_STEP_ENTRANTS) continue;
      anyChecked = true;
      const drop = step.dropoffRate ?? 0;
      const cmp =
        f.comparison?.find((c) => c.key === step.key)?.stepConversion ?? null;
      const prevConv = cmp?.previous ?? null;
      const deltaPp =
        prevConv !== null && step.stepConversion !== null
          ? prevConv - step.stepConversion
          : null;
      if (
        drop >= THRESHOLDS.dropoffAttentionRate ||
        (deltaPp !== null && deltaPp >= THRESHOLDS.dropoffDeltaCriticalPp)
      ) {
        const severity: IssueSeverity =
          deltaPp !== null && deltaPp >= THRESHOLDS.dropoffDeltaCriticalPp
            ? 'CRITICAL'
            : 'ATTENTION';
        issues.push(
          issue(
            'FUNNEL_DROPOFF',
            severity,
            { kind: 'funnel', key: `${f.key}:${step.key}` },
            `${f.title}: большой отвал на шаге «${step.label}»`,
            `За ${period} шаг «${prevStep.label}» → «${step.label}»: ${fmtInt(prevStep.visits)} → ${fmtInt(step.visits)} визитов, конверсия шага ${fmtPct(step.stepConversion)}, отвал ${fmtPct(step.dropoffRate)}` +
              (prevConv !== null
                ? `; в предыдущем периоде конверсия шага ${fmtPct(prevConv)}`
                : ''),
            'Возможно, на этом шаге есть барьер (форма, требования, цена, техническая ошибка) — данных о причине нет.',
            `Проверить шаг вручную на телефоне и компьютере, посмотреть ошибки формы за тот же период и записи Вебвизора визитов, остановившихся на «${prevStep.label}».`,
            [
              {
                metric: 'stepConversion',
                current: step.stepConversion,
                baseline: prevConv,
                unit: 'percent',
                sample: prevStep.visits ?? 0,
                minSample: MIN_STEP_ENTRANTS,
              },
              {
                metric: 'dropoffRate',
                current: step.dropoffRate,
                baseline: null,
                unit: 'percent',
                sample: prevStep.visits ?? 0,
                minSample: MIN_STEP_ENTRANTS,
              },
            ],
          ),
        );
      }
    }
    if (!anyChecked)
      skipped.push({
        rule: 'FUNNEL_DROPOFF',
        reason: `${f.title}: на входе шагов меньше ${MIN_STEP_ENTRANTS} визитов`,
      });
  }

  // 11.2 Device conversion gap
  const gap = ctx.devices.gap;
  if (
    gap.status === 'COMPARABLE' &&
    gap.desktop !== null &&
    gap.mobile !== null
  ) {
    const r = gap.ratio ?? (gap.mobile === 0 ? 0 : null);
    if (r !== null && r <= THRESHOLDS.deviceGapAttentionRatio) {
      const metricLabel =
        gap.metric === 'leadConversion'
          ? 'конверсия визитов в заявку'
          : 'доля визитов с началом формы';
      const mob = ctx.devices.rows.find((x) => x.deviceCategory === 'mobile');
      const desk = ctx.devices.rows.find((x) => x.deviceCategory === 'desktop');
      issues.push(
        issue(
          'DEVICE_GAP',
          r <= THRESHOLDS.deviceGapCriticalRatio ? 'CRITICAL' : 'ATTENTION',
          { kind: 'device', key: 'mobile' },
          'На телефонах конверсия заметно ниже, чем на компьютерах',
          `За ${period} ${metricLabel}: телефоны ${fmtPct(gap.mobile)} (${fmtInt(mob?.visits ?? null)} визитов), компьютеры ${fmtPct(gap.desktop)} (${fmtInt(desk?.visits ?? null)} визитов); отношение ${r.toFixed(2)}.`,
          'Возможны трудности с формой или страницей на мобильных, либо разный состав трафика по устройствам — данные это не различают.',
          'Проверить форму и путь до неё на ширине 360–430 px, сравнить ошибки формы по устройствам и источники трафика по устройствам за тот же период.',
          [
            {
              metric: gap.metric,
              current: gap.mobile,
              baseline: gap.desktop,
              unit: 'percent',
              sample: Math.min(mob?.visits ?? 0, desk?.visits ?? 0),
              minSample: MIN_SAMPLE_VISITS,
            },
            {
              metric: 'mobileToDesktopRatio',
              current: r,
              baseline: 1,
              unit: 'ratio',
              sample: Math.min(mob?.visits ?? 0, desk?.visits ?? 0),
              minSample: MIN_SAMPLE_VISITS,
            },
          ],
        ),
      );
    }
  } else {
    skipped.push({
      rule: 'DEVICE_GAP',
      reason: `у телефонов или компьютеров меньше ${MIN_SAMPLE_VISITS} визитов, либо заявок и начал формы нет у обоих`,
    });
  }

  // 11.3 Form error spike
  const e = ctx.errors.totals;
  if (e.formErrorVisits >= MIN_FORM_ERROR_VISITS) {
    const prevErr = ctx.errors.comparison?.formErrorVisits.previous ?? null;
    const factor =
      prevErr !== null && prevErr > 0 ? e.formErrorVisits / prevErr : null;
    const topField = ctx.errors.byField[0];
    const rateHigh =
      e.errorRate !== null &&
      e.errorRate >= THRESHOLDS.errorRateAttentionPct &&
      e.formStartedVisits >= THRESHOLDS.errorRateMinFormStarts;
    if (
      (factor !== null && factor >= THRESHOLDS.errorSpikeAttentionFactor) ||
      (prevErr === 0 && ctx.errors.comparison) ||
      rateHigh
    ) {
      issues.push(
        issue(
          'FORM_ERROR_SPIKE',
          factor !== null && factor >= THRESHOLDS.errorSpikeCriticalFactor
            ? 'CRITICAL'
            : 'ATTENTION',
          { kind: 'form', key: 'form_error' },
          'Ошибки формы участились',
          `За ${period}: ${fmtInt(e.formErrorVisits)} визитов с ошибкой формы (${fmtInt(e.formErrorEvents)} событий), ${fmtPct(e.errorRate)} от начавших форму` +
            (prevErr !== null
              ? `; в предыдущем периоде ${fmtInt(prevErr)} визитов`
              : '') +
            (topField
              ? `; чаще всего поле «${topField.label}» (${fmtInt(topField.events)} событий)`
              : ''),
          'Возможно, требования к полю непонятны или проверка отбивает корректный ввод — причина по данным не видна.',
          `Открыть форму и попробовать ввод в поле «${topField?.label ?? 'с ошибкой'}» в разных форматах; посмотреть Вебвизор визитов с ошибкой; сравнить по устройствам.`,
          [
            {
              metric: 'formErrorVisits',
              current: e.formErrorVisits,
              baseline: prevErr,
              unit: 'visits',
              sample: e.formStartedVisits,
              minSample: MIN_FORM_ERROR_VISITS,
            },
            {
              metric: 'errorRate',
              current: e.errorRate,
              baseline: ctx.errors.comparison?.errorRate.previous ?? null,
              unit: 'percent',
              sample: e.formStartedVisits,
              minSample: THRESHOLDS.errorRateMinFormStarts,
            },
          ],
        ),
      );
    }
  } else {
    skipped.push({
      rule: 'FORM_ERROR_SPIKE',
      reason: `визитов с ошибкой формы меньше ${MIN_FORM_ERROR_VISITS}`,
    });
  }

  // 11.4 Landing underperformance
  const site = ctx.pages.siteLeadConversion;
  if (site !== null && site > 0) {
    let checked = 0;
    for (const p of ctx.pages.rows) {
      if (p.sample !== 'OK') continue;
      const expected = (p.visits * site) / 100;
      if (expected < THRESHOLDS.landingMinExpectedLeads) continue;
      checked += 1;
      if (
        (p.leadConversion ?? 0) <=
        site * THRESHOLDS.landingUnderperformanceRatio
      ) {
        issues.push(
          issue(
            'LANDING_UNDERPERFORMANCE',
            'ATTENTION',
            { kind: 'page', key: p.normalizedPath },
            `Страница ${p.normalizedPath}: заявок меньше ожидаемого`,
            `За ${period}: ${fmtInt(p.visits)} визитов со входом на ${p.normalizedPath}, заявок ${fmtInt(p.leadVisits)} (конверсия ${fmtPct(p.leadConversion)}) при средней по сайту ${fmtPct(site)} — ожидалось около ${fmtInt(expected)}.`,
            'Возможно, страница не ведёт к форме или её трафик отличается по намерению — по данным различить нельзя.',
            'Сравнить источники трафика этой страницы с остальными, проверить путь до формы с неё и долю начавших форму.',
            [
              {
                metric: 'leadConversion',
                current: p.leadConversion,
                baseline: site,
                unit: 'percent',
                sample: p.visits,
                minSample: MIN_SAMPLE_VISITS,
              },
              {
                metric: 'leadVisits',
                current: p.leadVisits,
                baseline: expected,
                unit: 'visits',
                sample: p.visits,
                minSample: MIN_SAMPLE_VISITS,
              },
            ],
          ),
        );
      }
    }
    if (checked === 0)
      skipped.push({
        rule: 'LANDING_UNDERPERFORMANCE',
        reason: `нет страниц с ≥ ${MIN_SAMPLE_VISITS} визитами и ожидаемыми ≥ ${THRESHOLDS.landingMinExpectedLeads} заявками`,
      });
  } else {
    skipped.push({
      rule: 'LANDING_UNDERPERFORMANCE',
      reason: 'по сайту нет заявок за период — сравнивать страницы не с чем',
    });
  }

  // 11.5 Sudden lead-rate anomaly
  const lead = goal(input.goalTotals, 'lead_submitted');
  const cur = percent(lead.visits, input.visits);
  const prevRate = ctx.previousLeadRate;
  if (
    prevRate &&
    input.visits >= MIN_SAMPLE_VISITS &&
    prevRate.visits >= MIN_SAMPLE_VISITS &&
    comparable(previous)
  ) {
    const base = percent(prevRate.leadVisits, prevRate.visits);
    if (
      cur !== null &&
      base !== null &&
      (prevRate.leadVisits >= MIN_LEADS_FOR_RATE ||
        lead.visits >= MIN_LEADS_FOR_RATE)
    ) {
      const rel =
        base === 0
          ? cur > 0
            ? Infinity
            : 0
          : (Math.abs(cur - base) / base) * 100;
      if (rel >= THRESHOLDS.leadRateAnomalyRelPct) {
        const up = cur > base;
        issues.push(
          issue(
            'LEAD_RATE_ANOMALY',
            up ? 'INFO' : 'ATTENTION',
            { kind: 'site', key: 'lead_rate' },
            up
              ? 'Доля визитов с заявкой резко выросла'
              : 'Доля визитов с заявкой резко упала',
            `За ${period}: ${fmtInt(lead.visits)} заявок на ${fmtInt(input.visits)} визитов (${fmtPct(cur)}); в предыдущем периоде ${fmtInt(prevRate.leadVisits)} на ${fmtInt(prevRate.visits)} (${fmtPct(base)}).`,
            up
              ? 'Возможно, изменился состав трафика или сработала кампания — данные не говорят, что именно.'
              : 'Возможно, изменился трафик или что-то сломалось на пути к заявке — данные не говорят, что именно.',
            'Сравнить источники и страницы входа двух периодов, проверить ошибки формы и серверные ошибки за текущий период.',
            [
              {
                metric: 'leadRate',
                current: cur,
                baseline: base,
                unit: 'percent',
                sample: Math.min(input.visits, prevRate.visits),
                minSample: MIN_SAMPLE_VISITS,
              },
            ],
          ),
        );
      }
    }
  } else {
    skipped.push({
      rule: 'LEAD_RATE_ANOMALY',
      reason: `в одном из периодов меньше ${MIN_SAMPLE_VISITS} визитов или предыдущий период до появления целей`,
    });
  }

  const order: IssueSeverity[] = ['CRITICAL', 'ATTENTION', 'INFO'];
  issues.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  return {
    period: input.period,
    previousPeriod: previous?.period ?? input.period,
    issues,
    skipped,
    thresholds: {
      ...THRESHOLDS,
      MIN_SAMPLE_VISITS,
      MIN_STEP_ENTRANTS,
      MIN_FORM_ERROR_VISITS,
      MIN_LEADS_FOR_RATE,
    },
    quality: qualityOf(
      input,
      comparable(previous) ? [] : ['COMPARISON_UNAVAILABLE'],
    ),
  };
}

// ---------------------------------------------------------------------------
// Сводка

export function computeSummary(
  input: BehaviorInput,
  previous: BehaviorInput | null,
  globalFunnel: Funnel,
  devices: DevicesBehavior,
  issues: BehaviorIssues,
  generatedAt: Date,
): BehaviorSummary {
  const started = goal(input.goalTotals, 'form_started');
  const attempt = goal(input.goalTotals, 'lead_submit_attempt');
  const lead = goal(input.goalTotals, 'lead_submitted');
  const err = goal(input.goalTotals, 'form_error');
  const bySeverity: Record<IssueSeverity, number> = {
    INFO: 0,
    ATTENTION: 0,
    CRITICAL: 0,
  };
  for (const i of issues.issues) bySeverity[i.severity] += 1;
  return {
    period: input.period,
    previousPeriod: previous?.period ?? input.period,
    global: globalFunnel,
    headline: {
      visits: input.visits,
      formStartedVisits: started.visits,
      attemptVisits: attempt.visits,
      leadVisits: lead.visits,
      formErrorVisits: err.visits,
      formStartRate: percent(started.visits, input.visits),
      startToLead: percent(lead.visits, started.visits),
      leadConversion: percent(lead.visits, input.visits),
      errorRate: percent(err.visits, started.visits),
    },
    deviceGap: devices.gap,
    issuesBySeverity: bySeverity,
    dataQuality: {
      freshness: input.freshness,
      behaviorGoalsAvailableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      directionGoalsAvailableFrom: DIRECTION_GOALS_AVAILABLE_FROM,
      behaviorRowsInPeriod: input.behaviorRows,
      snapshotAvailable: input.goalUsers !== null,
      notes: globalFunnel.quality.notes,
    },
    generatedAt,
  };
}

/** Экспорт для тестов и сервиса. */
export const _internal = { goal, FUNNEL_DEFS };
export type { Comparison };
