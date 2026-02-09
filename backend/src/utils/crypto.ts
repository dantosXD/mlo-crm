import crypto from 'crypto';
import { getEnv } from '../config/env.js';

const ENCRYPTION_KEY = getEnv().ENCRYPTION_KEY;

export function decrypt(encryptedData: string): string {
  try {
    const parsed = JSON.parse(encryptedData);
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      Buffer.from(parsed.iv, 'hex')
    );
    let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedData;
  }
}

export function encrypt(plaintext: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv
    );
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted
    });
  } catch {
    return plaintext;
  }
}
