import mongoose from 'mongoose'

const offerStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
}

const offerSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  offeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  offeredTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: Object.values(offerStatus),
    default: offerStatus.PENDING
  },
  message: { type: String, maxlength: 500 }
}, { timestamps: true })

offerSchema.index({ order: 1, createdAt: -1 })

export const OFFER_STATUS = offerStatus
export default mongoose.model('Offer', offerSchema)
