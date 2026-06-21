import mongoose from 'mongoose'

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: {
    type: String,
    enum: ['post', 'user', 'comment'],
    required: true,
  },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reason: {
    type: String,
    enum: ['spam', 'scam', 'inappropriate', 'fake', 'harassment', 'other'],
    required: true,
  },
  description: { type: String, maxlength: 500, trim: true },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'dismissed', 'action_taken'],
    default: 'pending',
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String, maxlength: 500 },
  targetSnapshot: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true })

reportSchema.index({ status: 1, createdAt: -1 })
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 })

export default mongoose.model('Report', reportSchema)
