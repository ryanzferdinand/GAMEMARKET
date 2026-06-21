import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')

const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i

export function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const env = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

export function isLocalOrigin(url) {
  if (!url) return true
  return LOCAL_ORIGIN_RE.test(url.trim())
}

export function detectDeployMode() {
  const backendEnv = readEnvFile(path.join(ROOT, 'backend', '.env'))
  const frontendEnv = readEnvFile(path.join(ROOT, 'frontend', '.env'))

  const nodeEnv = backendEnv.NODE_ENV || process.env.NODE_ENV || 'development'
  const frontendUrl = backendEnv.FRONTEND_URL || 'http://localhost:3000'
  const hasSecrets =
    Boolean(backendEnv.JWT_SECRET) &&
    backendEnv.JWT_SECRET !== 'your_super_secret_jwt_key_here' &&
    Boolean(backendEnv.MONGODB_URI)

  if (nodeEnv === 'production' && !isLocalOrigin(frontendUrl) && hasSecrets) {
    return {
      mode: 'production',
      backendEnv,
      frontendEnv,
      frontendUrl,
    }
  }

  return {
    mode: 'local',
    backendEnv,
    frontendEnv,
    frontendUrl: 'http://localhost:3000',
  }
}
