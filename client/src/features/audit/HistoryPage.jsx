import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { contentApi } from '../../api/resources.js';
import { VisibilityBadge } from '../../components/Badge.jsx';
import { PageHeader, Section } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { Timeline } from './Timeline.jsx';

/** Moderation history of one item. Authors see their own; moderators see any. */
export function HistoryPage() {
  const { id } = useParams();
  const history = useQuery({ queryKey: ['history', id], queryFn: () => contentApi.history(id) });
  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="label mb-6 inline-block hover:text-fg"
      >
        ‹ Back
      </button>
      <PageHeader eyebrow="Moderation history" title="History" />
      <QueryState query={history}>
        {(data) => (
          <div className="flex flex-col gap-4">
            <Section
              title={data.content.type}
              aside={<VisibilityBadge visibility={data.content.visibility} />}
            >
              <p className="whitespace-pre-wrap break-words px-5 py-4 text-[15px] leading-relaxed">
                {data.content.body}
              </p>
            </Section>
            <section className="card p-5">
              {data.audit.length ? (
                <Timeline events={data.audit} />
              ) : (
                <p className="text-sm text-subtle">No events yet.</p>
              )}
            </section>
          </div>
        )}
      </QueryState>
    </div>
  );
}
