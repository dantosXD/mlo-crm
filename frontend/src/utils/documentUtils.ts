// Shared document utility functions

import type { ClientDocument } from '../types';

export const isDocumentExpired = (doc: Pick<ClientDocument, 'expiresAt'>): boolean => {
  if (!doc.expiresAt) return false;
  const expiresAt = new Date(doc.expiresAt);
  const today = new Date();
  expiresAt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return expiresAt < today;
};

export const isDocumentExpiringSoon = (doc: Pick<ClientDocument, 'expiresAt'>): boolean => {
  if (!doc.expiresAt) return false;
  const expiresAt = new Date(doc.expiresAt);
  const today = new Date();
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + 30); // 30 days warning
  expiresAt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  warningDate.setHours(0, 0, 0, 0);
  return expiresAt >= today && expiresAt <= warningDate;
};

export const formatCurrency = (value?: number | null): string => {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
