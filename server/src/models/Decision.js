import mongoose from 'mongoose';
import { ACTION, APPEAL_OUTCOME, DECISION_OUTCOME, DECISION_STAGE } from '../constants.js';
import { insertOnly } from './insertOnly.js';

const OUTCOMES = [...new Set([...Object.values(DECISION_OUTCOME), ...Object.values(APPEAL_OUTCOME)])];

// Human decisions. Never edited after creation: an appeal adds a new decision instead.
const decisionSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    stage: { type: String, required: true, enum: Object.values(DECISION_STAGE) },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    outcome: { type: String, required: true, enum: OUTCOMES },
    finalAction: { type: String, required: true, enum: Object.values(ACTION) },
    clauseCodes: { type: [String], default: [] },
    rationale: { type: String, default: '' },
    policyVersion: { type: Number, required: true },
    analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true },
  },
  { timestamps: true },
);

decisionSchema.index({ caseId: 1, createdAt: 1 });
decisionSchema.plugin(insertOnly, { name: 'decisions' });

export const Decision = mongoose.model('Decision', decisionSchema, 'decisions');
