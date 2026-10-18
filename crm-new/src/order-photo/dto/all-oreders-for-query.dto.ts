import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EnumProductCategory,
  EnumSourceOrder,
  EnumStatus,
} from 'src/generated/prisma/enums';

export default class DtoAllOrdersforQuery {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsEnum(EnumStatus)
  @IsOptional()
  status?: EnumStatus;

  @IsEnum(EnumSourceOrder)
  @IsOptional()
  sourceOrder?: EnumSourceOrder;

  @IsEnum(EnumProductCategory)
  @IsOptional()
  productCategory?: EnumProductCategory;

  // Фильтр по отметке отзыва. Строкой ('true'/'false'), чтобы implicit-conversion
  // не превратил 'false' в boolean true. Сравниваем явно в сервисе.
  @IsIn(['true', 'false'])
  @IsOptional()
  reviewLeft?: 'true' | 'false';

  /**
   * Заказы с маркетплейсов: показать только их, скрыть или не фильтровать.
   *
   * Футболки приходят двумя разными потоками. Заказ с площадки ведёт сама
   * площадка: там свои номера отправлений, свои сроки отгрузки и нет шага
   * оплаты. Заказ по заявке (Авито, сайт, переписка) живёт обычным путём.
   * Вперемешку их видеть неудобно — для площадки есть свой раздел.
   *
   * Строкой, а не булевым: implicit-conversion превратил бы 'false'
   * в true, и фильтр «скрыть» означал бы «показать».
   *
   * Не задан — в списке футболок заказы с площадок скрыты: это другое
   * направление с другим трафиком, и в общем списке оно только путает.
   * Чтобы увидеть всё вместе, нужно сказать это прямо — `all`.
   */
  @IsIn(['only', 'exclude', 'all'])
  @IsOptional()
  marketplace?: 'only' | 'exclude' | 'all';

  // Полнотекстовый поиск по номеру заказа и контакту клиента.
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim())
  search?: string;

  /**
   * Отбор по исполнителю: идентификатор сотрудника либо `none` — «никому не
   * назначен». Второе значение не прихоть: заказ без исполнителя не виден
   * ни в чьей загрузке, и именно такие теряются.
   *
   * На роль EXECUTOR параметр не влияет: сервис всё равно принудительно
   * оставляет ему только свои заказы, иначе чужую загрузку можно было бы
   * посмотреть подбором адреса.
   */
  @IsOptional()
  @Matches(
    /^(none|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,
    { message: 'executorId: ожидается идентификатор сотрудника или none' },
  )
  executorId?: string;

  /**
   * По какому полю строить список.
   *
   * Не задано — обычный порядок работы: активные сверху, срочные выше,
   * дальше по дате. Он отвечает на вопрос «что делать сейчас» и для
   * ежедневной работы правильнее любой сортировки.
   *
   * Заданное поле отвечает на другие вопросы: «что горит по срокам» и
   * «какие заказы самые дорогие». Тогда порядок работы отступает —
   * иначе человек отсортировал бы по сумме и не понял, почему дешёвый
   * заказ стоит выше дорогого.
   */
  @IsIn(['deadline', 'total'])
  @IsOptional()
  sort?: 'deadline' | 'total';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  dir?: 'asc' | 'desc';

  /**
   * Самовывоз или доставка.
   *
   * Это два разных дня работы: самовывоз надо собрать к приходу
   * человека, посылку — успеть отдать в пункт выдачи. Способов доставки
   * в базе пять, но делятся они ровно на эти два случая.
   */
  @IsIn(['pickup', 'delivery'])
  @IsOptional()
  delivery?: 'pickup' | 'delivery';
}
