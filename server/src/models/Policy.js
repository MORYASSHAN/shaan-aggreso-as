import mongoose from 'mongoose';
import { POLICY_STATUS } from '../constants.js';

const policySchema = new mongoose.Schema(
  {
    version: { type: Number, required: true, unique: true, min: 1 },
    status: { type: String, required: true, enum: Object.values(POLICY_STATUS) },
    effectiveFrom: { type: String },
    // Clauses are validated by the policy Zod schema before they are stored.
    clauses: { type: [mongoose.Schema.Types.Mixed], required: true },
    changelog: { type: String, default: '' },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Exactly one version is active: the database refuses a second one.
policySchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: POLICY_STATUS.ACTIVE }, name: 'one_active_policy' },
);

export const Policy = mongoose.model('Policy', policySchema, 'policies');
