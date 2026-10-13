import { hasComment, safeComment } from './review-comments';
import { preliminaryObject } from './preliminary-review';

export function sharedReviewFeedback(stage: string, snapshot: unknown) {
  const data = preliminaryObject(snapshot);
  const prefix = stage === 'SUPERVISOR' ? 'aml' : stage.toLowerCase();
  const text = (value: unknown) => typeof value === 'string' ? safeComment(value) : '';
  const comments = text(data.formalComments || data.comments || data[`${prefix}Comments`] || (stage === 'SUPERVISOR' ? data.amlClarificationFindings : ''));
  const reason = text(data.reason || data[`${prefix}Reason`]);
  const conditions = text(data.conditions || data[`${prefix}Conditions`]);
  const decisionValue = data.decision || data[`${prefix}Decision`];
  const decision = typeof decisionValue === 'string' ? decisionValue : '';
  if (![comments, reason, conditions].some(hasComment)) return null;
  // Explicit public fields only: never return the snapshot or confidential notes.
  return { comments, reason, conditions, decision };
}
