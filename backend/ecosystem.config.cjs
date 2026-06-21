// PM2 Ecosystem Config — digunakan oleh vps-deploy.sh
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/
//
// Usage manual:
//   pm2 start ecosystem.config.cjs
//   pm2 restart ecosystem.config.cjs --env production

module.exports = {
  apps: [
    {
      name: 'gamemarket-backend',
      script: 'server.js',

      // ── Instance & Cluster ────────────────────────────────────────────────
      instances: 1,          // Ganti ke 'max' untuk cluster mode (multi-core)
      exec_mode: 'fork',     // 'fork' atau 'cluster'

      // ── Environment ───────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // ── Restart policy ────────────────────────────────────────────────────
      max_memory_restart: '512M',   // Restart jika pakai RAM > 512MB
      exp_backoff_restart_delay: 100, // Exponential backoff saat crash loop
      max_restarts: 10,
      min_uptime: '5s',             // Jika crash < 5s dianggap crash loop

      // ── Logging ───────────────────────────────────────────────────────────
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      log_type: 'json',

      // ── Watch (nonaktifkan di production) ─────────────────────────────────
      watch: false,

      // ── Graceful shutdown ─────────────────────────────────────────────────
      kill_timeout: 5000,    // Tunggu 5s sebelum force kill
      listen_timeout: 8000,  // Timeout untuk mode cluster ready signal
    },
  ],
}
