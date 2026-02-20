import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddNoteModal } from './AddNoteModal';
import { renderWithProviders } from '../../../test/testUtils';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mocks.get(...args),
    post: (...args: unknown[]) => mocks.post(...args),
  },
}));

function createResponse(ok: boolean, payload: unknown) {
  return {
    ok,
    json: async () => payload,
  };
}

describe('AddNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation(async (path: string) => {
      if (path === '/notes/templates/list') {
        return createResponse(true, [
          { id: 'tpl-1', name: 'Welcome Note', content: 'Template note body', tags: ['intro', 'follow-up'] },
        ]);
      }
      return createResponse(false, {});
    });
    mocks.post.mockImplementation(async (path: string) => {
      if (path === '/notes') {
        return createResponse(true, { id: 'note-1' });
      }
      if (path === '/notes/templates') {
        return createResponse(true, { id: 'note-template-1' });
      }
      return createResponse(false, {});
    });
  });

  it('applies selected template content/tags and uses them in create payload', async () => {
    renderWithProviders(
      <AddNoteModal
        opened
        onClose={vi.fn()}
        clientId="client-1"
        existingNoteTags={[]}
      />,
    );

    const templateSelect = await screen.findByRole('textbox', { name: /Use Template/i });
    fireEvent.click(templateSelect);
    fireEvent.click(await screen.findByText('Welcome Note'));

    expect(screen.getByPlaceholderText('Enter your note...')).toHaveValue('Template note body');

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/notes', {
        clientId: 'client-1',
        text: 'Template note body',
        tags: ['intro', 'follow-up'],
      });
    });
  });

  it('saves template from current note form', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Saved Note Template');

    renderWithProviders(
      <AddNoteModal
        opened
        onClose={vi.fn()}
        clientId="client-1"
        existingNoteTags={[]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Enter your note...'), {
      target: { value: 'Follow up with borrower' },
    });
    fireEvent.change(screen.getByPlaceholderText('Add tags (press Enter to add)'), {
      target: { value: 'urgent' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('Add tags (press Enter to add)'), { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: /Save as Template/i }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/notes/templates', {
        name: 'Saved Note Template',
        content: 'Follow up with borrower',
        tags: ['urgent'],
      });
    });

    promptSpy.mockRestore();
  });
});
