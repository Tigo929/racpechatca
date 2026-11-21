import { photoBorder, photoBorderStyle } from './photo-border';

describe('поля у фото', () => {
  it('узнаёт форматы из справочника', () => {
    expect(photoBorder('10×15 с полями')).toBe('WITH');
    expect(photoBorder('10×15 без полей')).toBe('WITHOUT');
    expect(photoBorder('7,5×10 с полями')).toBe('WITH');
    expect(photoBorder('7,5×10 без полей')).toBe('WITHOUT');
  });

  it('узнаёт и вписанное руками', () => {
    expect(photoBorder('10х15 С ПОЛЯМИ')).toBe('WITH');
    expect(photoBorder('7.5x10  без  полей')).toBe('WITHOUT');
  });

  it('без слова о полях — не красит', () => {
    expect(photoBorder('Polaroid')).toBeNull();
    expect(photoBorder('10×15')).toBeNull();
  });

  it('свободную позицию не красит', () => {
    expect(photoBorderStyle('10×15 с полями', true)).toBeNull();
    expect(photoBorderStyle('10×15 с полями')).not.toBeNull();
  });
});
