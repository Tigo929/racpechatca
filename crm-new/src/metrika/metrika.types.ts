/**
 * Типы ответов API Яндекс Метрики — только то, что используем.
 *
 * Полную схему API не моделируем: она большая и меняется, а нам нужны
 * счётчик, его цели и базовый ответ отчётов. Всё прочее остаётся
 * `unknown`, чтобы не врать типами о том, чего не проверяли.
 */

/** GET /management/v1/counter/{id} */
export interface MetrikaCounter {
  id: number;
  status?: string;
  /** Статус сбора данных: Active / Inactive и т.п. */
  code_status?: string;
  name?: string;
  site?: string;
  site2?: { site?: string; domain?: string };
  /** Права текущего токена на счётчик: own / view / edit. */
  permission?: string;
  /** Часовой пояс счётчика, например Europe/Moscow. В нём Метрика ждёт даты заказов из CRM. */
  time_zone_name?: string;
  /** Смещение часового пояса в минутах от UTC. */
  time_zone_offset?: number;
  goals?: MetrikaGoal[];
}

export interface MetrikaCounterResponse {
  counter: MetrikaCounter;
}

/** Цель счётчика. Для JS-целей `type === 'action'`, а идентификатор события — в `conditions[].url`. */
export interface MetrikaGoal {
  id: number;
  name: string;
  type: string;
  is_retargeting?: number;
  conditions?: { type?: string; url?: string }[];
  /** Составная цель: шаги. */
  steps?: MetrikaGoal[];
}

export interface MetrikaGoalsResponse {
  goals: MetrikaGoal[];
}

/** GET /stat/v1/data */
export interface MetrikaStatsQuery {
  metrics: string[];
  dimensions?: string[];
  date1: string;
  date2: string;
  filters?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  accuracy?: string;
  /** Язык названий измерений (ru/en); коды (`id`) от языка не зависят. */
  lang?: 'ru' | 'en';
}

export interface MetrikaStatsRow {
  /** У пустого измерения (прямой заход без движка, визит без UTM) name и id — null. */
  dimensions: {
    name?: string | null;
    id?: string | null;
    [key: string]: unknown;
  }[];
  metrics: (number | null)[];
}

export interface MetrikaStatsResponse {
  query: {
    ids: number[];
    dimensions: string[];
    metrics: string[];
    date1: string;
    date2: string;
    [key: string]: unknown;
  };
  data: MetrikaStatsRow[];
  total_rows?: number;
  sampled?: boolean;
  sample_share?: number;
  sample_size?: number;
  sample_space?: number;
  data_lag?: number;
  totals?: (number | null)[];
  min?: (number | null)[];
  max?: (number | null)[];
}

/**
 * Загрузка данных CDP: ответ на POST /cdp/api/v1/counter/{id}/data/simple_orders
 * и элементы GET /cdp/api/v1/counter/{id}/last_uploadings.
 */
export interface MetrikaUploading {
  uploading_id: string;
  /** yyyy-MM-dd HH:mm:ss */
  datetime?: string;
  /** PASSED — файл принят; FAILED — в нём ошибка, данные не загружены. */
  api_validation_status?: 'PASSED' | 'FAILED' | string;
  elements_count?: number;
  entity_type?: string;
  uploading_format?: string;
  uploading_source?: string;
}

export interface MetrikaUploadingResponse {
  uploading: MetrikaUploading;
}

export interface MetrikaLastUploadingsResponse {
  uploadings: MetrikaUploading[];
}

/** merge_mode загрузки заказов: SAVE — заменить заказ целиком (мы шлём полный снимок). */
export type MetrikaMergeMode = 'SAVE' | 'UPDATE' | 'APPEND';

/** Тело ошибки API: {"errors":[{"error_type":"...","message":"..."}],"code":403,"message":"..."} */
export interface MetrikaErrorBody {
  code?: number;
  message?: string;
  errors?: { error_type?: string; message?: string; location?: string }[];
}
