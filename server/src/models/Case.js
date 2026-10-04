import mongoose from 'mongoose';
import { CASE, TRIGGER } from '../constants.js';

const caseSchema = new mongoose.Schema(
  {
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
    trigger: { type: String, required: true, enum: Object.values(TRIGGER) },
    status: { type: String, required: true, enum: Object.values(CASE) },
    priority: { type: Number, required: true, default: 0, min: 0, max: 100 },
    currentAnalysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', default: null },
    reportCount: { type: Number, required: true, default: 0, min: 0 },
    policyChangedFrom: { type: Number, default: null },
  },
  { timestamps: true },
);

caseSchema.index({ status: 1, priority: -1, createdAt: 1 });
caseSchema.index({ contentId: 1, createdAt: -1 });

export const Case = mongoose.model('Case', caseSchema, 'cases');
