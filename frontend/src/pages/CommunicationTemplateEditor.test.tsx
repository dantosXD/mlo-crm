import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunicationTemplateEditor } from './CommunicationTemplateEditor';

const mockGet = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

describe('CommunicationTemplateEditor failure fallback', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('navigates back to templates list when template load fails', async () => {
    mockGet.mockImplementation(async (path: string) => {
      if (path.includes('/meta/')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      return {
        ok: false,
        json: async () => ({}),
      };
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/communication-templates/abc/edit']}>
            <Routes>
              <Route path="/communication-templates/:id/edit" element={<CommunicationTemplateEditor />} />
              <Route path="/communication-templates" element={<div>templates-list-page</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('templates-list-page')).toBeInTheDocument();
    });
  });
});
