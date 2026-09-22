/** Заказ аналитического отчёта (этап 16): только метаданные, без содержимого. */
export interface AnalyticsReport {
  id: string;
  status: 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED';
  periodType: string;
  dateFrom: string;
  dateTo: string;
  requestedAt: string;
  generatedAt: string | null;
  productionBuild: string | null;
  mdSizeBytes: number | null;
  htmlSizeBytes: number | null;
  errorMessage: string | null;
  formats: ('md' | 'html')[];
}

export interface AnalyticsReportList {
  items: AnalyticsReport[];
  total: number;
}

export interface CreateReportRequest {
  preset?: '7d' | '30d';
  dateFrom?: string;
  dateTo?: string;
}
