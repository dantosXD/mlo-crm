/**
 * Error Handler Utility
 * Provides user-friendly error messages for various network and API errors
 */

import { notifications } from '@mantine/notifications';

export interface ApiError extends Error {
  status?: number;
  code?: string;
  isNetworkError?: boolean;
  isTimeout?: boolean;
  isServerError?: boolean;
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyErrorMessage(error: unknown, context: string): string {
  // If it's already a custom API error
  if (isApiError(error)) {
    return getApiErrorMessage(error, context);
  }

  // If it's a standard Error
  if (error instanceof Error) {
    // Network errors (fetch throws TypeError for network failures)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return getNetworkErrorMessage(context);
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return getTimeoutErrorMessage(context);
    }

    // Generic error with message
    if (error.message) {
      return `${context} failed: ${error.message}`;
    }
  }

  // Unknown error type
  return `${context} failed. Please try again.`;
}

/**
 * Check if error is an API error
 */
function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    ('status' in error || 'code' in error || 'isNetworkError' in error)
  );
}

/**
 * Get error message for API errors
 */
function getApiErrorMessage(error: ApiError, context: string): string {
  // Network errors (no connection)
  if (error.isNetworkError) {
    return getNetworkErrorMessage(context);
  }

  // Timeout errors
  if (error.isTimeout) {
    return getTimeoutErrorMessage(context);
  }

  // Server errors (5xx)
  if (error.isServerError || (error.status && error.status >= 500)) {
    return getServerErrorMessage(context);
  }

  // Client errors (4xx)
  if (error.status && error.status >= 400 && error.status < 500) {
    return getClientErrorMessage(error.status, context);
  }

  // Generic API error
  return `${context} failed. Please try again.`;
}

/**
 * Get network error message (connection refused, no internet, etc.)
 */
function getNetworkErrorMessage(context: string): string {
  const messages: Record<string, string> = {
    'loading clients': 'Unable to connect to the server. Please check your internet connection and try again.',
    'creating client': 'Unable to create client due to network issues. Please check your connection and try again.',
    'updating client': 'Unable to save changes due to network issues. Please check your connection and try again.',
    'deleting client': 'Unable to delete client due to network issues. Please check your connection and try again.',
    'loading documents': 'Unable to load documents. Please check your internet connection.',
    'uploading document': 'Document upload failed due to network issues. Please check your connection and try again.',
    'loading notes': 'Unable to load notes. Please check your internet connection.',
    'creating note': 'Unable to create note due to network issues. Please check your connection.',
    'loading tasks': 'Unable to load tasks. Please check your internet connection.',
    'creating task': 'Unable to create task due to network issues. Please check your connection.',
    'loading pipeline': 'Unable to load pipeline data. Please check your internet connection.',
    'loading dashboard': 'Unable to load dashboard. Please check your internet connection.',
    'loading analytics': 'Unable to load analytics. Please check your internet connection.',
  };

  return messages[context.toLowerCase()] || `${context} failed. Please check your internet connection and try again.`;
}

/**
 * Get timeout error message
 */
function getTimeoutErrorMessage(context: string): string {
  const messages: Record<string, string> = {
    'loading clients': 'Request timed out while loading clients. The server may be busy. Please try again.',
    'creating client': 'Request timed out while creating client. Please try again.',
    'updating client': 'Request timed out while saving changes. Please try again.',
    'deleting client': 'Request timed out while deleting client. Please try again.',
    'loading documents': 'Request timed out while loading documents. Please try again.',
    'uploading document': 'Upload timed out. The file may be too large or the server busy. Please try again.',
  };

  return messages[context.toLowerCase()] || `${context} timed out. Please try again.`;
}

/**
 * Get server error message (5xx)
 */
function getServerErrorMessage(context: string): string {
  return `Server error occurred while ${context.toLowerCase()}. This is not your fault. Please try again later or contact support if the problem persists.`;
}

/**
 * Get client error message (4xx)
 */
function getClientErrorMessage(status: number, context: string): string {
  switch (status) {
    case 400:
      return `Invalid request for ${context.toLowerCase()}. Please check your input and try again.`;
    case 401:
      return 'You are not logged in. Please sign in and try again.';
    case 403:
      return `You don't have permission to complete this action. ${context.toLowerCase()} failed.`;
    case 404:
      return `The requested resource was not found. ${context.toLowerCase()} failed.`;
    case 409:
      return `Conflict occurred while ${context.toLowerCase()}. The data may have been modified by another user. Please refresh and try again.`;
    case 422:
      return `Validation error while ${context.toLowerCase()}. Please check your input and try again.`;
    case 429:
      return `Too many requests. Please wait a moment and try ${context.toLowerCase()} again.`;
    default:
      return `${context} failed. Please try again.`;
  }
}

/**
 * Handle fetch error with user-friendly notification
 */
export function handleFetchError(error: unknown, context: string): void {
  const message = getUserFriendlyErrorMessage(error, context);

  notifications.show({
    title: 'Connection Error',
    message,
    color: 'red',
    autoClose: 8000, // Show longer for network errors so users can read it
  });
}

/**
 * Wrap fetch with automatic error handling
 */
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit,
  context: string = 'Request'
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: ApiError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.isServerError = response.status >= 500;
      throw error;
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError: ApiError = new Error('Request timeout');
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      const networkError: ApiError = new Error('Network error');
      networkError.isNetworkError = true;
      throw networkError;
    }

    throw error;
  }
}

/**
 * Show retry notification with action button
 */
export function showRetryNotification(
  message: string,
  onRetry: () => void
): void {
  notifications.show({
    title: 'Connection Error',
    message,
    color: 'red',
    autoClose: false, // Keep visible until user dismisses or retries
    withCloseButton: true,
    action: {
      label: 'Retry',
      onClick: () => {
        onRetry();
        notifications.hide();
      },
    },
  });
}
