import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Указать фактическую дату оплаты заказу, который уже оплачен, но даты
 * не имеет (работа D1). Дата обязательна: смысл действия — сообщить
 * известный факт, а не поставить «сегодня».
 */
export default class SetClientPaidAt {
  @IsString()
  @IsNotEmpty({ message: 'Укажите дату оплаты' })
  clientPaidAt!: string;
}
