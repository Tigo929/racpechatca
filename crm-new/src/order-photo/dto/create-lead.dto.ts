import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Max,
  MinLength,
  Min,
} from 'class-validator';
import { EnumProductCategory } from 'src/generated/prisma/enums';

/**
 * Заявка с лендинга (публичная, без авторизации).
 * Превращается в заказ со статусом LEAD, который видит администратор в CRM.
 */
export class DtoCreateLead {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  leadId?: string;

  @IsString()
  @MinLength(2, { message: 'Укажите имя' })
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(5, { message: 'Укажите телефон' })
  @MaxLength(40)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  telegram?: string;

  @IsOptional()
  @IsIn(['telegram', 'max', 'email'])
  contactMethod?: 'telegram' | 'max' | 'email';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  productSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  productName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  unitPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  total?: number;

  @IsOptional()
  @IsIn(['yandex_pvz', 'pickup'])
  delivery?: 'yandex_pvz' | 'pickup';

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(600)
  photosArchiveUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  photosCount?: number;

  @IsOptional()
  @IsBoolean()
  photosFailed?: boolean;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(600)
  cloudLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  yclid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  yandexClientId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(600)
  pageUrl?: string;

  @IsOptional()
  @IsISO8601()
  submittedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /**
   * Комментарий клиента с формы сайта. Сайт шлёт именно `comment`, и пока
   * этого поля тут не было, ValidationPipe с whitelist молча его выбрасывал —
   * пожелания клиента («нужно к пятнице») до CRM не доходили.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsEnum(EnumProductCategory)
  productCategory?: EnumProductCategory;

  // --- Заявка на холст с сайта (productCategory = CANVAS) ---

  /** Ключ размера из прайса: «30x40». */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  canvasSizeKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  canvasSizeLabel?: string;

  /** Основа: MATTE или GLOSS. Хранится в примечании, отдельного поля у позиции нет. */
  @IsOptional()
  @IsIn(['MATTE', 'GLOSS'])
  canvasMaterial?: 'MATTE' | 'GLOSS';

  /** Багет; NONE — галерейная натяжка без рамы. */
  @IsOptional()
  @IsIn(['NONE', 'BLACK', 'WHITE', 'WOOD', 'GOLD'])
  canvasFrame?: 'NONE' | 'BLACK' | 'WHITE' | 'WOOD' | 'GOLD';

  /**
   * Кадрирование из конструктора, в пикселях оригинала. Идёт в примечание:
   * печатнику это готовое задание, менеджеру — замена переписке.
   */
  @IsOptional()
  @IsObject()
  canvasCrop?: { x: number; y: number; width: number; height: number };

  /** Вердикт конструктора по разрешению — клиент видел его до отправки. */
  @IsOptional()
  @IsIn(['ok', 'tight', 'low'])
  canvasResolution?: 'ok' | 'tight' | 'low';
}
