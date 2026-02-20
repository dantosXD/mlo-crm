import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TemplatesHub from './TemplatesHub';
import { renderWithProviders } from '../test/testUtils';

const mocks = vi.hoisted(() => ({
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  createReminder: vi.fn(),
  updateReminder: vi.fn(),
  deleteReminder: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useNoteTemplates: () => ({
    data: [
      { id: 'note-system', name: 'System Note', description: 'Default', content: 'Body', tags: [], isSystem: true },
      { id: 'note-personal', name: 'My Note', description: 'Mine', content: 'Personal body', tags: ['mine'], isSystem: false },
    ],
    isLoading: false,
  }),
  useCreateNoteTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.createNote(...args), isPending: false }),
  useUpdateNoteTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.updateNote(...args), isPending: false }),
  useDeleteNoteTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.deleteNote(...args), isPending: false }),

  useTaskTemplates: () => ({
    data: [
      { id: 'task-system', name: 'System Task', text: 'Task', type: 'GENERAL', priority: 'MEDIUM', tags: [], steps: [], dueDays: null, isSystem: true },
      { id: 'task-personal', name: 'My Task', text: 'Mine', type: 'FOLLOW_UP', priority: 'HIGH', tags: [], steps: [], dueDays: 1, isSystem: false },
    ],
    isLoading: false,
  }),
  useCreateTaskTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.createTask(...args), isPending: false }),
  useUpdateTaskTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.updateTask(...args), isPending: false }),
  useDeleteTaskTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.deleteTask(...args), isPending: false }),

  useReminderTemplates: () => ({
    data: [
      { id: 'rem-system', name: 'System Reminder', description: null, config: { category: 'GENERAL', priority: 'MEDIUM' }, isSystem: true },
      { id: 'rem-personal', name: 'My Reminder', description: 'Mine', config: { category: 'FOLLOW_UP', priority: 'HIGH' }, isSystem: false },
    ],
    isLoading: false,
  }),
  useCreateReminderTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.createReminder(...args), isPending: false }),
  useUpdateReminderTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.updateReminder(...args), isPending: false }),
  useDeleteReminderTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.deleteReminder(...args), isPending: false }),

  useActivityTemplates: () => ({
    data: [
      { id: 'act-system', name: 'System Activity', description: null, config: { type: 'INTERACTION_OTHER' }, autoFollowUp: null, isSystem: true },
      { id: 'act-personal', name: 'My Activity', description: 'Mine', config: { type: 'CALL_PLACED' }, autoFollowUp: { kind: 'TASK' }, isSystem: false },
    ],
    isLoading: false,
  }),
  useCreateActivityTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.createActivity(...args), isPending: false }),
  useUpdateActivityTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.updateActivity(...args), isPending: false }),
  useDeleteActivityTemplate: () => ({ mutateAsync: (...args: unknown[]) => mocks.deleteActivity(...args), isPending: false }),
}));

describe('TemplatesHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createNote.mockResolvedValue({ id: 'created-note-template' });
    mocks.deleteTask.mockResolvedValue({ message: 'deleted' });
  });

  it('renders all tabs and keeps system templates read-only', async () => {
    renderWithProviders(<TemplatesHub />, '/templates?tab=notes');

    expect(screen.getByRole('tab', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Reminders' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Activities' })).toBeInTheDocument();

    expect(screen.getByText('System Note')).toBeInTheDocument();
    const systemCard = screen.getByText('System Note').closest('.mantine-Card-root');
    const personalCard = screen.getByText('My Note').closest('.mantine-Card-root');
    expect(systemCard).not.toBeNull();
    expect(personalCard).not.toBeNull();
    expect(within(systemCard as HTMLElement).queryByLabelText('Edit template')).not.toBeInTheDocument();
    expect(within(systemCard as HTMLElement).queryByLabelText('Delete template')).not.toBeInTheDocument();
    expect(within(personalCard as HTMLElement).getByLabelText('Edit template')).toBeInTheDocument();
    expect(within(personalCard as HTMLElement).getByLabelText('Delete template')).toBeInTheDocument();
  });

  it('supports create in notes tab and delete in tasks tab', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders(<TemplatesHub />, '/templates?tab=notes');

    fireEvent.click(screen.getByRole('button', { name: /New Note Template/i }));
    const noteModal = await screen.findByRole('dialog');
    fireEvent.change(within(noteModal).getAllByRole('textbox')[0], { target: { value: 'New Loan Note' } });
    fireEvent.change(within(noteModal).getAllByRole('textbox')[2], { target: { value: 'Template content' } });
    fireEvent.click(within(noteModal).getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(mocks.createNote).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Loan Note',
        content: 'Template content',
      }));
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Tasks' }));
    const taskCard = await screen.findByText('My Task');
    fireEvent.click(within(taskCard.closest('.mantine-Card-root') as HTMLElement).getByLabelText('Delete template'));

    await waitFor(() => {
      expect(mocks.deleteTask).toHaveBeenCalledWith('task-personal');
    });

    confirmSpy.mockRestore();
  });
});
