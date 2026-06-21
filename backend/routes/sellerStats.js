/**
 * routes/sellerStats.js
 *
 * GET /api/seller/stats  — dashboard statistik untuk penjual yang sedang login.
 * Mengembalikan:
 *   - Data dari SellerProfile (order counts, revenue, response time)
 *   - Rating & breakdown dari Review
 *   - Ringkasan order per status (30 hari & all time)
 *   - Postingan aktif, sold, pending
 *   - Revenue per bulan (12 bulan terakhir)
 *   - Dispute rate, completion rate
 */

import express from 'express'
import { authenticate } from '../middleware/auth.js'
import SellerProfile from '../models/SellerProfile.js'
import Order from '../models/Order.js'
import Post from '../models/Post.js'
import Review from '../models/Review.js'
import WalletTransaction from '../models/WalletTransaction.js'
import { getSellerRatingStats } from '../lib/ratings.js'
import mongoose from 'mongoose'

const router = express.Router()
router.use(authenticate)

// GET /api/seller/stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id

    // Run all heavy queries in parallel
    const [
      profile,
      ratingStats,
      postCounts,
      orderStatusCounts,
      recentOrders,
      monthlyRevenue,
      recentReviews,
    ] = await Promise.all([
      // 1. SellerProfile
      SellerProfile.findOne({ user: userId }).lean(),

      // 2. Rating breakdown
      getSellerRatingStats(userId),

      // 3. Post counts by status
      Post.aggregate([
        { $match: { seller: new mongoose.Types.ObjectId(userId.toString()) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // 4. Order counts by status (all time)
      Order.aggregate([
        { $match: { seller: new mongoose.Types.ObjectId(userId.toString()) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // 5. Last 30 days orders
      Order.find({
        seller: userId,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('post', 'title images gameCategory')
        .populate('buyer', 'username avatar')
        .lean(),

      // 6. Monthly revenue — last 12 months (from WalletTransaction escrow_release)
      WalletTransaction.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId.toString()),
            type: 'escrow_release',
            createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      // 7. Recent reviews (5 latest)
      Review.find({ reviewee: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('reviewer', 'username avatar role')
        .populate('post', 'title images')
        .lean(),
    ])

    // ── Shape post counts ────────────────────────────────────────────────────
    const postMap = { approved: 0, pending: 0, sold: 0, rejected: 0, draft: 0 }
    postCounts.forEach(({ _id, count }) => { if (_id in postMap) postMap[_id] = count })

    // ── Shape order counts ───────────────────────────────────────────────────
    const orderMap = {
      escrow_active: 0,
      delivered: 0,
      completed: 0,
      disputed: 0,
      cancelled: 0,
      refunded: 0,
    }
    orderStatusCounts.forEach(({ _id, count }) => { if (_id in orderMap) orderMap[_id] = count })

    const totalOrders     = profile?.totalOrders     || Object.values(orderMap).reduce((a, b) => a + b, 0)
    const completedOrders = profile?.completedOrders || orderMap.completed
    const disputedOrders  = profile?.disputedOrders  || orderMap.disputed
    const cancelledOrders = profile?.cancelledOrders || orderMap.cancelled
    const totalRevenue    = profile?.totalRevenue    || 0

    const completionRate  = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 100
    const disputeRate     = totalOrders > 0 ? Math.round((disputedOrders  / totalOrders) * 100) : 0
    const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0

    // ── Shape monthly revenue ────────────────────────────────────────────────
    // Build last-12-month skeleton so missing months show as 0
    const now = new Date()
    const months = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleString('id-ID', { month: 'short', year: '2-digit' }),
        revenue: 0,
        count: 0,
      })
    }
    monthlyRevenue.forEach(({ _id, revenue, count }) => {
      const slot = months.find((m) => m.year === _id.year && m.month === _id.month)
      if (slot) { slot.revenue = revenue; slot.count = count }
    })

    // ── Response time label ──────────────────────────────────────────────────
    const avgResponseMinutes = profile?.avgResponseMinutes || 0
    let responseLabel = 'Tidak ada data'
    if (avgResponseMinutes > 0) {
      if (avgResponseMinutes < 60) responseLabel = `${avgResponseMinutes} menit`
      else if (avgResponseMinutes < 1440) responseLabel = `${Math.round(avgResponseMinutes / 60)} jam`
      else responseLabel = `${Math.round(avgResponseMinutes / 1440)} hari`
    }

    res.json({
      // Core profile
      profile: {
        totalOrders,
        completedOrders,
        disputedOrders,
        cancelledOrders,
        totalRevenue,
        avgResponseMinutes,
        responseLabel,
        responseCount: profile?.responseCount || 0,
        verifiedBadge: profile?.verifiedBadge || false,
      },
      // Performance rates
      rates: {
        completionRate,
        disputeRate,
        cancellationRate,
        successRate: completionRate,
      },
      // Rating
      rating: ratingStats,
      // Posts
      posts: postMap,
      // Orders by status
      orders: orderMap,
      // Recent activity
      recentOrders,
      recentReviews,
      // Monthly revenue chart data
      monthlyRevenue: months,
    })
  } catch (err) {
    console.error('Seller stats error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
