import mongoose from 'mongoose';
import { REPORT_REASONS } from '../constants.js';

const reportSchema = new mongoose.Schema(
  {
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reasonCode: { type: String, required: true, enum: REPORT_REASONS },
    note: { type: String, default: '', maxlength: 500 },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  },
  { timestamps: true },
);

// One report per user per content.
reportSchema.index({ contentId: 1, reporterId: 1 }, { unique: true });
reportSchema.index({ caseId: 1 });

export const Report = mongoose.model('Report', reportSchema, 'reports');
