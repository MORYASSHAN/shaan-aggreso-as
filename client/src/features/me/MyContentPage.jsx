import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { contentApi } from '../../api/resources.js';
import { ActionBadge, Badge, StatusBadge, VersionBadge, VisibilityBadge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { PageHeader } from '../../components/Page.jsx';
import { QueryState } from '../../components/QueryState.jsx';
import { dateTime, humanize, timeAgo } from '../../lib/format.js';
import { AppealForm } from './AppealForm.jsx';

function DecisionRow({ decision }) {
  const [appealing, setAppealing] = useState(false);
  return (
    <div className="border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="label">{decision.stage === 'appeal' ? 'Appeal outcome' : 'Decision'}</span>
        <ActionBadge action={decision.finalAction} />
        {decision.clauseCodes.map((code) => (
          <Badge key={code}>{code}</Badge>
        ))}
        <VersionBadge version={decision.policyVersion} prefix="Decided under " />
        <span className="font-mono text-[11px] text-subtle">{timeAgo(decision.createdAt)}</span>
      </div>
      {decision.rationale && <p className="mt-2 text-sm text-muted">{decision.rationale}</p>}
      {decision.appeal && (
        <p className="mt-2 text-xs text-subtle">
          Appeal {decision.appeal.status === 'resolved' ? 'resolved' : 'pending review'} · sent{' '}
          {timeAgo(decision.appeal.createdAt)}
        </p>
      )}
      {decision.canAppeal && !appealing && (
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={() => setAppealing(true)}>
            Appeal
          </Button>
          <span className="text-xs text-subtle">Until {dateTime(decision.appealDeadline)}</span>
        </div>
      )}
      {appealing && <AppealForm decision={decision} onClose={() => setAppealing(false)} />}
    </div>
  );
}

function ContentCard({ item }) {
  const latest = item.cases.at(-1);
  const decisions = item.cases.flatMap((k) => k.decisions);
  return (
    <article className="card card-hover p-5 fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{item.type}</Badge>
        <VisibilityBadge visibility={item.visibility} />
        {latest && <StatusBadge status={latest.status} />}
        <span className="ml-auto font-mono text-[11px] text-subtle">{timeAgo(item.createdAt)}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{item.body}</p>
      {latest && !decisions.length && (
        <p className="mt-3 text-xs text-subtle">
          {latest.status === 'auto_cleared'
            ? 'Checked and cleared. No action needed.'
            : `${humanize(latest.status)}. No decision yet.`}
        </p>
      )}
      {decisions.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {decisions.map((d) => (
            <DecisionRow key={d._id} decision={d} />
          ))}
        </div>
      )}
      <Link
        to={`/content/${item._id}/history`}
        className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.08em] text-subtle hover:text-fg"
      >
        History ›
      </Link>
    </article>
  );
}

export function MyContentPage() {
  const mine = useQuery({ queryKey: ['my-content'], queryFn: contentApi.mine });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Your posts and comments"
        title="My content"
        description="See every decision on your content, the rule it was based on and the policy version. You can appeal within 14 days."
      />
      <QueryState
        query={mine}
        isEmpty={(d) => d.items.length === 0}
        empty={{
          title: "You haven't posted anything yet.",
          children: 'Your posts and comments will appear here with their review status.',
        }}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((item) => (
              <ContentCard key={item._id} item={item} />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
