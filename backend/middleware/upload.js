import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { fileTypeFromBuffer } from 'file-type'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const uploadDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Use memory storage first to validate file type
const memoryStorage = multer.memoryStorage()

const memoryUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
})

// Middleware to validate file type and save to disk for single file
const validateAndSaveSingle = (fieldName) => [
  memoryUpload.single(fieldName),
  async (req, res, next) => {
    if (!req.file) {
      return next()
    }

    const allowed = /jpeg|jpg|png|gif|webp/
    const fileType = await fileTypeFromBuffer(req.file.buffer)
    
    if (!fileType || !allowed.test(fileType.ext)) {
      return res.status(400).json({ message: 'Hanya file gambar yang diizinkan (jpg, png, gif, webp)' })
    }

    // Save file to disk
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const filename = `${unique}.${fileType.ext}`
    const filepath = path.join(uploadDir, filename)
    
    fs.writeFileSync(filepath, req.file.buffer)
    
    // Replace req.file with the saved file info
    req.file.path = filepath
    req.file.filename = filename
    req.file.destination = uploadDir
    
    next()
  }
]

// Middleware to validate file type and save to disk for multiple files
const validateAndSaveArray = (fieldName, maxCount) => [
  memoryUpload.array(fieldName, maxCount),
  async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return next()
    }

    const allowed = /jpeg|jpg|png|gif|webp/
    const savedFiles = []
    
    for (const file of req.files) {
      const fileType = await fileTypeFromBuffer(file.buffer)
      
      if (!fileType || !allowed.test(fileType.ext)) {
        return res.status(400).json({ message: 'Hanya file gambar yang diizinkan (jpg, png, gif, webp)' })
      }

      // Save file to disk
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      const filename = `${unique}.${fileType.ext}`
      const filepath = path.join(uploadDir, filename)
      
      fs.writeFileSync(filepath, file.buffer)
      
      savedFiles.push({
        ...file,
        path: filepath,
        filename: filename,
        destination: uploadDir
      })
    }
    
    req.files = savedFiles
    next()
  }
]

export const upload = {
  single: validateAndSaveSingle,
  array: validateAndSaveArray
}
