/**
 * Identity stubs — encryption is not used in this application.
 * Data is stored as plaintext despite column names containing "Encrypted".
 * These functions exist only to avoid breaking imports during migration.
 */
export const decryptData = (value: string | null | undefined): string => {
  return value ?? '';
};

export const encryptData = (value: string | null | undefined): string => {
  return value ?? '';
};
