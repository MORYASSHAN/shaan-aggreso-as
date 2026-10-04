import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { QueryState } from '../src/components/QueryState.jsx';

const base = { isLoading: false, isError: false, error: null, data: null, refetch: vi.fn() };

describe('QueryState', () => {
  it('shows a loading skeleton while the request runs', () => {
    render(<QueryState query={{ ...base, isLoading: true }}>{() => 'data'}</QueryState>);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('shows the empty sentence and next step', () => {
    render(
      <QueryState
        query={{ ...base, data: { items: [] } }}
        isEmpty={(d) => d.items.length === 0}
        empty={{ title: 'Queue is clear.', children: 'New reports will appear here.' }}
      >
        {() => 'data'}
      </QueryState>,
    );
    expect(screen.getByText('Queue is clear.')).toBeInTheDocument();
    expect(screen.getByText('New reports will appear here.')).toBeInTheDocument();
  });

  it('shows the server message, request id and a Retry button on failure', async () => {
    const refetch = vi.fn();
    const error = new ApiError({
      status: 500,
      code: 'INTERNAL',
      message: 'Something went wrong.',
      requestId: 'req-123',
    });
    render(<QueryState query={{ ...base, isError: true, error, refetch }}>{() => 'data'}</QueryState>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByText(/req-123/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('offers Reload instead of Retry for a 409', () => {
    const error = new ApiError({
      status: 409,
      code: 'STALE_ANALYSIS',
      message: 'Reload to see the new analysis.',
      requestId: 'r',
    });
    render(<QueryState query={{ ...base, isError: true, error }}>{() => 'data'}</QueryState>);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('renders the data when there is something to show', () => {
    render(<QueryState query={{ ...base, data: { n: 3 } }}>{(d) => `count ${d.n}`}</QueryState>);
    expect(screen.getByText('count 3')).toBeInTheDocument();
  });
});
