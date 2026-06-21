import AuditLog from '../models/AuditLog.js'

export async function createAuditLog({
  actor,
  action,
  targetType,
  targetId,
  reason,
  meta,
  ipAddress,
}) {
  try {
    return await AuditLog.create({
      actor,
      action,
      targetType,
      targetId,
      reason,
      meta,
      ipAddress,
    })
  } catch (err) {
    console.error('Audit log error:', err.message)
  }
}
