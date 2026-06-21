import mongoose from 'mongoose'
import Review from '../models/Review.js'
import User from '../models/User.js'

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id.toString())
}

export async function getRatingBreakdown(revieweeId) {
  const breakdown = await Review.aggregate([
    { $match: { reviewee: toObjectId(revieweeId) } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ])

  const map = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  breakdown.forEach(({ _id, count }) => { map[_id] = count })
  return map
}

export async function getSellerRatingStats(revieweeId) {
  const oid = toObjectId(revieweeId)
  const [agg, breakdown] = await Promise.all([
    Review.aggregate([
      { $match: { reviewee: oid } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    getRatingBreakdown(revieweeId),
  ])

  const rating = agg[0]?.avg ? Math.round(agg[0].avg * 10) / 10 : 0
  const ratingCount = agg[0]?.count || 0

  return { rating, ratingCount, breakdown }
}

export async function recalculateSellerRating(revieweeId) {
  const stats = await getSellerRatingStats(revieweeId)

  await User.findByIdAndUpdate(revieweeId, {
    rating: stats.rating,
    ratingCount: stats.ratingCount,
  })

  return stats
}

export function emitRatingUpdate(io, { userId, username, stats, review }) {
  if (!io) return
  const payload = {
    userId: userId.toString(),
    username,
    rating: stats.rating,
    ratingCount: stats.ratingCount,
    breakdown: stats.breakdown,
    review,
  }
  io.to(`user:${userId}`).emit('rating:updated', payload)
  io.to(`seller:${userId}`).emit('rating:updated', payload)
}
