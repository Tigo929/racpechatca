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
  ValidateIf,
} from 'class-validator';
import { EnumProductCategory } from 'src/generated/prisma/enums';

/** Оставлен ли удалённый контакт — Telegram, MAX или почта. */
function hasRemoteContact(o: DtoCreateLead): boolean {
  return Boolean(o.contactValue && o.contactValue.trim());
}

/** Оставлен ли телефон. */
function hasPhone(o: DtoCreateLead): boolean {
  return Boolean(o.phone && o.phone.trim());
}

/**
 * Заявка с лендинга (публичная, без авторизации).
 * Превращается в заказ со статусом LEAD, который видит администратор в CRM.
 *
 * Контакт обязателен ровно один: телефон ИЛИ мессенджер. Раньше телефон был
 * обязателен всегда, и заявка от человека, который оставил только Telegram,
 * отбивалась с 400 — сайт показывал «принято», а в CRM ничего не появлялось.
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

  @ValidateIf((o: DtoCreateLead) => hasPhone(o) || !hasRemoteContact(o))
  @IsString({ message: 'Укажите телефон или контакт в мессенджере' })
  @MinLength(5, { message: 'Укажите телефон' })
  @MaxLength(40)
  phone?: string;

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

  /**
   * Бумага, выбранная клиентом на сайте.
   *
   * Поле необязательное: заявки со старой версии сайта его не присылают,
   * а валидатор настроен на forbidNonWhitelisted — обязательное поле
   * отбило бы их целиком. Ничего не пришло — остаётся глянец, как было.
   */
  @IsOptional()
  @IsIn(['GLOSS', 'MATTE'])
  paperType?: 'GLOSS' | 'MATTE';

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

  // --- Заявка на футболку с сайта (productCategory = TSHIRT) ---
  //
  // Поля приходят отдельными колонками, а не одной строкой в комментарии:
  // из них создаётся позиция ItemTshirt, по которой дальше считается
  // расчёт с партнёром. Разбирать текст ради этого нельзя.

  /** Крой: male | female | oversize. */
  @IsOptional()
  @IsIn(['male', 'female', 'oversize'])
  tshirtFit?: 'male' | 'female' | 'oversize';

  @IsOptional()
  @IsIn(['black', 'white'])
  tshirtColor?: 'black' | 'white';

  @IsOptional()
  @IsIn(['S', 'M', 'L', 'XL', 'XXL'])
  tshirtSize?: 'S' | 'M' | 'L' | 'XL' | 'XXL';

  @IsOptional()
  @IsIn(['front', 'back', 'front-back'])
  tshirtPlacement?: 'front' | 'back' | 'front-back';

  /** Слаг готового принта из каталога сайта; пусто — макет клиента. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tshirtPrintSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tshirtPrintName?: string;

  // --- Метки рекламной кампании ---
  //
  // До сих пор источник был виден только по yclid, то есть только по
  // Яндекс.Директу. UTM закрывают остальные каналы; хранятся в примечании
  // заказа, отдельных колонок под них в схеме пока нет.

  @IsOptional()
  @IsString()
  @MaxLength(150)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmTerm?: string;
}
