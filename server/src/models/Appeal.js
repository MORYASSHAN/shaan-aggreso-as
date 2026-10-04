import mongoose from 'mongoose';
import { APPEAL_STATUS, LIMITS } from '../constants.js';

const aiSummarySchema = new mongoose.Schema(
  {
    summary: { type: String, required: true },
    newPoints: { type: [String], default: [] },
    policyChanged: { type: Boolean, required: true },
    aiRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiRun', default: null },
  },
  { _id: false },
);

const appealSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    decisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Decision', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    statement: {
      type: String,
      required: true,
      minlength: LIMITS.APPEAL_STATEMENT_MIN,
      maxlength: LIMITS.APPEAL_STATEMENT_MAX,
    },
    evidence: { type: String, default: '', maxlength: LIMITS.APPEAL_STATEMENT_MAX },
    assignedReviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      required: true,
      enum: Object.values(APPEAL_STATUS),
      default: APPEAL_STATUS.PENDING,
    },
    aiSummary: { type: aiSummarySchema, default: null },
    resolutionDecisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Decision', default: null },
  },
  { timestamps: true },
);

// Once per decision.
appealSchema.index({ decisionId: 1 }, { unique: true });
appealSchema.index({ status: 1, assignedReviewerId: 1 });

export const Appeal = mongoose.model('Appeal', appealSchema, 'appeals');
