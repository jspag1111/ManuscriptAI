import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CommentPanel } from '@/components/CommentPanel';
import type { SectionCommentThread } from '@/types';

const baseThread = (overrides: Partial<SectionCommentThread>): SectionCommentThread => ({
  id: 'thread-1',
  createdAt: 1,
  updatedAt: 1,
  createdBy: { userId: 'user-1', name: 'User 1' },
  anchor: null,
  excerpt: '',
  messages: [{ id: 'msg-1', createdAt: 1, author: { userId: 'user-1', name: 'User 1' }, content: 'Hello' }],
  status: 'OPEN',
  ...overrides,
});

describe('CommentPanel', () => {
  it('shows a delete button for threads created by the current user', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDeleteThread = vi.fn();

    render(
      <CommentPanel
        threads={[baseThread({ id: 'thread-mine', createdBy: { userId: 'me', name: 'Me' } })]}
        currentUserId="me"
        selectedThreadId={null}
        filter="ALL"
        onChangeFilter={vi.fn()}
        onSelectThread={vi.fn()}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onReopen={vi.fn()}
        onDeleteThread={onDeleteThread}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByTitle('Delete comment'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onDeleteThread).toHaveBeenCalledWith('thread-mine');
  });

  it('does not show a delete button for threads created by other users', () => {
    render(
      <CommentPanel
        threads={[baseThread({ id: 'thread-other', createdBy: { userId: 'other', name: 'Other' } })]}
        currentUserId="me"
        selectedThreadId={null}
        filter="ALL"
        onChangeFilter={vi.fn()}
        onSelectThread={vi.fn()}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onReopen={vi.fn()}
        onDeleteThread={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTitle('Delete comment')).toBeNull();
  });
});

