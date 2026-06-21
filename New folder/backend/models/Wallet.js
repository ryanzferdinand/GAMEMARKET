import mongoose from 'mongoose'

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  availableBalance: { type: Number, default: 0, min: 0 },
  pendingBalance: { type: Number, default: 0, min: 0 },
  frozenBalance: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'IDR' },
}, { timestamps: true })

walletSchema.virtual('totalBalance').get(function () {
  return this.availableBalance + this.pendingBalance + this.frozenBalance
})

walletSchema.set('toJSON', { virtuals: true })
walletSchema.set('toObject', { virtuals: true })

export default mongoose.model('Wallet', walletSchema)
