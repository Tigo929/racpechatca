import { render, screen } from '@testing-library/react';
import type { BehaviorIssues, DevicesBehavior, FormErrors, Funnel } from '../../../types/behavior';
import { DevicesBlock, FormErrorsBlock, FunnelCard, IssuesBlock } from '../behavior-sections';
import { behaviorWarnings } from '../behavior-view';

/**
 * Раздел «Поведение» (этап 10, разделы 19, 23): три единицы подписаны и не
 * смешиваются, неизмеримые шаги — текстом, недостаток данных — без нулей,
 * карточки разделяют факт / гипотезу / что проверить, сравнение подавляется.
 */

const period = { from: '2026-09-08', to: '2026-09-14', kind: 'days' as const, preset: 'last_7_days' as const };
const quality = { completeness: 'partial' as const, notes: ['PARTIAL_BEHAVIOR_PERIOD' as const, 'COMPARISON_UNAVAILABLE' as const] };

function globalFunnel(): Funnel {
  return {
    key: 'global',
    title: 'Общая воронка заявки',
    description: 'Все формы сайта',
    steps: [
      { key: 'visit', label: 'Визиты', event: null, basis: 'visits', availability: 'measured', availableFrom: null, measuredFrom: '2026-09-08', transition: null, events: null, visits: 145, users: 94, stepConversion: null, cumulativeConversion: null, dropoff: null, dropoffRate: null, note: null },
      { key: 'form_started', label: 'Начали заполнять форму', event: 'form_started', basis: 'goal', availability: 'measured', availableFrom: '2026-09-10', measuredFrom: '2026-09-10', transition: { status: 'partial', comparableFrom: '2026-09-10' }, events: 25, visits: 13, users: 3, stepConversion: 8.9655, cumulativeConversion: 8.9655, dropoff: 132, dropoffRate: 91.03, note: null },
      { key: 'lead_submit_attempt', label: 'Отправили форму (проверка пройдена)', event: 'lead_submit_attempt', basis: 'goal', availability: 'measured', availableFrom: '2026-09-10', measuredFrom: '2026-09-10', transition: { status: 'comparable', comparableFrom: '2026-09-10' }, events: 4, visits: 4, users: 1, stepConversion: 30.77, cumulativeConversion: 2.76, dropoff: 9, dropoffRate: 69.23, note: null },
      { key: 'lead_submitted', label: 'Заявка принята сервером', event: 'lead_submitted', basis: 'goal', availability: 'measured', availableFrom: '2026-09-10', measuredFrom: '2026-09-10', transition: { status: 'comparable', comparableFrom: '2026-09-10' }, events: 4, visits: 4, users: 1, stepConversion: 100, cumulativeConversion: 2.76, dropoff: 0, dropoffRate: 0, note: null },
    ],
    sample: { visits: 145, status: 'OK' },
    comparison: null,
    quality,
  };
}

describe('FunnelCard', () => {
  it('подписывает визиты, события и посетителей отдельно; 25 событий не выдаются за визиты', () => {
    render(<FunnelCard funnel={globalFunnel()} />);
    const started = screen.getByText('Начали заполнять форму').closest('li')!;
    expect(started).toHaveTextContent('13 визиты');
    expect(started).toHaveTextContent('25 события');
    expect(started).toHaveTextContent('3 посетители');
    expect(started).toHaveTextContent('8,97 % от пред. шага');
    expect(started).toHaveTextContent('отвал 91,03 %');
    // FIX_01: «визиты с 08.09 → начали форму с 10.09» — окна не совпадают, доля подписана как несравнимая;
    // переход между целями с одной даты — без пометки
    expect(screen.getByTestId('partial-transition-form_started')).toHaveTextContent('окна измерения не совпадают');
    expect(screen.queryByTestId('partial-transition-lead_submit_attempt')).not.toBeInTheDocument();
    // сравнение недоступно — дельт нет, предупреждение есть
    expect(screen.queryByText(/к пред\. периоду|\+\d+ \(/)).not.toBeInTheDocument();
    expect(screen.getByText('Сравнение с предыдущим периодом недоступно')).toBeInTheDocument();
    expect(screen.getByText(/Часть периода — до появления поведенческих целей/)).toBeInTheDocument();
  });

  it('неизмеримый шаг показан текстом, а не нулём; посетители без снимка — прочерк', () => {
    const f: Funnel = {
      ...globalFunnel(),
      key: 'tshirt',
      title: 'Футболки',
      steps: [
        { key: 'view_custom_tshirt', label: 'Открыли конструктор', event: 'view_custom_tshirt', basis: 'goal', availability: 'measured', availableFrom: '2026-09-10', measuredFrom: '2026-09-10', transition: null, events: 21, visits: 11, users: null, stepConversion: null, cumulativeConversion: null, dropoff: null, dropoffRate: null, note: null },
        { key: 'submit_tshirt_order', label: 'Отправили форму', event: null, basis: 'goal', availability: 'not_measured', availableFrom: null, measuredFrom: null, transition: null, events: null, visits: null, users: null, stepConversion: null, cumulativeConversion: null, dropoff: null, dropoffRate: null, note: 'Событие есть, цели в счётчике нет.' },
      ],
      sample: { visits: 11, status: 'LOW_SAMPLE' },
      quality: { completeness: 'partial', notes: ['LOW_SAMPLE', 'NO_PERIOD_GOAL_SNAPSHOT'] },
    };
    render(<FunnelCard funnel={f} />);
    expect(screen.getByText('шаг не измеряется')).toBeInTheDocument();
    expect(screen.getByText('Отправили форму').closest('li')).not.toHaveTextContent('0');
    expect(screen.getByText('Открыли конструктор').closest('li')).toHaveTextContent('— посетители');
    expect(screen.getByText('мало данных')).toBeInTheDocument();
    expect(screen.getByText(/не измеряется шагов: 1/)).toBeInTheDocument();
  });

  it('период до целей — «нет данных», без воронки из нулей', () => {
    const f: Funnel = { ...globalFunnel(), quality: { completeness: 'unavailable', notes: ['PERIOD_BEFORE_BEHAVIOR_GOALS'] } };
    render(<FunnelCard funnel={f} />);
    expect(screen.getByText('За этот период поведенческих данных нет')).toBeInTheDocument();
    expect(screen.queryByText('Начали заполнять форму')).not.toBeInTheDocument();
    expect(screen.getByText(/раньше 10 сентября 2026/)).toBeInTheDocument();
  });
});

describe('IssuesBlock', () => {
  it('карточка разделяет факт, гипотезу и что проверить; severity подписана; пропущенные правила с причиной', () => {
    const issues: BehaviorIssues = {
      period,
      previousPeriod: period,
      issues: [
        {
          id: 'DEVICE_GAP:device:mobile',
          rule: 'DEVICE_GAP',
          severity: 'CRITICAL',
          title: 'На телефонах конверсия заметно ниже, чем на компьютерах',
          fact: 'За 2026-09-08..2026-09-14 доля визитов с началом формы: телефоны 0 % (64 визитов), компьютеры 16,7 % (78 визитов); отношение 0.00.',
          hypothesis: 'Возможны трудности с формой на мобильных — данные это не различают.',
          recommendation: 'Проверить форму на ширине 360–430 px.',
          evidence: [{ metric: 'formStartRate', current: 0, baseline: 16.7, unit: 'percent', sample: 64, minSample: 30 }],
          causality: 'NOT_ESTABLISHED',
          scope: { kind: 'device', key: 'mobile' },
        },
      ],
      skipped: [
        { rule: 'LEAD_RATE_ANOMALY', code: 'LOW_SAMPLE', reason: 'в одном из периодов меньше 30 визитов' },
        {
          rule: 'FUNNEL_DROPOFF',
          code: 'PARTIAL_BEHAVIOR_PERIOD',
          reason: 'Фотопечать: «Начали форму фотопечати» → «Заявка на фото принята» — шаги измерены с разных дат (17.08.2026 и 12.09.2026), конверсия шага несопоставима; правило вернётся для периодов, начинающихся не раньше 12.09.2026',
        },
      ],
      thresholds: {},
      quality: { completeness: 'complete', notes: [] },
    };
    render(<IssuesBlock issues={issues} />);
    const card = screen.getByTestId('issue-DEVICE_GAP');
    expect(card).toHaveTextContent('Факт:');
    expect(card).toHaveTextContent('Гипотеза:');
    expect(card).toHaveTextContent('Что проверить:');
    expect(card).toHaveTextContent('Критично');
    expect(card).toHaveTextContent('Причина не установлена');
    expect(screen.getByText(/Правила без вывода \(мало данных или несопоставимые периоды\): 2/)).toBeInTheDocument();
    // FIX_01: причина подавления видна с кодом — тишина не читается как «всё хорошо»
    expect(screen.getByTestId('skipped-PARTIAL_BEHAVIOR_PERIOD')).toHaveTextContent('Отвал на шаге воронки · несопоставимые окна измерения: Фотопечать');
    expect(screen.getByTestId('skipped-PARTIAL_BEHAVIOR_PERIOD')).toHaveTextContent('не раньше 12.09.2026');
  });

  it('без карточек — честная формулировка, а не пустота', () => {
    render(<IssuesBlock issues={{ period, previousPeriod: period, issues: [], skipped: [], thresholds: {}, quality: { completeness: 'complete', notes: [] } }} />);
    expect(screen.getByText(/карточек нет/)).toBeInTheDocument();
  });

  it('состояние загрузки блока', () => {
    render(<IssuesBlock issues={undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка');
  });
});

describe('FormErrorsBlock и DevicesBlock', () => {
  it('ошибки: доли и поля; нет ошибок — пустое состояние', () => {
    const errors: FormErrors = {
      period,
      totals: { formErrorEvents: 3, formErrorVisits: 1, formStartedVisits: 13, attemptEvents: 4, attemptVisits: 4, errorRate: 7.69, errorsPerAttempt: 42.86, serverErrorEvents: 1, serverErrorVisits: 1 },
      byField: [{ key: 'contactValue', label: 'Контакт (мессенджер / e-mail)', visits: 1, users: 1, events: 3, shareOfErrors: 75 }],
      byDevice: [{ deviceCategory: 'desktop', formErrorVisits: 1, formErrorEvents: 3, formStartedVisits: 13, errorRate: 7.69 }, { deviceCategory: 'mobile', formErrorVisits: 0, formErrorEvents: 0, formStartedVisits: 0, errorRate: null }],
      byLanding: [],
      comparison: null,
      quality: { completeness: 'complete', notes: [] },
    };
    render(<FormErrorsBlock errors={errors} />);
    expect(screen.getByText('Контакт (мессенджер / e-mail)')).toBeInTheDocument();
    // доля от начавших форму — в сводке и в строке компьютера по устройствам
    expect(screen.getAllByText('7,69 %')).toHaveLength(2);
    expect(screen.getByText('42,86 %')).toBeInTheDocument();
    render(<FormErrorsBlock errors={{ ...errors, totals: { ...errors.totals, formErrorVisits: 0, formErrorEvents: 0, serverErrorVisits: 0, serverErrorEvents: 0 } }} />);
    expect(screen.getByText('За этот период ошибок формы не зафиксировано')).toBeInTheDocument();
  });

  it('устройства: разрыв описан как наблюдение; при малой выборке — почему сравнить нельзя', () => {
    const devices: DevicesBehavior = {
      period,
      rows: [
        { deviceCategory: 'desktop', visits: 78, sumDailyUsers: 60, formStartedVisits: 13, attemptVisits: 4, leadVisits: 4, formErrorVisits: 1, matchedAccepted: 1, formStartRate: 16.67, attemptRate: 30.77, leadConversion: 5.13, errorRate: 7.69, engagement: { bounceRate: 5.13, pageDepth: 8.74, avgDurationSeconds: 354.6 }, sample: 'OK' },
        { deviceCategory: 'mobile', visits: 64, sumDailyUsers: 55, formStartedVisits: 0, attemptVisits: 0, leadVisits: 0, formErrorVisits: 0, matchedAccepted: 0, formStartRate: 0, attemptRate: null, leadConversion: 0, errorRate: null, engagement: { bounceRate: 6.25, pageDepth: 3.25, avgDurationSeconds: 124.2 }, sample: 'OK' },
      ],
      gap: { metric: 'leadConversion', mobile: 0, desktop: 5.13, ratio: 0, status: 'COMPARABLE' },
      minSampleVisits: 30,
      quality: { completeness: 'complete', notes: [] },
    };
    render(<DevicesBlock devices={devices} />);
    expect(screen.getByTestId('device-gap')).toHaveTextContent('телефон 0 %, компьютер 5,13 %');
    expect(screen.getByTestId('device-gap')).toHaveTextContent('причина по данным не установлена');
    expect(screen.getByText('5 мин 55 с')).toBeInTheDocument();
    render(<DevicesBlock devices={{ ...devices, gap: { ...devices.gap, status: 'INSUFFICIENT_DATA', ratio: null } }} />);
    expect(screen.getAllByTestId('device-gap')[1]).toHaveTextContent('Сравнить телефон и компьютер нельзя');
  });
});

describe('behaviorWarnings', () => {
  it('переводит заметки качества в предупреждения без дублей', () => {
    const w = behaviorWarnings(['LOW_SAMPLE', 'LOW_SAMPLE', 'METRIKA_STALE', 'BEHAVIOR_NOT_SYNCED']);
    expect(w.map((x) => x.code)).toEqual(['low-sample', 'stale', 'not-synced']);
  });
});
