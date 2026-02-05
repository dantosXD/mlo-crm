const isLikelyBase64 = (value: string): boolean => {
  if (!value || value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
};

const decodeBase64 = (value: string): string | null => {
  try {
    if (typeof atob === 'function') {
      return atob(value);
    }
  } catch {
    // Ignore and try Buffer below
  }

  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(value, 'base64').toString('utf-8');
    }
  } catch {
    // Ignore
  }

  return null;
};

const isMostlyPrintable = (value: string): boolean => {
  if (!value) return false;
  let printable = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
      printable += 1;
    }
  }
  return printable / value.length >= 0.8;
};

export const decryptData = (value: string | null | undefined): string => {
  if (!value) return '';

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return String((parsed as { data?: string }).data ?? '');
    }
  } catch {
    // Not JSON
  }

  if (isLikelyBase64(value)) {
    const decoded = decodeBase64(value);
    if (decoded && isMostlyPrintable(decoded)) {
      return decoded;
    }
  }

  return value;
};

export const encryptData = (value: string | null | undefined): string => {
  return value ?? '';
};
