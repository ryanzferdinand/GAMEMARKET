import fs from 'fs'
import { v2 as cloudinary } from 'cloudinary'

let enabled = false

export function initCloudinaryStorage() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    enabled = false
    return false
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  })

  enabled = true
  return true
}

export function isCloudinaryEnabled() {
  return enabled
}

function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `gamemarket/${folder}`,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (err, result) => {
        if (err) reject(err)
        else resolve(result)
      },
    )
    stream.end(buffer)
  })
}

function removeLocalTemp(file) {
  if (file?.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path)
    } catch {
      /* ignore */
    }
  }
}

/** Store one validated multer file → Cloudinary URL or local /uploads path */
export async function storeImage(file, folder = 'misc') {
  if (!file) return null

  if (enabled) {
    const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null)
    if (!buffer) throw new Error('File buffer kosong')

    const result = await uploadBuffer(buffer, folder)
    removeLocalTemp(file)
    return result.secure_url
  }

  return `/uploads/${file.filename}`
}

/** Store multiple files */
export async function storeImages(files = [], folder = 'misc') {
  if (!files.length) return []
  return Promise.all(files.map((f) => storeImage(f, folder)))
}
