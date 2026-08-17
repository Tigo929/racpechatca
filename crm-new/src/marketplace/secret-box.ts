import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

/**
 * Шифрование секретов маркетплейсов перед записью в базу.
 *
 * Api-Key продавца — это полный доступ к кабинету: цены, остатки, отгрузки.
 * Дамп базы (а он у нас лежит в репозитории проекта) не должен превращаться в
 * утечку магазина, поэтому ключ хранится зашифрованным AES-256-GCM.
 *
 * Мастер-ключ берём из MARKETPLACE_SECRET, а если его не задали — из
 * JWT_SECRET. Это осознанный компромисс: без запасного варианта фича упала бы
 * в проде на первом же сохранении, а так она работает сразу, и отдельный
 * секрет можно завести позже (тогда старые записи нужно пересохранить).
 */

const ALGO = 'aes-256-gcm';
/** Соль фиксированная: пароль один на инсталляцию, KDF нужен ради длины ключа. */
const KEY_SALT = 'raspechatka.marketplace.v1';
const IV_LENGTH = 12;

export class SecretKeyMissingError extends Error {
  constructor() {
    super(
      'Не задан MARKETPLACE_SECRET (и нет JWT_SECRET) — ключи маркетплейсов негде шифровать',
    );
  }
}

function deriveKey(masterSecret: string): Buffer {
  if (!masterSecret) throw new SecretKeyMissingError();
  return scryptSync(masterSecret, KEY_SALT, 32);
}

/** Возвращает строку вида `v1:<iv>:<tag>:<данные>` в base64. */
export function encryptSecret(plain: string, masterSecret: string): string {
  const key = deriveKey(masterSecret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptSecret(stored: string, masterSecret: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Секрет записан в неизвестном формате');
  }
  const decipher = createDecipheriv(
    ALGO,
    deriveKey(masterSecret),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Хвост ключа для интерфейса. Показываем последние 4 символа: этого хватает,
 * чтобы узнать «свой» ключ среди нескольких кабинетов, и мало, чтобы им
 * воспользоваться.
 */
export function secretHint(plain: string): string {
  const tail = plain.trim().slice(-4);
  return tail ? `…${tail}` : '';
}
