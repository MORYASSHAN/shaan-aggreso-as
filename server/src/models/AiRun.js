import mongoose from 'mongoose';
import { AI_PURPOSE, AI_RUN_STATUS } from '../constants.js';

// Technical log of every AI call, successful or not.
const aiRunSchema = new mongoose.Schema(
  {
    purpose: { type: String, required: true, enum: Object.values(AI_PURPOSE) },
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    policyVersion: { type: Number, required: true },
    latencyMs: { type: Number, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    status: { type: String, required: true, enum: Object.values(AI_RUN_STATUS) },
    errorMessage: { type: String, default: null },
    verification: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

aiRunSchema.index({ createdAt: -1 });

export const AiRun = mongoose.model('AiRun', aiRunSchema, 'aiRuns');
