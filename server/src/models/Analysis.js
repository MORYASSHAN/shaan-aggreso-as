import mongoose from 'mongoose';
import { ACTION, FINDING_SEVERITIES, FINDING_SOURCE, SEVERITY } from '../constants.js';

const evidenceSchema = new mongoose.Schema(
  {
    quote: { type: String, required: true },
    start: { type: Number, default: null },
    end: { type: Number, default: null },
    verified: { type: Boolean, required: true },
  },
  { _id: false },
);

const findingSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, enum: Object.values(FINDING_SOURCE) },
    ruleId: { type: String, default: null },
    clauseCode: { type: String, required: true },
    policyVersion: { type: Number, required: true },
    evidence: { type: [evidenceSchema], default: [] },
    interpretation: { type: String, default: null },
    severity: { type: String, required: true, enum: FINDING_SEVERITIES },
    severityReason: { type: String, default: null },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    confidenceReason: { type: String, default: null },
    invalidCitation: { type: Boolean, default: false },
    notes: { type: [String], default: [] },
  },
  { _id: false },
);

const recommendationSchema = new mongoose.Schema(
  {
    proposedAction: { type: String, required: true, enum: Object.values(ACTION) },
    severity: { type: String, required: true, enum: Object.values(SEVERITY) },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    needsHuman: { type: Boolean, required: true },
    needsHumanReasons: { type: [String], default: [] },
    summary: { type: String, default: '' },
  },
  { _id: false },
);

// One run of rules + AI. Old analyses are kept and marked superseded, never overwritten.
const analysisSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    policyVersion: { type: Number, required: true },
    ruleFindings: { type: [findingSchema], default: [] },
    aiFindings: { type: [findingSchema], default: [] },
    recommendation: { type: recommendationSchema, required: true },
    aiRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiRun', default: null },
    superseded: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

analysisSchema.index({ caseId: 1, createdAt: -1 });
analysisSchema.index({ policyVersion: 1, superseded: 1 });

export const Analysis = mongoose.model('Analysis', analysisSchema, 'analyses');
