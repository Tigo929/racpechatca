import { decryptSecret, encryptSecret, secretHint } from './secret-box';

describe('шифрование ключей маркетплейсов', () => {
  const master = 'test-master-secret';

  it('расшифровывает то, что зашифровало', () => {
    const key = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(decryptSecret(encryptSecret(key, master), master)).toBe(key);
  });

  it('каждый раз даёт разный шифротекст — по базе не видно одинаковых ключей', () => {
    const a = encryptSecret('same-key', master);
    const b = encryptSecret('same-key', master);
    expect(a).not.toBe(b);
  });

  it('не расшифровывает чужим мастер-ключом', () => {
    const stored = encryptSecret('secret', master);
    expect(() => decryptSecret(stored, 'other-master')).toThrow();
  });

  it('ловит подмену шифротекста — GCM проверяет целостность', () => {
    const stored = encryptSecret('secret', master);
    const parts = stored.split(':');
    const data = Buffer.from(parts[3], 'base64');
    data[0] = data[0] ^ 0xff;
    parts[3] = data.toString('base64');
    expect(() => decryptSecret(parts.join(':'), master)).toThrow();
  });

  it('подсказка показывает только хвост ключа', () => {
    expect(secretHint('0123456789abcdef')).toBe('…cdef');
    expect(secretHint('')).toBe('');
  });
});
