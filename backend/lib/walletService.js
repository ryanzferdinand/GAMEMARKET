import mongoose from 'mongoose'
import Wallet from '../models/Wallet.js'
import WalletTransaction from '../models/WalletTransaction.js'

function snapshot(wallet) {
  return {
    available: wallet.availableBalance,
    pending: wallet.pendingBalance,
    frozen: wallet.frozenBalance,
  }
}

export async function getOrCreateWallet(userId, session = null) {
  const q = Wallet.findOne({ user: userId })
  if (session) q.session(session)
  let wallet = await q
  if (!wallet) {
    const created = await Wallet.create([{ user: userId }], session ? { session } : {})
    wallet = created[0]
  }
  return wallet
}

async function recordTx(wallet, userId, type, amount, referenceType, referenceId, description, meta, session) {
  const before = snapshot(wallet)
  const tx = await WalletTransaction.create([{
    wallet: wallet._id,
    user: userId,
    type,
    amount,
    balanceBefore: before,
    balanceAfter: snapshot(wallet),
    referenceType,
    referenceId,
    description,
    meta,
  }], session ? { session } : {})
  return tx[0]
}

export async function creditAvailable(userId, amount, type, referenceType, referenceId, description, meta = {}) {
  if (amount <= 0) throw new Error('Amount must be positive')

  const wallet = await getOrCreateWallet(userId)

  const before = await Wallet.findOneAndUpdate(
    { _id: wallet._id },
    { $inc: { availableBalance: amount } },
    { new: false },
  )

  const updated = await Wallet.findById(wallet._id)

  const tx = await WalletTransaction.create({
    wallet: updated._id,
    user: userId,
    type,
    amount,
    balanceBefore: snapshot(before),
    balanceAfter: snapshot(updated),
    referenceType,
    referenceId,
    description,
    meta,
  })

  return { wallet: updated, tx }
}

export async function debitAvailable(userId, amount, type, referenceType, referenceId, description, meta = {}) {
  if (amount <= 0) throw new Error('Amount must be positive')

  const wallet = await getOrCreateWallet(userId)

  const before = await Wallet.findOneAndUpdate(
    { _id: wallet._id, availableBalance: { $gte: amount } },
    { $inc: { availableBalance: -amount } },
    { new: false },
  )

  if (!before) throw new Error('Saldo tidak mencukupi')

  const updated = await Wallet.findById(wallet._id)

  const tx = await WalletTransaction.create({
    wallet: updated._id,
    user: userId,
    type,
    amount,
    balanceBefore: snapshot(before),
    balanceAfter: snapshot(updated),
    referenceType,
    referenceId,
    description,
    meta,
  })

  return { wallet: updated, tx }
}

export async function addSellerPending(userId, amount, referenceType, referenceId, description) {
  const wallet = await getOrCreateWallet(userId)

  const before = await Wallet.findOneAndUpdate(
    { _id: wallet._id },
    { $inc: { pendingBalance: amount } },
    { new: false },
  )

  const updated = await Wallet.findById(wallet._id)

  const tx = await WalletTransaction.create({
    wallet: updated._id,
    user: userId,
    type: 'escrow_release',
    amount,
    balanceBefore: snapshot(before),
    balanceAfter: snapshot(updated),
    referenceType,
    referenceId,
    description,
    meta: {},
  })

  return { wallet: updated, tx }
}

export async function releasePendingToAvailable(userId, pendingAmount, availableAmount, referenceType, referenceId, description) {
  const wallet = await getOrCreateWallet(userId)

  const before = await Wallet.findOneAndUpdate(
    { _id: wallet._id, pendingBalance: { $gte: pendingAmount } },
    { $inc: { pendingBalance: -pendingAmount, availableBalance: availableAmount } },
    { new: false },
  )

  if (!before) throw new Error('Pending balance insufficient')

  const updated = await Wallet.findById(wallet._id)

  const tx = await WalletTransaction.create({
    wallet: updated._id,
    user: userId,
    type: 'escrow_release',
    amount: availableAmount,
    balanceBefore: snapshot(before),
    balanceAfter: snapshot(updated),
    referenceType,
    referenceId,
    description,
    meta: { pendingReleased: pendingAmount },
  })

  return { wallet: updated, tx }
}

export async function freezeFunds(userId, amount, referenceType, referenceId, description) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const wallet = await getOrCreateWallet(userId, session)
    wallet.frozenBalance += amount
    await wallet.save({ session })
    const tx = await recordTx(wallet, userId, 'freeze', amount, referenceType, referenceId, description, {}, session)
    await session.commitTransaction()
    return { wallet, tx }
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
}

export async function unfreezeToAvailable(userId, amount, referenceType, referenceId, description) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const wallet = await getOrCreateWallet(userId, session)
    if (wallet.frozenBalance < amount) throw new Error('Frozen balance insufficient')
    wallet.frozenBalance -= amount
    wallet.availableBalance += amount
    await wallet.save({ session })
    const tx = await recordTx(wallet, userId, 'unfreeze', amount, referenceType, referenceId, description, {}, session)
    await session.commitTransaction()
    return { wallet, tx }
  } catch (err) {
    await session.abortTransaction()
    throw err
  } finally {
    session.endSession()
  }
}

export async function getWalletSummary(userId) {
  const wallet = await getOrCreateWallet(userId)
  return {
    availableBalance: wallet.availableBalance,
    pendingBalance: wallet.pendingBalance,
    frozenBalance: wallet.frozenBalance,
    totalBalance: wallet.totalBalance,
    currency: wallet.currency,
  }
}

export async function debitAvailableInSession(session, userId, amount, type, referenceType, referenceId, description, meta = {}) {
  const wallet = await getOrCreateWallet(userId, session)
  if (wallet.availableBalance < amount) throw new Error('Saldo tidak mencukupi')
  wallet.availableBalance -= amount
  await wallet.save({ session })
  return recordTx(wallet, userId, type, amount, referenceType, referenceId, description, meta, session)
}

export async function addSellerPendingInSession(session, userId, amount, referenceType, referenceId, description) {
  const wallet = await getOrCreateWallet(userId, session)
  wallet.pendingBalance += amount
  await wallet.save({ session })
  return recordTx(wallet, userId, 'escrow_release', amount, referenceType, referenceId, description, {}, session)
}
