/**
 * Make Admin Script
 * Usage (from backend folder): node make-admin.js <email>
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const email = process.argv[2]

if (!email) {
  console.error('\n❌  Usage: node make-admin.js <email>')
  console.error('    Example: node make-admin.js ryanzferdinandz@gmail.com\n')
  process.exit(1)
}

const userSchema = new mongoose.Schema({ username: String, email: String, role: String }, { strict: false })
const User = mongoose.model('User', userSchema)

await mongoose.connect(process.env.MONGODB_URI)
console.log('✅ MongoDB connected\n')

const user = await User.findOne({ email: email.toLowerCase() })

if (!user) {
  console.error(`❌  No user with email: ${email}`)
  console.error(`    Register first at http://localhost:3000/register\n`)
  await mongoose.disconnect()
  process.exit(1)
}

const prev = user.role
user.role = 'admin'
await user.save()

console.log(`✅ Done!`)
console.log(`   Username : ${user.username}`)
console.log(`   Email    : ${user.email}`)
console.log(`   Role     : ${prev} → admin`)
console.log(`\n👉 Log out and log back in to access the Admin Panel.\n`)

await mongoose.disconnect()
