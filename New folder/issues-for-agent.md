# GAME MARKETPLACE — MASTER ISSUE LIST FOR AI AGENT
> **Stack:** Node.js + Express + MongoDB (Mongoose) + Socket.IO + React (Vite) + Tailwind  
> **Last analyzed:** Version 2 (aaaa.rar)  
> **Last updated:** 2026-06-19 — audit + fixes applied  
> **Format:** Each issue has a unique ID, severity, file path, exact problem, and actionable fix.

---

## FIX STATUS SUMMARY (2026-06-19)

| ID | Status | Notes |
|----|--------|-------|
| SEC-001 | ⚠️ Partial | `.gitignore` added; **you must rotate leaked keys manually** |
| SEC-002 | ✅ Fixed | Delivery credentials encrypted at rest; decrypt on GET; migration on startup |
| SEC-003 | ✅ Fixed | Simulate blocked when `NODE_ENV=production` |
| SEC-004 | ✅ Fixed | Min 8 chars + letter/number required |
| SEC-005 | ✅ Fixed | Email OTP verification flow |
| SEC-006 | ✅ Fixed | Forgot/reset password + frontend pages |
| SEC-007 | ✅ Fixed | Production CSP removes `unsafe-inline`/`unsafe-eval` for scripts |
| SEC-008 | ✅ Fixed | Presence/ratings/stats scoped to conversation partners or seller rooms |
| SEC-009 | ✅ Fixed | Verify users admin-only |
| SEC-010 | ✅ Fixed | Max offer cap 100M IDR |
| SEC-011 | ✅ Fixed | Offer scoped to order |
| BUG-001 | ✅ Fixed | Atomic `balanceBefore` via `findOneAndUpdate` + `new: false` |
| BUG-002 | ⚠️ Partial | Manual rollback improved; full MongoDB transactions need replica set |
| BUG-003 | ✅ Fixed | Poll only when socket disconnected |
| BUG-004 | ✅ Fixed | Single-query replies |
| BUG-005 | ✅ Fixed | Denormalized `sellerRole` on Post |
| BUG-006 | ✅ Fixed | Conversation updates from message (2 queries vs 6) |
| BUG-007 | ✅ Fixed | Typing throttled 1/sec |
| BUG-008 | ✅ Fixed | Reviews return 500 on error |
| BUG-009 | ✅ Fixed | Bounded view tracker (50k max) |
| BUG-010 | ✅ Fixed | Notification TTL 90 days |
| BUG-011 | ✅ Fixed | Compound index `{status, expiredAt}` |
| BUG-012 | ✅ Fixed | Adaptive job intervals |
| PERF-001 | ✅ Fixed | compression middleware |
| PERF-002 | ✅ Fixed | Upload cache headers |
| PERF-003 | ✅ Fixed | Categories in-memory cache |
| PERF-004 | ⚠️ Partial | `.lean()` on key list routes; not every GET yet |
| PERF-005 | ✅ Fixed | Vite manual chunks |
| PERF-006 | ✅ Fixed | User text index + `$text` search |
| FEAT-001 | ✅ Fixed | Same as SEC-005 |
| FEAT-002 | ✅ Fixed | Same as SEC-006 |
| FEAT-003 | ❌ Open | Email notifications for orders/disputes not implemented |
| FEAT-004 | ⚠️ Partial | Chat has page/limit pagination (50/msg); no cursor API |
| FEAT-005 | ❌ Open | 2FA not implemented |
| FEAT-006 | ❌ Open | Seller analytics dashboard not implemented |
| FEAT-007 | ❌ Open | Saved search alerts not implemented |

---

## SEVERITY LEGEND
- `CRITICAL` — Exploitable now, fix immediately before any deployment
- `HIGH` — Serious vulnerability or data integrity risk
- `MEDIUM` — Performance degradation, resource waste, or non-critical bug
- `LOW` — Code quality, minor bug, or missing feature

---

## SECTION 1 — SECURITY ISSUES

---

### SEC-001
**Severity:** CRITICAL  
**Title:** Secret credentials committed to repository and never rotated  
**File:** `backend/.env`  
**Problem:**  
Real production credentials are committed into the project archive. The values are identical between v1 and v2, meaning no rotation was performed after the first exposure.

```
JWT_SECRET=0b47e5bed41d1ad6bc86ba2a0f2d6794ac9e31eca0f474cab68721b6721a4033
CHAT_ENCRYPTION_KEY=aeb955aac86994fb89f66d82c87966c1dded13902fd233fadfaab1d155a4769e
GOOGLE_CLIENT_ID=210743532027-lsors4jf9h1gcfsh3dtsj5ss0a4eh4h0.apps.googleusercontent.com
CLOUDINARY_API_KEY=878498537957543
CLOUDINARY_API_SECRET=jXMHgWlyvOdWK_VDhBHdSfl0m64
```

**Impact:**  
Anyone with access to this archive can forge JWT tokens to impersonate any user including admins, decrypt all chat messages, and access/destroy all uploaded files via Cloudinary.

**Fix:**
1. Add `backend/.env` and `.env` to `.gitignore` immediately
2. Rotate ALL keys: generate new JWT_SECRET (32+ random bytes), new CHAT_ENCRYPTION_KEY (32+ random bytes), regenerate Cloudinary API key pair, update Google OAuth client secret
3. Use `.env.example` with placeholder values for documentation
4. On rotation of CHAT_ENCRYPTION_KEY: all existing encrypted messages will fail to decrypt — run migration to re-encrypt with new key or accept data loss

---

### SEC-002
**Severity:** HIGH  
**Title:** Game account credentials (password, email, recovery) stored as plaintext in database  
**File:** `backend/models/Order.js` (deliverySchema), `backend/lib/escrowService.js` (deliverOrder)  
**Problem:**  
When a seller delivers a game account, the credentials are stored in plain text inside `order.delivery`:

```js
const deliverySchema = new mongoose.Schema({
  email: String,      // plaintext
  password: String,   // plaintext — NEVER store passwords plaintext
  recovery: String,   // plaintext
  ...
})
```

The `deliverOrder()` function saves `delivery` directly without any encryption.

**Impact:**  
Any MongoDB database breach, admin panel access, or leaked DB dump exposes real game account credentials of all completed orders.

**Fix:**
```js
// In escrowService.js deliverOrder(), encrypt before saving:
import { encryptText } from '../lib/chatCrypto.js'

order.delivery = {
  email: delivery.email ? encryptText(delivery.email) : null,
  password: delivery.password ? encryptText(delivery.password) : null,
  recovery: delivery.recovery ? encryptText(delivery.recovery) : null,
  notes: delivery.notes,
  attachments: delivery.attachments,
  deliveredAt: new Date()
}

// In routes/orders.js when returning delivery to client, decrypt:
import { decryptText } from '../lib/chatCrypto.js'
// decrypt before sending in GET /api/orders/:id response
```

---

### SEC-003
**Severity:** HIGH  
**Title:** Payment simulation mode can accidentally be enabled in production  
**File:** `backend/lib/payments/gateway.js`  
**Problem:**  
```js
export function canSimulatePayments() {
  return !isMidtransConfigured() || process.env.ALLOW_PAYMENT_SIMULATE === 'true'
}
```
If `ALLOW_PAYMENT_SIMULATE=true` is accidentally set in production environment, or if Midtrans credentials are misconfigured, any user can hit `POST /api/payments/simulate/:gatewayRef` and credit their wallet for free without real payment.

**Fix:**
```js
export function canSimulatePayments() {
  // NEVER allow in production regardless of env vars
  if (process.env.NODE_ENV === 'production') return false
  return !isMidtransConfigured() || process.env.ALLOW_PAYMENT_SIMULATE === 'true'
}
```

---

### SEC-004
**Severity:** HIGH  
**Title:** Password minimum length is too short (6 characters)  
**File:** `backend/routes/auth.js` line 34  
**Problem:**  
```js
if (password.length < 6) {
  return res.status(400).json({ message: 'Password minimal 6 karakter' })
}
```
6 characters allows weak passwords like `abc123` or `pass12`. No complexity check exists.

**Fix:**
```js
if (password.length < 8) {
  return res.status(400).json({ message: 'Password minimal 8 karakter' })
}
// Optional: add complexity check
const hasLetter = /[a-zA-Z]/.test(password)
const hasNumber = /[0-9]/.test(password)
if (!hasLetter || !hasNumber) {
  return res.status(400).json({ message: 'Password harus mengandung huruf dan angka' })
}
```

---

### SEC-005
**Severity:** HIGH  
**Title:** No email verification on registration — anyone can create fake accounts  
**File:** `backend/routes/auth.js` (POST /register)  
**Problem:**  
After `POST /api/auth/register`, the user gets a JWT token immediately and can log in without verifying their email. This allows mass fake account creation and enables fraud.

**Fix:**  
1. Add `emailVerified: { type: Boolean, default: false }` to User model
2. On register, generate a secure random token (crypto.randomBytes), store with expiry in DB or Redis
3. Send verification email via nodemailer/SendGrid/etc
4. Add `GET /api/auth/verify-email?token=...` endpoint
5. Block login if `emailVerified === false` (or show limited access)

---

### SEC-006
**Severity:** HIGH  
**Title:** No forgot password / reset password flow  
**File:** `backend/routes/auth.js` — endpoint does not exist  
**Problem:**  
There is no `POST /api/auth/forgot-password` or `POST /api/auth/reset-password` endpoint. Users who registered with email/password and forget their password have no recovery path. This also means account takeover via email is unmitigated.

**Fix:**
```js
// POST /api/auth/forgot-password
// 1. Find user by email
// 2. Generate crypto.randomBytes(32).toString('hex') token
// 3. Store hashed token + expiry (1 hour) in DB
// 4. Send email with reset link: /reset-password?token=...
// 5. On reset: verify token, update password, increment tokenVersion to invalidate sessions
```

---

### SEC-007
**Severity:** MEDIUM  
**Title:** CSP allows `unsafe-inline` and `unsafe-eval` for scripts  
**File:** `backend/server.js`  
**Problem:**  
```js
scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
```
While CSP is now enabled (improvement from v1), `unsafe-inline` and `unsafe-eval` for scripts largely defeats the XSS protection purpose of CSP. Any injected inline script would execute.

**Fix:**  
Use nonce-based CSP or hash-based CSP instead of `unsafe-inline`. For React/Vite production builds, scripts are in external files so `unsafe-inline` for scripts is not needed.

---

### SEC-008
**Severity:** MEDIUM  
**Title:** `io.emit()` broadcasts presence events to all connected users  
**File:** `backend/socket/handlers.js` lines 71, 246; `backend/lib/ratings.js` line 58; `backend/routes/posts.js` line 291  
**Problem:**  
```js
io.emit('user:online', { userId })    // ALL users get this on every connect
io.emit('user:offline', { userId })   // ALL users get this on every disconnect
io.emit('rating:updated', payload)    // ALL users get every rating update
io.emit('seller:stats-updated', ...)  // ALL users get seller stat changes
```
This exposes the online/offline status of every user to every other user indiscriminately. A stalker or bad actor can track when specific users are online.

**Fix:**
```js
// Only broadcast to users who have an active conversation with this user
// Or use targeted room-based emissions:
socket.broadcast.emit('user:online', { userId })  // minimum: exclude sender
// Ideal: only emit to users who have conversations with userId
```

---

### SEC-009
**Severity:** MEDIUM  
**Title:** `moderator` role can verify users — should be admin-only  
**File:** `backend/routes/admin.js` (PATCH /users/:id/verify)  
**Problem:**  
```js
router.patch('/users/:id/verify', async (req, res) => { // No requireRole('admin')!
```
The route uses the router-level middleware `requireRole('admin', 'moderator')`, meaning moderators can grant verified status to any user. Only admins should do this.

**Fix:**
```js
router.patch('/users/:id/verify', requireRole('admin'), async (req, res) => {
```

---

### SEC-010
**Severity:** MEDIUM  
**Title:** Offer amount has no upper bound validation  
**File:** `backend/routes/orders.js` (POST /orders/:id/offers)  
**Problem:**  
```js
if (!amount || amount <= 0) {
  return res.status(400).json({ message: 'Jumlah tawaran harus lebih dari 0' })
}
```
No maximum validation. A user could create an offer for `amount: 999999999999` which may cause issues downstream or confuse the UI.

**Fix:**
```js
const MAX_OFFER = 100_000_000 // 100 juta IDR reasonable cap
if (amount <= 0 || amount > MAX_OFFER) {
  return res.status(400).json({ message: `Jumlah tawaran harus antara 1 dan Rp${MAX_OFFER.toLocaleString('id-ID')}` })
}
```

---

### SEC-011
**Severity:** MEDIUM  
**Title:** Offer accept does not validate that accepted offer belongs to the current order  
**File:** `backend/routes/orders.js` (POST /orders/:id/offers/:offerId/accept)  
**Problem:**  
The code fetches the offer by `offerId` but does not verify that `offer.order` matches `req.params.id`. An attacker with access to any order could potentially accept offers from a different order by crafting the URL.

**Fix:**
```js
const offer = await Offer.findOne({ _id: req.params.offerId, order: order._id })
if (!offer) return res.status(404).json({ message: 'Tawaran tidak ditemukan' })
```

---

## SECTION 2 — BUGS

---

### BUG-001
**Severity:** HIGH  
**Title:** Race condition in `addSellerPending` — non-atomic read-modify-write  
**File:** `backend/lib/walletService.js`  
**Problem:**  
```js
export async function addSellerPending(userId, amount, ...) {
  const wallet = await getOrCreateWallet(userId)  // READ
  const before = snapshot(wallet)

  const updated = await Wallet.findOneAndUpdate(
    { _id: wallet._id },
    { $inc: { pendingBalance: amount } },    // This part is atomic
    { new: true },
  )
  // but `before` was captured from a stale read — balanceBefore in the tx is wrong
```
The `$inc` operation itself is atomic, but the `before` snapshot is captured from a separate read that may be stale, making the transaction audit log record incorrect `balanceBefore` values.

**Fix:**  
Capture `before` from the same `findOneAndUpdate` by using `new: false` (returns old document):
```js
const old = await Wallet.findOneAndUpdate(
  { _id: wallet._id },
  { $inc: { pendingBalance: amount } },
  { new: false }, // returns the BEFORE state
)
const updated = await Wallet.findById(wallet._id)
// now old = before state, updated = after state
```

---

### BUG-002
**Severity:** HIGH  
**Title:** Escrow creation has no database transaction — partial failure leaves inconsistent state  
**File:** `backend/lib/escrowService.js`  
**Problem:**  
```js
// "Create order + escrow with manual rollback (standalone MongoDB has no sessions)"
order = await Order.create({...})    // Step 1 — can succeed
escrow = await Escrow.create({...})  // Step 2 — if this fails, order exists without escrow
order.escrow = escrow._id
await order.save()                   // Step 3
await debitAvailable(...)            // Step 4 — if this fails, order+escrow exist but balance not debited
```
If any step between 2–4 throws, the system can end up with orphaned orders, orphaned escrows, or debited balances without corresponding orders.

**Fix:**  
Deploy MongoDB as a replica set (single-node replica set is sufficient) to enable sessions, then wrap the entire sequence in a MongoDB transaction:
```js
const session = await mongoose.startSession()
session.startTransaction()
try {
  // all operations with { session }
  await session.commitTransaction()
} catch (err) {
  await session.abortTransaction()
  throw err
} finally {
  session.endSession()
}
```

---

### BUG-003
**Severity:** MEDIUM  
**Title:** Wallet polling for Midtrans still runs alongside socket listener  
**File:** `frontend/src/pages/WalletPage.jsx` lines 78–91  
**Problem:**  
The socket listener for `wallet:updated` was added, but the `setInterval(poll, 5000)` polling is still present and runs simultaneously for Midtrans payments:
```js
// Socket listener (correct)
socket?.on('wallet:updated', onWalletUpdate)

// BUT this still runs for Midtrans:
const interval = setInterval(poll, 5000)  // 12 API calls/minute per user
```
Both run at the same time when `pendingPayment.provider === 'midtrans'`.

**Fix:**  
Socket already handles this. Remove the polling or at minimum only poll when socket is disconnected:
```js
useEffect(() => {
  if (!pendingPayment?.gatewayRef || pendingPayment.provider !== 'midtrans') return
  // Only poll if socket is not connected (fallback)
  const socket = getSocket()
  if (socket?.connected) return  // socket handles it, don't poll
  const interval = setInterval(poll, 5000)
  return () => clearInterval(interval)
}, [pendingPayment?.gatewayRef])
```

---

### BUG-004
**Severity:** MEDIUM  
**Title:** `getCommentsWithReplies` has N+1 query problem  
**File:** `backend/routes/posts.js`  
**Problem:**  
```js
const comments = await Comment.find(query).limit(limit)  // 1 query

const commentsWithReplies = await Promise.all(
  comments.map(async (comment) => {
    const replies = await Comment.find({ parentComment: comment._id })  // N queries!
    return { ...comment.toObject(), replies }
  })
)
```
For each of the N comments, one additional query fetches replies. With 5 comments per page, that's 6 queries just for comments. With pagination, this compounds.

**Fix:**  
Fetch all replies for the current page in a single query:
```js
const comments = await Comment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('author', 'username avatar role').lean()
const commentIds = comments.map(c => c._id)
const allReplies = await Comment.find({ parentComment: { $in: commentIds } }).sort({ createdAt: 1 }).populate('author', 'username avatar role').lean()
const repliesByParent = allReplies.reduce((acc, r) => {
  const key = r.parentComment.toString()
  if (!acc[key]) acc[key] = []
  acc[key].push(r)
  return acc
}, {})
const commentsWithReplies = comments.map(c => ({ ...c, replies: repliesByParent[c._id.toString()] || [] }))
```

---

### BUG-005
**Severity:** MEDIUM  
**Title:** `sellerRank` filter loads all seller IDs into memory (N+1 / memory inefficiency)  
**File:** `backend/routes/posts.js` lines 84–87  
**Problem:**  
```js
if (sellerRank) {
  const eligibleSellers = await User.find({ role: sellerRank }, '_id')  // loads ALL sellers
  query.seller = { $in: eligibleSellers.map((u) => u._id) }  // huge $in array
}
```
With 10,000 sellers of a given role, this creates an array of 10,000 ObjectIds in memory and sends it as a `$in` query. MongoDB `$in` with large arrays is slow and the intermediate array wastes RAM.

**Fix — Option A (add `sellerRole` denormalized field to Post):**
```js
// In Post model, add: sellerRole: { type: String }
// Update sellerRole when post is created or seller role changes
// Query becomes: if (sellerRank) query.sellerRole = sellerRank
```

**Fix — Option B (MongoDB $lookup aggregation):**
Use `Post.aggregate()` with a `$lookup` to join User collection on the role field without loading IDs into memory.

---

### BUG-006
**Severity:** MEDIUM  
**Title:** `buildConversationSummary` fires 3 DB queries, called twice per message = 6 extra queries per chat message  
**File:** `backend/socket/handlers.js`  
**Problem:**  
```js
// Every time a message is sent:
await emitConversationUpdate(io, userId, receiverId)   // 3 queries
await emitConversationUpdate(io, receiverId, userId)   // 3 queries
// Total: 6 extra DB queries on top of the message.create() query
```
Inside `buildConversationSummary`:
```js
const lastMessage = await Message.findOne(...)      // query 1
const unreadCount = await Message.countDocuments(...)  // query 2
const partner = await User.findById(partnerId)...   // query 3
```
In an active chat, this causes ~7 DB queries per message sent.

**Fix:**  
Construct the conversation update directly from the already-created message object without re-querying:
```js
// Instead of re-fetching from DB, build the update from what we already have
const convUpdateForReceiver = {
  partner: { _id: userId, username: socket.user.username, avatar: socket.user.avatar, isOnline: true, role: socket.user.role },
  lastMessage: outMsg,
  unreadCount: null // frontend increments locally
}
io.to(`user:${receiverId}`).emit('chat:conversation-update', convUpdateForReceiver)
```

---

### BUG-007
**Severity:** MEDIUM  
**Title:** `chat:typing` events are not throttled — forwards every keystroke to server  
**File:** `backend/socket/handlers.js`  
**Problem:**  
```js
socket.on('chat:typing', ({ receiverId }) => {
  const receiverSocketId = onlineUsers.get(receiverId)
  if (receiverSocketId) {
    io.to(receiverSocketId).emit('chat:typing', { senderId: userId, username: socket.user.username })
  }
})
```
No throttle or debounce. A fast typist sends 10+ keystrokes/second → 10+ socket events/second → 10+ events forwarded per second. With multiple concurrent chats, this saturates socket bandwidth.

**Fix:**
```js
const typingThrottle = new Map() // userId:receiverId -> lastSentTimestamp
socket.on('chat:typing', ({ receiverId }) => {
  const key = `${userId}:${receiverId}`
  const now = Date.now()
  if (now - (typingThrottle.get(key) || 0) < 1000) return // throttle to 1/sec
  typingThrottle.set(key, now)
  const receiverSocketId = onlineUsers.get(receiverId)
  if (receiverSocketId) io.to(receiverSocketId).emit('chat:typing', { senderId: userId, username: socket.user.username })
})
```

---

### BUG-008
**Severity:** MEDIUM  
**Title:** Review errors silently return empty data instead of error response  
**File:** `backend/routes/reviews.js`  
**Problem:**  
```js
} catch (err) {
  console.error('Get reviews error:', err)
  // Returns 200 OK with empty data — client has no idea something failed
  res.json({
    reviews: [], total: 0, page: 1, pages: 0, hasMore: false,
    stats: { rating: 0, ratingCount: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
  })
}
```
Errors are hidden from the client. The user sees "no reviews" when in reality the DB query failed.

**Fix:**
```js
} catch (err) {
  console.error('Get reviews error:', err)
  res.status(500).json({ message: 'Gagal memuat ulasan' })
}
```

---

### BUG-009
**Severity:** LOW  
**Title:** `viewTracker` uses unbounded `Map` — memory grows until cleanup cycle  
**File:** `backend/lib/viewTracker.js`  
**Problem:**  
```js
const seen = new Map() // no size limit
setInterval(() => { /* cleanup every 30 min */ }, 30 * 60 * 1000)
```
Between 30-minute cleanup cycles, the Map can accumulate hundreds of thousands of entries. At 10,000 unique visitors/day each viewing 20 posts = 200,000 entries before cleanup. Each entry ~100 bytes = ~20MB of RAM just for view deduplication.

**Fix:**
```js
// npm install lru-cache
import { LRUCache } from 'lru-cache'
const seen = new LRUCache({
  max: 50_000,
  ttl: 4 * 60 * 60 * 1000, // 4 hours
})
// Remove the setInterval cleanup — LRUCache handles it automatically
```

---

### BUG-010
**Severity:** LOW  
**Title:** Notification collection has no TTL — grows forever  
**File:** `backend/models/Notification.js`  
**Problem:**  
No TTL index exists. Every notification ever created stays in the database permanently. After months of operation with active users, this collection becomes a major query performance bottleneck.

**Fix:**
```js
// Auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })
// OR: delete only read notifications older than 30 days via cron job
```

---

### BUG-011
**Severity:** LOW  
**Title:** `Deposit` model missing compound index on `{status, expiredAt}` needed by payment expiry job  
**File:** `backend/models/Deposit.js`, `backend/lib/jobs/marketplaceJobs.js`  
**Problem:**  
The payment expiry job runs every 5 minutes:
```js
await Deposit.updateMany(
  { status: PAYMENT_STATUS.WAITING, expiredAt: { $lte: new Date() } },
  { status: PAYMENT_STATUS.EXPIRED }
)
```
The Deposit model only has `{ status: 1 }` as a separate index. The query filters on BOTH `status` AND `expiredAt`, so MongoDB cannot use the single-field index efficiently — may cause collection scans.

**Fix:**
```js
// In Deposit model, replace:
depositSchema.index({ status: 1 })
// With compound index:
depositSchema.index({ status: 1, expiredAt: 1 })
```

---

### BUG-012
**Severity:** LOW  
**Title:** Background jobs use fixed polling interval regardless of activity level  
**File:** `backend/lib/jobs/marketplaceJobs.js`  
**Problem:**  
All three jobs run at fixed intervals unconditionally:
- Auto-confirm: every 60 seconds = 1,440 DB queries/day even if no orders need confirming
- Moderator reassign: every 60 seconds = 1,440 DB queries/day
- Payment expire: every 5 minutes = 288 queries/day

At zero traffic (e.g., 3AM), these queries run and return no results, wasting DB resources.

**Fix:**
```js
// Adaptive interval — back off when nothing is found
let confirmInterval = 60_000
async function runAutoConfirm() {
  const orders = await Order.find({ status: 'delivered', buyerCheckDeadline: { $lte: new Date() } })
  if (orders.length === 0) {
    confirmInterval = Math.min(confirmInterval * 1.5, 10 * 60_000) // max 10 min
  } else {
    confirmInterval = 60_000 // reset to 1 min when active
    for (const order of orders) await confirmOrder(...)
  }
  setTimeout(runAutoConfirm, confirmInterval)
}
runAutoConfirm()
```

---

## SECTION 3 — PERFORMANCE & RESOURCE ISSUES

---

### PERF-001
**Severity:** HIGH  
**Title:** No HTTP response compression middleware  
**File:** `backend/server.js`, `backend/package.json`  
**Problem:**  
`compression` package is absent from `package.json`. All API responses (JSON lists of posts, orders, notifications, etc.) are sent uncompressed. JSON compresses extremely well with gzip.

**Estimated savings:** 60–80% bandwidth reduction on API responses.

**Fix:**
```bash
npm install compression
```
```js
// server.js — add BEFORE all routes
import compression from 'compression'
app.use(compression({ level: 6, threshold: 1024 }))
```

---

### PERF-002
**Severity:** HIGH  
**Title:** Static files served without cache headers — browser re-downloads images every visit  
**File:** `backend/server.js`  
**Problem:**  
```js
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
```
No `maxAge` or cache control headers. Every page load causes the browser to re-request all images (avatars, post images, banners).

**Fix:**
```js
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '30d',
  etag: true,
  lastModified: true,
  immutable: false,
}))
```

---

### PERF-003
**Severity:** HIGH  
**Title:** `/api/categories` makes 2 DB queries on every single request — no caching  
**File:** `backend/server.js`  
**Problem:**  
```js
app.get('/api/categories', async (req, res) => {
  const count = await Category.countDocuments()  // query 1 — every request
  if (count === 0) { await Category.insertMany(docs) }
  const cats = await Category.find({ isActive: true }).sort(...)  // query 2 — every request
  res.json(cats)
})
```
Categories change rarely (only when admin edits them), but every homepage load triggers 2 DB queries. At 1,000 concurrent users, this is 2,000 unnecessary DB queries for static data.

**Fix:**
```js
let _categoriesCache = null
let _cacheExpiry = 0

app.get('/api/categories', async (req, res) => {
  if (_categoriesCache && Date.now() < _cacheExpiry) {
    return res.json(_categoriesCache)
  }
  const count = await Category.countDocuments()
  if (count === 0) {
    const docs = GAME_CATEGORIES.map((c, i) => ({ ...c, order: i, isActive: true }))
    await Category.insertMany(docs)
  }
  const cats = await Category.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean()
  _categoriesCache = cats
  _cacheExpiry = Date.now() + 10 * 60 * 1000 // 10 minutes
  res.json(cats)
})

// Bust cache when admin updates categories (in admin routes after create/update/delete):
export function bustCategoriesCache() { _categoriesCache = null }
```

---

### PERF-004
**Severity:** MEDIUM  
**Title:** `.lean()` missing on almost all read-only DB queries — 2–5x slower than necessary  
**File:** All files in `backend/routes/`  
**Problem:**  
Out of 174+ Mongoose queries across all route files, only 4 use `.lean()`. Every `find()` or `findOne()` without `.lean()` instantiates full Mongoose Document objects with prototype methods, virtuals, change tracking, etc. For read-only API responses, this overhead is pure waste.

**Benchmark impact:** `.lean()` returns plain JS objects, typically 2–5x faster and uses 40–60% less memory.

**Fix — Add `.lean()` to every GET route query that does NOT need Mongoose document methods (no `.save()`, no virtuals used):**
```js
// Example pattern — apply to ALL of these routes:
// GET /api/posts, GET /api/notifications, GET /api/orders (list),
// GET /api/reviews, GET /api/forum, GET /api/wishlist, GET /api/search

const posts = await Post.find(query).sort(sortOption).skip(skip).limit(limit)
  .populate('seller', 'username avatar role verified totalSales rating ratingCount')
  .lean()  // ← add this
```

**Routes to prioritize:**
- `backend/routes/posts.js` — GET / (post list)
- `backend/routes/notifications.js` — GET /
- `backend/routes/orders.js` — GET / (order list)
- `backend/routes/reviews.js` — GET /seller/:username
- `backend/routes/forum.js` — GET /
- `backend/routes/admin.js` — GET /users, GET /posts
- `backend/routes/search.js` — all routes (already some `.lean()` here)

---

### PERF-005
**Severity:** MEDIUM  
**Title:** Vite build has no manual chunk splitting — all vendor code in one bundle  
**File:** `frontend/vite.config.js`  
**Problem:**  
No `build.rollupOptions.output.manualChunks` configuration. All libraries (React, axios, zustand, socket.io-client, lucide-react, date-fns, etc.) are bundled together with application code. Any app code change invalidates the entire vendor bundle in browser cache.

**Fix:**
```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
          'vendor-utils': ['axios', 'zustand', 'date-fns'],
          'vendor-socket': ['socket.io-client'],
        }
      }
    }
  },
  server: { /* existing config */ }
})
```

---

### PERF-006
**Severity:** LOW  
**Title:** Admin `GET /users` query uses unindexed `$regex` on email field  
**File:** `backend/routes/admin.js`  
**Problem:**  
```js
if (search) {
  query.$or = [
    { username: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ]
}
```
`$regex` without a text index causes a full collection scan on the User collection. As user count grows, admin user search will become progressively slower.

**Fix:**
```js
// Option A: Add text index to User model
userSchema.index({ username: 'text', email: 'text' })
// Then query: query.$text = { $search: search }

// Option B: Use anchored regex for username (faster — uses the unique index)
{ username: { $regex: `^${escaped}`, $options: 'i' } }
```

---

## SECTION 4 — MISSING FEATURES (for completeness)

---

### FEAT-001 — Email verification on register (links to SEC-005)  
**File:** `backend/routes/auth.js`

### FEAT-002 — Forgot password / reset password (links to SEC-006)  
**File:** `backend/routes/auth.js`

### FEAT-003 — Email notifications for critical events  
**Description:** Order placed, order delivered, dispute opened, withdrawal status — all currently in-app only. No email fallback when user is offline.

### FEAT-004 — Chat history pagination (currently hard-capped at 100 messages)  
**File:** `backend/routes/chat.js` — `.limit(100)` with no cursor/page support

### FEAT-005 — Two-Factor Authentication (2FA)  
**Description:** No TOTP or SMS 2FA. Critical for accounts with real money (wallet).

### FEAT-006 — Seller analytics dashboard  
**Description:** Views per post, conversion rate, revenue over time — not available to sellers.

### FEAT-007 — Saved search alerts  
**Description:** Users cannot save search filters and receive notifications when new matching listings appear.

---

## QUICK REFERENCE — PRIORITY ORDER FOR AI AGENT

Execute fixes in this order for maximum impact:

```
IMMEDIATE (before any deployment):
  SEC-001 — Rotate all secret keys
  SEC-002 — Encrypt delivery credentials
  SEC-003 — Block payment simulation in production

SPRINT 1 (security hardening):
  SEC-004 — Raise password minimum length to 8
  SEC-005 — Add email verification
  SEC-006 — Add forgot/reset password
  SEC-007 — Tighten CSP (remove unsafe-inline for scripts)
  SEC-009 — Moderator cannot verify users
  SEC-011 — Validate offer belongs to correct order

SPRINT 2 (performance quick wins):
  PERF-001 — Add compression middleware (10 min effort)
  PERF-002 — Add cache headers to /uploads (5 min effort)
  PERF-003 — Cache /api/categories in memory (30 min effort)
  PERF-004 — Add .lean() to all GET routes (2 hours effort)
  BUG-011  — Add compound index {status, expiredAt} to Deposit

SPRINT 3 (bugs and medium-effort perf):
  BUG-003  — Remove redundant wallet polling
  BUG-004  — Fix N+1 in getCommentsWithReplies
  BUG-005  — Fix sellerRank double query
  BUG-006  — Reduce buildConversationSummary from 6 to 0 extra queries
  BUG-007  — Throttle chat:typing events
  BUG-008  — Fix review error swallowing
  SEC-008  — Scope io.emit to relevant users
  PERF-005 — Vite chunk splitting

SPRINT 4 (architecture):
  BUG-001  — Fix wallet race condition
  BUG-002  — Add MongoDB replica set + transactions for escrow
  BUG-009  — Replace viewTracker Map with LRU cache
  BUG-010  — Add TTL index to Notification
  BUG-012  — Adaptive background job intervals
  PERF-006 — Index user search fields
```

---

*Total issues: 11 Security · 12 Bugs · 6 Performance · 7 Missing Features = 36 total*  
*Generated from full source code analysis of backend/ and frontend/ directories.*
