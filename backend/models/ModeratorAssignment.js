import mongoose from 'mongoose'

const moderatorAssignmentSchema = new mongoose.Schema({
  dispute: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute', required: true },
  moderator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedAt: { type: Date, default: Date.now },
  unassignedAt: Date,
  reason: { type: String, maxlength: 500 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

moderatorAssignmentSchema.index({ moderator: 1, isActive: 1 })
moderatorAssignmentSchema.index({ dispute: 1, isActive: 1 })

export default mongoose.model('ModeratorAssignment', moderatorAssignmentSchema)
