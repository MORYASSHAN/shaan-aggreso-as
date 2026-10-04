import mongoose from 'mongoose';
import { ACTOR_TYPE, AUDIT } from '../constants.js';
import { insertOnly } from './insertOnly.js';

// Append-only business history. auditService.record() is the only writer.
const auditEventSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true, default: Date.now },
    actor: {
      type: { type: String, required: true, enum: Object.values(ACTOR_TYPE) },
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      role: { type: String, default: null },
    },
    action: { type: String, required: true, enum: Object.values(AUDIT) },
    entity: {
      type: { type: String, required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
    },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    policyVersion: { type: Number, default: null },
    requestId: { type: String, default: null },
  },
  { versionKey: false },
);

auditEventSchema.index({ 'entity.type': 1, 'entity.id': 1, at: -1 });
auditEventSchema.index({ 'actor.id': 1, at: -1 });
auditEventSchema.index({ action: 1, at: -1 });
auditEventSchema.plugin(insertOnly, { name: 'auditEvents' });

export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema, 'auditEvents');
