import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Communications } from './Communications';
import { renderWithProviders } from '../test/testUtils';
import { COMM_STATUS_FILTER_OPTIONS } from '../utils/constants';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mocks.get(...args),
    post: (...args: unknown[]) => mocks.post(...args),
    put: (...args: unknown[]) => mocks.put(...args),
  },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', role: 'MLO', name: 'MLO User' },
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

function createResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  };
}

describe('Communications filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(createResponse({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }));
  });

  it('clears applied search and checkbox filters when "Clear Filters" is clicked', async () => {
    renderWithProviders(<Communications />, '/communications');

    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText('Search by client name, subject, or body...');
    fireEvent.change(searchInput, { target: { value: 'Beta Borrower' } });
    fireEvent.keyPress(searchInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      const calledWithSearch = mocks.get.mock.calls.some((call) => String(call[0]).includes('q=Beta'));
      expect(calledWithSearch).toBe(true);
    });

    fireEvent.click(screen.getByLabelText('Scheduled only'));
    fireEvent.click(screen.getByLabelText('Follow-up due'));

    await waitFor(() => {
      const calls = mocks.get.mock.calls;
      const latest = String(calls[calls.length - 1]?.[0] || '');
      expect(latest).toContain('scheduled=true');
      expect(latest).toContain('follow_up=true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    await waitFor(() => {
      const calls = mocks.get.mock.calls;
      const latest = String(calls[calls.length - 1]?.[0] || '');
      expect(latest).not.toContain('q=');
      expect(latest).not.toContain('scheduled=true');
      expect(latest).not.toContain('follow_up=true');
      expect(latest).not.toContain('start_date=');
      expect(latest).not.toContain('end_date=');
      expect(latest).toContain('page=1');
    });
  });

  it('exposes only supported communication statuses in status-filter options', () => {
    expect(COMM_STATUS_FILTER_OPTIONS).toEqual([
      { value: 'all', label: 'All Statuses' },
      { value: 'DRAFT', label: 'Draft' },
      { value: 'READY', label: 'Ready' },
      { value: 'SENT', label: 'Sent' },
      { value: 'FAILED', label: 'Failed' },
    ]);
  });
});
