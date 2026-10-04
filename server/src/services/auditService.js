import { ACTOR_TYPE, AUDIT } from '../constants.js';
import { AuditEvent } from '../models/index.js';
import { logger } from '../logger.js';

// Strip fields that must never be stored in the business history.
function snapshot(value) {
  if (value == null) return null;
  const plain = typeof value.toObject === 'function' ? value.toObject({ depopulate: true }) : value;
  const copy = JSON.parse(JSON.stringify(plain));
  delete copy.passwordHash;
  delete copy.password;
  return copy;
}

function toAuditActor(actor) {
  if (!actor || actor.type !== ACTOR_TYPE.USER)
    return { type: actor?.type ?? ACTOR_TYPE.SYSTEM, id: null, role: null };
  return { type: ACTOR_TYPE.USER, id: actor.id, role: actor.role ?? null };
}

/**
 * The only writer of audit events, and it only inserts.
 * Pass the transaction session so the event commits (or rolls back) with the change it describes.
 */
export async function record({ actor, action, entity, before, after, policyVersion, requestId }, session) {
  const [event] = await AuditEvent.create(
    [
      {
        at: new Date(),
        actor: toAuditActor(actor),
        action,
        entity: { type: entity.type, id: entity.id },
        before: snapshot(before),
        after: snapshot(after),
        policyVersion: policyVersion ?? null,
        requestId: requestId ?? null,
      },
    ],
    { session },
  );
  return event;
}

/** Records a blocked action. Never throws: a failed audit write must not hide the original denial. */
export async function recordDenied({ actor, reason, entity, requestId }) {
  try {
    await record({ actor, action: AUDIT.AUTH_DENIED, entity, after: { reason }, requestId });
  } catch (err) {
    logger.error({ err, requestId }, 'failed to record auth.denied');
  }
}

export async function list({ entityType, entityId, actorId, action, from, to, page, limit }) {
  const filter = {};
  if (entityType) filter['entity.type'] = entityType;
  if (entityId) filter['entity.id'] = entityId;
  if (actorId) filter['actor.id'] = actorId;
  if (action) filter.action = action;
  if (from || to) filter.at = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  const [items, total] = await Promise.all([
    AuditEvent.find(filter)
      .sort({ at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor.id', 'name role')
      .lean(),
    AuditEvent.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function listForEntities(entityIds) {
  return AuditEvent.find({ 'entity.id': { $in: entityIds } })
    .sort({ at: 1, _id: 1 })
    .populate('actor.id', 'name role')
    .lean();
}
