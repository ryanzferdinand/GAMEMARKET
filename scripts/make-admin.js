/**
 * Make Admin Script
 * Usage: node scripts/make-admin.js <email>
 * Example: node scripts/make-admin.js ryanzferdinandz@gmail.com
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../backend/.env') })

const email = process.argv[2]

if (!email) {
  console.error('\n❌  Usage: node scripts/make-admin.js <email>')
  console.error('    Example: node scripts/make-admin.js ryanzferdinandz@gmail.com\n')
  process.exit(1)
}

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  role: String,
}, { strict: false })

const User = mongoose.model('User', userSchema)

async function main() {
  try {
    console.log(`\n🔌 Connecting to MongoDB...`)
    await mongoose.connect(process.env.MONGODB_URI)
    console.log(`✅ Connected\n`)

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      console.error(`❌  No user found with email: ${email}`)
      console.error(`    Make sure you have registered first at http://localhost:3000/register\n`)
      process.exit(1)
    }

    const oldRole = user.role
    user.role = 'admin'
    await user.save()

    console.log(`✅ Success!`)
    console.log(`   User    : ${user.username}`)
    console.log(`   Email   : ${user.email}`)
    console.log(`   Role    : ${oldRole} → admin`)
    console.log(`\n👉 Log out and log back in on the site to see Admin Panel.\n`)

  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await mongoose.disconnect()
  }
}

main()
