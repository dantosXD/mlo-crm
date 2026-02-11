import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextValue {
  userId?: string;
}

const requestContext = new AsyncLocalStorage<RequestContextValue>();

export function runWithRequestContext<T>(
  value: RequestContextValue,
  callback: () => T,
): T {
  return requestContext.run(value, callback);
}

export function setRequestContextUserId(userId: string): void {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
  }
}

export function getRequestContext(): RequestContextValue | undefined {
  return requestContext.getStore();
}
