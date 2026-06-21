import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { detectDeployMode } from './lib/env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, ...options.env },
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

function spawnDetached(title, command, cwd) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', title, 'cmd', '/k', command], {
      cwd,
      detached: true,
      stdio: 'ignore',
    }).unref()
    return
  }

  spawn(command, [], {
    cwd,
    detached: true,
    stdio: 'ignore',
    shell: true,
  }).unref()
}

async function killPort(port) {
  if (process.platform !== 'win32') return
  try {
    const { execSync } = await import('child_process')
    const out = execSync(`netstat -aon | findstr ":${port} "`, { encoding: 'utf8' })
    const pids = new Set()
    for (const line of out.split('\n')) {
      const match = line.trim().match(/\s(\d+)\s*$/)
      if (match) pids.add(match[1])
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
      } catch {}
    }
  } catch {}
}

async function buildFrontend(frontendEnv) {
  const env = {
    ...process.env,
    VITE_GOOGLE_CLIENT_ID: frontendEnv.VITE_GOOGLE_CLIENT_ID || '',
    // Empty = same-origin in production (custom domain)
    VITE_BACKEND_URL: frontendEnv.VITE_BACKEND_URL || '',
  }
  console.log('\n📦 Building frontend for production...')
  await run('npm', ['run', 'build'], { cwd: path.join(ROOT, 'frontend'), env })
}

async function startLocal() {
  console.log('======================================')
  console.log(' GameMarket — Local Development Mode')
  console.log('======================================\n')
  console.log('No production domain configured — running locally.\n')
  console.log('To publish with a custom domain, set in backend/.env:')
  console.log('  NODE_ENV=production')
  console.log('  FRONTEND_URL=https://yourdomain.com')
  console.log('  MONGODB_URI=your_mongodb_atlas_uri')
  console.log('  JWT_SECRET=your_secret\n')

  await killPort(5000)
  await killPort(3000)

  const backendDir = path.join(ROOT, 'backend')
  const frontendDir = path.join(ROOT, 'frontend')

  spawnDetached(
    'GameMarket Backend',
    `cd /d "${backendDir}" && npm run dev`,
    backendDir
  )

  await new Promise((r) => setTimeout(r, 2000))

  spawnDetached(
    'GameMarket Frontend',
    `cd /d "${frontendDir}" && npm run dev`,
    frontendDir
  )

  console.log('======================================')
  console.log(' Both servers started!')
  console.log(' Frontend : http://localhost:3000')
  console.log(' Backend  : http://localhost:5000')
  console.log(' Admin    : http://localhost:3000/admin')
  console.log('======================================\n')
}

async function startProduction(config) {
  console.log('======================================')
  console.log(' GameMarket — Production Mode')
  console.log('======================================\n')
  console.log(`Site URL: ${config.frontendUrl}\n`)

  const distDir = path.join(ROOT, 'frontend', 'dist')
  await buildFrontend(config.frontendEnv)

  await killPort(Number(config.backendEnv.PORT) || 5000)

  console.log('Starting production server...\n')
  await run('npm', ['start'], {
    cwd: path.join(ROOT, 'backend'),
    env: {
      ...process.env,
      ...config.backendEnv,
      NODE_ENV: 'production',
    },
  })
}

async function main() {
  const forceMode = process.argv[2]
  const config = detectDeployMode()
  const mode = forceMode === 'local' || forceMode === 'production' ? forceMode : config.mode

  if (mode === 'production') {
    await startProduction(config)
  } else {
    await startLocal()
  }
}

main().catch((err) => {
  console.error('Failed to start:', err.message)
  process.exit(1)
})
