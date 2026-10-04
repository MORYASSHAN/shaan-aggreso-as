import { AiTimeoutError } from './errors.js';

/**
 * Deterministic stand-in for Claude (AI_PROVIDER=mock). Tests and local development never need the real API.
 * Markers in the text force each failure path on purpose:
 *   [mock:timeout] [mock:error] [mock:invalid] [mock:repair] [mock:fakequote] [mock:badclause] [mock:disallowed]
 * Without a marker it applies a few simple heuristics so seeded demo content gets realistic output.
 */
export const MOCK_MODEL = 'mock-reviewer';

const RANK = { none: 0, label: 1, limit: 2, remove: 3 };
const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3 };

function firstMatch(text, regex) {
  const m = text.match(regex);
  return m ? m[0] : null;
}

function finding(clause_code, quotes, { interpretation = null, severity, confidence, action }) {
  return {
    clause_code,
    evidence: quotes.filter(Boolean).map((quote) => ({ quote })),
    interpretation,
    severity,
    severity_reason: `Mock: ${severity} severity for ${clause_code}.`,
    confidence,
    confidence_reason: `Mock: heuristic match for ${clause_code}.`,
    action,
  };
}

const HEURISTICS = [
  (text) => {
    const quoted = firstMatch(text, /["“'‘][^"”'’]*(worthless idiot|idiot|moron)[^"”'’]*["”'’]/i);
    if (quoted && /\b(said|called|reported|according|protesters|reporter|quoted)\b/i.test(text)) {
      return finding('HAR-1', [quoted], {
        interpretation:
          'Interpretation: the insult is quoted in a news-style report, not aimed by the author at anyone.',
        severity: 'low',
        confidence: 0.55,
        action: 'none',
      });
    }
    const insult = firstMatch(
      text,
      /\b(you are|you're|ur) (a |an )?(worthless idiot|idiot|moron|loser|pathetic)\b/i,
    );
    if (insult) {
      return finding('HAR-1', [insult], {
        interpretation: 'Interpretation: a direct insult aimed at another user.',
        severity: 'medium',
        confidence: 0.86,
        action: 'remove',
      });
    }
    return null;
  },
  (text) => {
    const sarcasm = firstMatch(
      text,
      /\b(oh (wow|great|sure)|what a genius|truly brilliant|nice going)\b[^.!?]*[.!?]?/i,
    );
    if (!sarcasm) return null;
    return finding('HAR-1', [sarcasm], {
      interpretation: 'Interpretation: possibly sarcastic mockery of another user; the tone is ambiguous.',
      severity: 'low',
      confidence: 0.55,
      action: 'label',
    });
  },
  (text) => {
    const ugly = firstMatch(text, /\b(ugly|hideous) (face|haircut|outfit)\b/i);
    if (!ugly) return null;
    return finding('HAR-1', [ugly], {
      interpretation: "Interpretation: mocks a person's appearance.",
      severity: 'medium',
      confidence: 0.8,
      action: 'label',
    });
  },
  (text) => {
    const threat = firstMatch(text, /\bi(?:'m| am| will|'ll) (?:going to )?(?:kill|hurt|beat) you\b/i);
    if (!threat) return null;
    return finding('VIO-1', [threat], { severity: 'high', confidence: 0.9, action: 'remove' });
  },
  (text) => {
    const distress = firstMatch(
      text,
      /\b(want to disappear|end it all|feel (so )?hopeless|can't go on|no point anymore)\b/i,
    );
    if (!distress) return null;
    return finding('SH-1', [distress], {
      interpretation: 'Interpretation: a personal disclosure of low mood, not encouragement of self-harm.',
      severity: 'high',
      confidence: 0.7,
      action: 'none',
    });
  },
  (text) => {
    const email = firstMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phone = firstMatch(text, /\+?\d(?:[\s().-]?\d){8,14}/);
    if (!email && !phone) return null;
    return finding('PII-1', [email, phone], { severity: 'high', confidence: 0.9, action: 'limit' });
  },
  (text, policy) => {
    const threshold = policy.clauses.find((c) => c.code === 'SPAM-1')?.deterministic?.linkThreshold;
    const links = text.match(/\bhttps?:\/\/[^\s<>"')]+/gi) ?? [];
    if (!threshold || links.length < threshold) return null;
    return finding('SPAM-1', links, { severity: 'low', confidence: 0.85, action: 'label' });
  },
  (text) => {
    const claim = firstMatch(text, /\bi am (the )?(real|official) @?\w+/i);
    if (!claim) return null;
    return finding('IMP-1', [claim], { severity: 'medium', confidence: 0.75, action: 'label' });
  },
];

function heuristicReview(text, policy) {
  const codes = new Set(policy.clauses.map((c) => c.code));
  const found = HEURISTICS.map((h) => h(text, policy)).filter((f) => f && codes.has(f.clause_code));
  const injection = /\bignore (all |your |the |previous )*(rules|instructions)\b/i.test(text);
  const action = found.reduce((best, f) => (RANK[f.action] > RANK[best] ? f.action : best), 'none');
  const severity = found.reduce(
    (best, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[best] ? f.severity : best),
    'none',
  );
  const confidence = found.length ? Math.min(...found.map((f) => f.confidence)) : injection ? 0.6 : 0.95;
  const reasons = [];
  if (injection)
    reasons.push('Content tries to instruct the reviewer to ignore its rules; treated as content.');
  if (found.some((f) => f.interpretation)) reasons.push('Meaning depends on context or interpretation.');
  return {
    findings: found.map(({ action: _a, ...f }) => f),
    proposed_action: action,
    overall_severity: severity,
    overall_confidence: confidence,
    needs_human_review: action !== 'none' || confidence < 0.7 || reasons.length > 0,
    needs_human_reasons: reasons,
    summary: found.length
      ? `Mock review: ${found.map((f) => f.clause_code).join(', ')} may apply.`
      : injection
        ? 'Mock review: no policy violation, but the text contains an instruction aimed at the reviewer.'
        : 'Mock review: no policy clause applies.',
  };
}

function markerReview(text, policy) {
  if (text.includes('[mock:fakequote]')) {
    return {
      ...heuristicReview('', policy),
      findings: [
        finding('HAR-1', ['this sentence is not in the post'], { severity: 'medium', confidence: 0.9 }),
      ],
      proposed_action: 'label',
      overall_severity: 'medium',
      overall_confidence: 0.9,
      needs_human_review: true,
    };
  }
  if (text.includes('[mock:badclause]')) {
    return {
      ...heuristicReview('', policy),
      findings: [finding('XYZ-9', ['[mock:badclause]'], { severity: 'medium', confidence: 0.9 })],
      proposed_action: 'label',
      overall_severity: 'medium',
      overall_confidence: 0.9,
      needs_human_review: true,
    };
  }
  if (text.includes('[mock:disallowed]')) {
    return {
      ...heuristicReview('', policy),
      findings: [finding('SPAM-1', ['[mock:disallowed]'], { severity: 'low', confidence: 0.9 })],
      proposed_action: 'remove',
      overall_severity: 'low',
      overall_confidence: 0.9,
      needs_human_review: true,
    };
  }
  return null;
}

function stripAction(review) {
  return { ...review, findings: review.findings.map(({ action: _a, ...f }) => f) };
}

function review({ text, policy, isRepair }) {
  if (text.includes('[mock:timeout]')) throw new AiTimeoutError('Mock timeout');
  if (text.includes('[mock:error]')) throw new Error('Mock API error');
  if (text.includes('[mock:invalid]'))
    return { findings: 'not-an-array', proposed_action: 'delete-everything' };
  if (text.includes('[mock:repair]') && !isRepair) return { summary: 42 };
  return stripAction(markerReview(text, policy) ?? heuristicReview(text, policy));
}

function appealSummary({ statement, policyChanged }) {
  const firstSentence = statement.split(/(?<=[.!?])\s/)[0];
  return {
    summary: `Mock summary: the author disputes the decision. They say: "${firstSentence.slice(0, 200)}"`,
    new_points: statement.length > 80 ? ['The author adds context that was not in the original post.'] : [],
    policy_changed: policyChanged,
  };
}

export const mockClient = {
  model: MOCK_MODEL,
  async callTool({ tool, meta }) {
    const input = tool.name === 'submit_review' ? review(meta) : appealSummary(meta);
    return { input, model: MOCK_MODEL, inputTokens: 0, outputTokens: 0 };
  },
};
