import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  icon: { type: String, default: 'GM', trim: true },
  color: { type: String, default: 'from-slate-400 to-slate-600', trim: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

categorySchema.index({ order: 1, createdAt: 1 })

export default mongoose.model('Category', categorySchema)
