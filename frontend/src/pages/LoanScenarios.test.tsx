import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import LoanScenarios from './LoanScenarios';
import api from '../utils/api';

const { notificationsShowMock } = vi.hoisted(() => ({
  notificationsShowMock: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: notificationsShowMock,
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const baseScenario = {
  id: 'scenario-1',
  clientId: 'client-1',
  name: 'Scenario Alpha',
  status: 'DRAFT',
  loanType: 'PURCHASE',
  amount: 320000,
  interestRate: 6.25,
  termYears: 30,
  preferredProgramId: null,
  updatedAt: '2026-02-10T12:00:00.000Z',
  scenarioData: null,
};

function okJsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  };
}

describe('LoanScenarios delete confirmation flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    notificationsShowMock.mockReset();

    mockedApi.get.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/loan-scenarios') {
        return okJsonResponse([baseScenario]);
      }
      if (endpoint === '/clients') {
        return okJsonResponse([{ id: 'client-1', name: 'Test Client' }]);
      }
      if (endpoint === '/loan-program-templates/active') {
        return okJsonResponse([]);
      }
      return okJsonResponse([]);
    });

    mockedApi.delete.mockResolvedValue(okJsonResponse({ message: 'deleted' }));
  });

  it('requires explicit confirmation before deleting a scenario', async () => {
    const openMenuAndClickDelete = async () => {
      fireEvent.click(screen.getByLabelText('Scenario actions'));
      const deleteMenuItem = await screen.findByRole('menuitem', { name: 'Delete' });
      fireEvent.click(deleteMenuItem);
    };

    render(
      <MantineProvider>
        <LoanScenarios />
      </MantineProvider>,
    );

    await screen.findByText('Scenario Alpha');

    await openMenuAndClickDelete();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Scenario' })).toBeInTheDocument();
    });
    expect(mockedApi.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Delete Scenario' })).not.toBeInTheDocument();
    });
    expect(mockedApi.delete).not.toHaveBeenCalled();

    await openMenuAndClickDelete();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Scenario' }));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith('/loan-scenarios/scenario-1');
    });
  });
});
