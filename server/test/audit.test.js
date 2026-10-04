import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ACTOR_TYPE, AUDIT } from '../src/constants.js';
import { AuditEvent } from '../src/models/index.js';
import * as auditService from '../src/services/auditService.js';
import { connect, disconnect, resetDb } from './helpers.js';

describe('audit trail is append-only', () => {
  let event;
  beforeAll(connect);
  afterAll(disconnect);
  beforeEach(async () => {
    const users = await resetDb();
    event = await auditService.record({
      actor: { type: ACTOR_TYPE.SYSTEM },
      action: AUDIT.CASE_OPENED,
      entity: { type: 'case', id: users.admin._id },
    });
  });

  it('throws on every kind of update', async () => {
    await expect(AuditEvent.updateOne({ _id: event._id }, { action: AUDIT.AUTH_LOGIN })).rejects.toThrow(
      /append-only/,
    );
    await expect(AuditEvent.updateMany({}, { action: AUDIT.AUTH_LOGIN })).rejects.toThrow(/append-only/);
    await expect(
      AuditEvent.findOneAndUpdate({ _id: event._id }, { action: AUDIT.AUTH_LOGIN }),
    ).rejects.toThrow(/append-only/);
    event.action = AUDIT.AUTH_LOGIN;
    await expect(event.save()).rejects.toThrow(/append-only/);
  });

  it('throws on every kind of delete', async () => {
    await expect(AuditEvent.deleteOne({ _id: event._id })).rejects.toThrow(/append-only/);
    await expect(AuditEvent.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(AuditEvent.findOneAndDelete({ _id: event._id })).rejects.toThrow(/append-only/);
    expect(await AuditEvent.countDocuments({ _id: event._id })).toBe(1);
  });
});
