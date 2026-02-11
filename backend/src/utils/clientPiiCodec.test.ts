import { describe, expect, it } from 'vitest';
import { encrypt } from './crypto.js';
import { decodeClientPiiField } from './clientPiiCodec.js';

describe('decodeClientPiiField', () => {
  it('decodes AES-encrypted values using crypto decrypt', () => {
    const encrypted = encrypt('Jane Borrower');
    const decoded = decodeClientPiiField(encrypted);

    expect(decoded).toBe('Jane Borrower');
  });

  it('falls back to base64 decode for legacy encoded values', () => {
    const decoded = decodeClientPiiField('SmFuZSBCb3Jyb3dlcg==');

    expect(decoded).toBe('Jane Borrower');
  });

  it('falls back to legacy JSON envelope decode', () => {
    const decoded = decodeClientPiiField('{"data":"Jane Borrower"}');

    expect(decoded).toBe('Jane Borrower');
  });

  it('returns original value when no decode path applies', () => {
    const raw = 'plain@example.com';
    const decoded = decodeClientPiiField(raw);

    expect(decoded).toBe(raw);
  });

  it('returns original value for malformed base64-like input', () => {
    const malformed = 'abc=';
    const decoded = decodeClientPiiField(malformed);

    expect(decoded).toBe(malformed);
  });

  it('returns empty string for nullish input', () => {
    expect(decodeClientPiiField(null)).toBe('');
    expect(decodeClientPiiField(undefined)).toBe('');
  });
});
