import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true, maxlength: 100 },
  targetType: { type: String, maxlength: 50 },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  reason: { type: String, maxlength: 500 },
  meta: { type: mongoose.Schema.Types.Mixed },
  ipAddress: String,
}, { timestamps: true })

auditLogSchema.index({ actor: 1, createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ targetType: 1, targetId: 1 })

export default mongoose.model('AuditLog', auditLogSchema)
