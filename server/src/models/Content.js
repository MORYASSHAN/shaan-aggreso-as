import mongoose from 'mongoose';
import { CONTENT_TYPE, LIMITS, VISIBILITY } from '../constants.js';

const contentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: Object.values(CONTENT_TYPE) },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', default: null },
    body: { type: String, required: true, maxlength: LIMITS.BODY_MAX },
    visibility: {
      type: String,
      required: true,
      enum: Object.values(VISIBILITY),
      default: VISIBILITY.VISIBLE,
    },
  },
  { timestamps: true },
);

contentSchema.index({ type: 1, createdAt: -1 });
contentSchema.index({ postId: 1, createdAt: 1 });
contentSchema.index({ authorId: 1, createdAt: -1 });

export const Content = mongoose.model('Content', contentSchema, 'contents');
