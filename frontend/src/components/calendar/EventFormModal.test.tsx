import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/testUtils';
import { EventFormModal } from './EventFormModal';

const apiRequestMock = vi.fn();

vi.mock('../../utils/api', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

function okResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  };
}

describe('EventFormModal client payload normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when /clients returns an array payload', async () => {
    apiRequestMock.mockResolvedValueOnce(
      okResponse([{ id: 'client-1', name: 'Array Client' }]),
    );

    renderWithProviders(
      <EventFormModal opened onClose={() => {}} onSuccess={() => {}} />,
    );

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/clients?limit=100');
    });
    expect(await screen.findByText('Create Event')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Link to Client (Optional)' })).toBeInTheDocument();
  });

  it('renders when /clients returns an object payload with data[]', async () => {
    apiRequestMock.mockResolvedValueOnce(
      okResponse({ data: [{ id: 'client-2', name: 'Object Client' }] }),
    );

    renderWithProviders(
      <EventFormModal opened onClose={() => {}} onSuccess={() => {}} />,
    );

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/clients?limit=100');
    });
    expect(await screen.findByText('Create Event')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Link to Client (Optional)' })).toBeInTheDocument();
  });

  it('renders safely when /clients returns a malformed payload', async () => {
    apiRequestMock.mockResolvedValueOnce(okResponse({ unexpected: true }));

    renderWithProviders(
      <EventFormModal opened onClose={() => {}} onSuccess={() => {}} />,
    );

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/clients?limit=100');
    });
    expect(await screen.findByText('Create Event')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Link to Client (Optional)' })).toBeInTheDocument();
  });

  it('defaults end time to one hour after start for new events', async () => {
    apiRequestMock.mockResolvedValueOnce(okResponse([]));

    renderWithProviders(
      <EventFormModal
        opened
        onClose={() => {}}
        onSuccess={() => {}}
        selectedDate={new Date('2026-02-25T10:00:00.000Z')}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('input[name="startTime"]')).toBeInTheDocument();
      expect(document.querySelector('input[name="endTime"]')).toBeInTheDocument();
    });

    const startInput = document.querySelector('input[name="startTime"]') as HTMLInputElement;
    const endInput = document.querySelector('input[name="endTime"]') as HTMLInputElement;
    const startValue = startInput.value;
    const endValue = endInput.value;

    const startDate = new Date(`${startValue}:00`);
    const endDate = new Date(`${endValue}:00`);
    const diffMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

    expect(diffMinutes).toBe(60);
  });

  it('keeps end time synced to start time until manually edited', async () => {
    apiRequestMock.mockResolvedValueOnce(okResponse([]));

    renderWithProviders(
      <EventFormModal opened onClose={() => {}} onSuccess={() => {}} />,
    );

    await waitFor(() => {
      expect(document.querySelector('input[name="startTime"]')).toBeInTheDocument();
      expect(document.querySelector('input[name="endTime"]')).toBeInTheDocument();
    });

    const startInput = document.querySelector('input[name="startTime"]') as HTMLInputElement;
    const endInput = document.querySelector('input[name="endTime"]') as HTMLInputElement;

    fireEvent.change(startInput, { target: { value: '2026-03-01T09:00' } });
    expect(endInput.value).toBe('2026-03-01T10:00');

    fireEvent.change(endInput, { target: { value: '2026-03-01T12:30' } });
    fireEvent.change(startInput, { target: { value: '2026-03-01T10:00' } });
    expect(endInput.value).toBe('2026-03-01T12:30');
  });
});
