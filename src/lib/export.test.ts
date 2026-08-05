import { describe, expect, it } from 'vitest';
import { csvEscape } from './export';

describe('csvEscape', () => {
  it('quotes comma separated values', () => {
    expect(csvEscape('Budi, Santoso')).toBe('"Budi, Santoso"');
  });

  it('escapes double quotes', () => {
    expect(csvEscape('Kutip "dua"')).toBe('"Kutip ""dua"""');
  });

  it('preserves newline inside quoted field', () => {
    expect(csvEscape('Baris 1\nBaris 2')).toBe('"Baris 1\nBaris 2"');
  });
});
