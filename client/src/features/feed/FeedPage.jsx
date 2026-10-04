import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { postsApi } from '../../api/resources.js';
import { Button } from '../../components/Button.jsx';
import { PageHeader } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { useToast } from '../../components/Toast.jsx';
import { ROLES } from '../../lib/constants.js';
import { useSession } from '../auth/session.js';
import { Composer } from './Composer.jsx';
import { ContentItem } from './ContentItem.jsx';

const PAGE_SIZE = 10;

function PostCard({ post, viewer, canWrite }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [replying, setReplying] = useState(false);
  const comment = useMutation({
    mutationFn: (body) => postsApi.comment(post._id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      toast('Comment posted. It is checked automatically.');
    },
  });

  return (
    <article className="card card-hover p-5 fade-in">
      <ContentItem item={post} viewer={viewer}>
        {canWrite && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle transition-colors duration-150 hover:text-fg"
          >
            Reply
          </button>
        )}
      </ContentItem>

      {post.comments.length > 0 && (
        <div className="mt-4 flex flex-col gap-4 border-l border-line pl-4">
          {post.comments.map((c) => (
            <ContentItem key={c._id} item={c} viewer={viewer} />
          ))}
        </div>
      )}

      {replying && (
        <div className="mt-4 border-t border-line pt-4">
          <Composer
            compact
            placeholder="Write a comment…"
            submitLabel="Comment"
            mutation={comment}
            onDone={() => setReplying(false)}
          />
        </div>
      )}
    </article>
  );
}

export function FeedPage() {
  const { data: viewer } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const feed = useQuery({
    queryKey: ['feed', limit],
    queryFn: () => postsApi.feed({ limit }),
    placeholderData: (prev) => prev,
  });
  const canWrite = viewer.role === ROLES.AUTHOR;
  const create = useMutation({
    mutationFn: postsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      toast('Posted. It is checked automatically.');
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Community"
        title="Feed"
        description="Every post and comment is checked by fixed rules and an AI reviewer. People make the decisions."
      />

      {canWrite && (
        <div className="card mb-6 p-5">
          <Composer placeholder="Share something…" submitLabel="Post" mutation={create} />
        </div>
      )}

      <QueryState
        query={feed}
        isEmpty={(d) => d.items.length === 0}
        empty={{
          title: 'No posts yet.',
          children: canWrite ? 'Write the first one above.' : 'Posts will appear here.',
        }}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((post) => (
              <PostCard key={post._id} post={post} viewer={viewer} canWrite={canWrite} />
            ))}
            {data.total > data.items.length && (
              <Button
                className="mx-auto mt-3"
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
                busy={feed.isFetching}
                busyLabel="Loading…"
              >
                Show more
              </Button>
            )}
          </div>
        )}
      </QueryState>
    </div>
  );
}
