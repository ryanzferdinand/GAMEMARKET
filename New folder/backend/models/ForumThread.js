import mongoose from 'mongoose'

const forumReplySchema = new mongoose.Schema({
  thread: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumThread', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 5000 },
  taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  parentReply: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumReply', default: null },
  votes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['up', 'down'] },
  }],
}, { timestamps: true })

const forumThreadSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 150 },
  content: { type: String, required: true, maxlength: 5000 },
  taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: {
    type: String,
    enum: ['discussion', 'tips', 'review', 'question', 'announcement'],
    default: 'discussion',
  },
  votes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['up', 'down'] },
  }],
  views: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
}, { timestamps: true })

forumThreadSchema.index({ category: 1, createdAt: -1 })
forumThreadSchema.index({ isPinned: -1, createdAt: -1 })

export const ForumThread = mongoose.model('ForumThread', forumThreadSchema)
export const ForumReply = mongoose.model('ForumReply', forumReplySchema)
