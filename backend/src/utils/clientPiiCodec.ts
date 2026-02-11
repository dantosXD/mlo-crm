import { decrypt } from './crypto.js';

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 32) {
      return true;
    }
  }

  return false;
}

function isLikelyBase64(value: string): boolean {
  if (!value || value.length % 4 !== 0) {
    return false;
  }

  return BASE64_PATTERN.test(value);
}

function tryDecodeBase64(value: string): string | null {
  const normalized = value.trim();
  if (!isLikelyBase64(normalized)) {
    return null;
  }

  try {
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    if (!decoded || hasControlChars(decoded)) {
      return null;
    }

    // Verify this is truly base64 for this decoded payload.
    const reEncoded = Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/, '');
    const original = normalized.replace(/=+$/, '');
    if (reEncoded !== original) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function tryDecodeLegacyJsonEnvelope(value: string): string | null {
  const normalized = value.trim();
  if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const data = (parsed as { data?: unknown }).data;
    if (typeof data !== 'string' || !data) {
      return null;
    }

    // AES-encrypted payloads are handled by decrypt(); avoid returning ciphertext.
    const iv = (parsed as { iv?: unknown }).iv;
    if (typeof iv === 'string' && iv.length > 0) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function decodeClientPiiField(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const decrypted = decrypt(value);
  if (decrypted !== value) {
    return decrypted;
  }

  const base64Decoded = tryDecodeBase64(value);
  if (base64Decoded !== null) {
    return base64Decoded;
  }

  const legacyJsonDecoded = tryDecodeLegacyJsonEnvelope(value);
  if (legacyJsonDecoded !== null) {
    return legacyJsonDecoded;
  }

  return value;
}
