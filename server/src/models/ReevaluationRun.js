import mongoose from 'mongoose';
import { REEVALUATION_STATUS } from '../constants.js';

const reevaluationRunSchema = new mongoose.Schema(
  {
    fromVersion: { type: Number, required: true },
    toVersion: { type: Number, required: true },
    status: { type: String, required: true, enum: Object.values(REEVALUATION_STATUS) },
    total: { type: Number, required: true, default: 0 },
    processed: { type: Number, required: true, default: 0 },
    skipped: { type: Number, required: true, default: 0 },
    failed: { type: Number, required: true, default: 0 },
    failures: {
      type: [{ caseId: mongoose.Schema.Types.ObjectId, error: String, _id: false }],
      default: [],
    },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const ReevaluationRun = mongoose.model('ReevaluationRun', reevaluationRunSchema, 'reevaluationRuns');
