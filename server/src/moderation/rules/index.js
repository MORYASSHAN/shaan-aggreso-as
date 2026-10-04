import { contactRule } from './contactRule.js';
import { keywordRule } from './keywordRule.js';
import { linkCountRule } from './linkCountRule.js';
import { patternRule } from './patternRule.js';
import { repeatRule } from './repeatRule.js';

// Each rule is a small pure function (text, policy, context) => findings. Adding one never touches the others.
export const RULES = [keywordRule, patternRule, linkCountRule, contactRule, repeatRule];

/** Runs every rule and returns all findings. Rules never decide anything. */
export function runRules(text, policy, context = {}) {
  return RULES.flatMap((rule) => rule(text, policy, context));
}

/** Always-escalate clauses (e.g. SH-1) force needsHuman and top priority. */
export function escalatingClauses(policy) {
  return new Set(
    policy.clauses.filter((clause) => clause.deterministic?.alwaysEscalate).map((clause) => clause.code),
  );
}
