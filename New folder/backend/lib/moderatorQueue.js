import User from '../models/User.js'
import Dispute from '../models/Dispute.js'
import ModeratorAssignment from '../models/ModeratorAssignment.js'
import { MODERATOR_REASSIGN_MINUTES } from './marketplaceConstants.js'

let roundRobinIndex = 0

export async function getModeratorWorkload() {
  const moderators = await User.find({
    role: { $in: ['moderator', 'admin'] },
    isBanned: false,
    moderatorStatus: { $ne: 'offline' },
  }).select('_id username moderatorStatus')

  const workload = await Promise.all(
    moderators.map(async (mod) => {
      const activeCount = await Dispute.countDocuments({
        moderator: mod._id,
        status: { $in: ['open', 'in_review'] },
      })
      return { moderator: mod, activeCount }
    }),
  )

  return workload.sort((a, b) => a.activeCount - b.activeCount)
}

export async function assignModerator(disputeId) {
  const dispute = await Dispute.findById(disputeId)
  if (!dispute || dispute.moderator) return dispute

  const workload = await getModeratorWorkload()
  if (!workload.length) return dispute

  const minLoad = workload[0].activeCount
  const candidates = workload.filter((w) => w.activeCount === minLoad)

  const picked = candidates[roundRobinIndex % candidates.length]
  roundRobinIndex += 1

  dispute.moderator = picked.moderator._id
  dispute.assignedAt = new Date()
  dispute.lastModeratorActivity = new Date()
  dispute.status = 'in_review'
  await dispute.save()

  await ModeratorAssignment.create({
    dispute: dispute._id,
    moderator: picked.moderator._id,
    reason: 'auto_assigned',
  })

  return dispute
}

export async function claimDispute(disputeId, moderatorId) {
  const dispute = await Dispute.findById(disputeId)
  if (!dispute) throw new Error('Dispute tidak ditemukan')
  if (dispute.claimedBy && dispute.claimedBy.toString() !== moderatorId.toString()) {
    throw new Error('Dispute sudah diklaim moderator lain')
  }

  dispute.claimedBy = moderatorId
  dispute.claimedAt = new Date()
  dispute.moderator = moderatorId
  dispute.lastModeratorActivity = new Date()
  await dispute.save()

  return dispute
}

export async function reassignStaleDisputes() {
  const cutoff = new Date(Date.now() - MODERATOR_REASSIGN_MINUTES * 60 * 1000)

  const stale = await Dispute.find({
    status: { $in: ['open', 'in_review'] },
    moderator: { $ne: null },
    lastModeratorActivity: { $lt: cutoff },
  })

  for (const dispute of stale) {
    await ModeratorAssignment.updateMany(
      { dispute: dispute._id, isActive: true },
      { isActive: false, unassignedAt: new Date(), reason: 'timeout_reassign' },
    )

    dispute.moderator = null
    dispute.claimedBy = null
    dispute.claimedAt = null
    dispute.reassignedCount += 1
    dispute.status = 'open'
    await dispute.save()

    await assignModerator(dispute._id)
  }

  return stale.length
}

export async function getModeratorQueue() {
  return Dispute.find({ status: { $in: ['open', 'in_review'] } })
    .sort({ createdAt: 1 })
    .populate('buyer seller moderator', 'username avatar')
    .populate('order', 'orderNumber amount')
}
