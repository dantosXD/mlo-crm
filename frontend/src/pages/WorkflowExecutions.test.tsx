import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/testUtils';
import { WorkflowExecutions } from './WorkflowExecutions';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

function response(payload: unknown, ok = true) {
  return {
    ok,
    json: async () => payload,
  };
}

describe('WorkflowExecutions search behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGetMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/workflow-executions?')) {
        return response({
          executions: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        });
      }
      return response({}, false);
    });
    apiPostMock.mockResolvedValue(response({}, true));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces search query by 350ms before applying backend filter', async () => {
    renderWithProviders(<WorkflowExecutions />, '/workflows?tab=executions');

    const search = await screen.findByPlaceholderText('Search by workflow name or execution ID...');
    const hasSearchCall = () => apiGetMock.mock.calls.some(([url]) =>
      typeof url === 'string' && url.includes('search=no-match'),
    );

    vi.useFakeTimers();
    fireEvent.change(search, { target: { value: 'no-match' } });

    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(hasSearchCall()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(hasSearchCall()).toBe(true);
  });

  it('applies search immediately on Enter key', async () => {
    renderWithProviders(<WorkflowExecutions />, '/workflows?tab=executions');

    const search = await screen.findByPlaceholderText('Search by workflow name or execution ID...');
    const hasSearchCall = () => apiGetMock.mock.calls.some(([url]) =>
      typeof url === 'string' && url.includes('search=instant-match'),
    );

    vi.useFakeTimers();
    fireEvent.change(search, { target: { value: 'instant-match' } });
    fireEvent.keyDown(search, { key: 'Enter', code: 'Enter' });

    await act(async () => {
      await Promise.resolve();
    });
    expect(hasSearchCall()).toBe(true);
  });
});
