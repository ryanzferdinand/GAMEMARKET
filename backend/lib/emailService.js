/**
 * emailService.js
 *
 * Providers:
 *   EMAIL_PROVIDER=zoho   → smtp.zoho.com:465 (SSL)
 *   EMAIL_PROVIDER=brevo  → smtp-relay.brevo.com:587 (STARTTLS)
 *   (kosong)              → dev mode, log ke console
 *
 * PENTING — Zoho: EMAIL_FROM harus sama persis dengan ZOHO_USER
 */

import nodemailer from 'nodemailer'

function createTransporter() {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase()
  if (provider === 'zoho') {
    return nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: { user: process.env.ZOHO_USER, pass: process.env.ZOHO_PASS },
      tls: { rejectUnauthorized: true },
    })
  }
  if (provider === 'brevo') {
    return nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_PASS },
    })
  }
  return null
}

function isConfigured() {
  const p = (process.env.EMAIL_PROVIDER || '').toLowerCase()
  if (p === 'zoho')  return !!(process.env.ZOHO_USER && process.env.ZOHO_PASS)
  if (p === 'brevo') return !!(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS)
  return false
}

// Zoho: from address MUST match the authenticated account exactly
function getFrom() {
  let addr = process.env.EMAIL_FROM
  if (!addr) {
    const p = (process.env.EMAIL_PROVIDER || '').toLowerCase()
    if (p === 'zoho')  addr = process.env.ZOHO_USER
    if (p === 'brevo') addr = process.env.BREVO_SMTP_USER
  }
  const name = process.env.EMAIL_FROM_NAME || 'SchwinMarket'
  return `"${name}" <${addr || 'noreply@example.com'}>`
}

function getSiteName() {
  return process.env.EMAIL_FROM_NAME || 'SchwinMarket'
}

function getSiteUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:3000'
}

// ── Core send ────────────────────────────────────────────────────────────────
export async function sendEmail({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.log('\n📧 [EMAIL - DEV MODE]')
    console.log(`   To     : ${to}`)
    console.log(`   Subject: ${subject}`)
    console.log(`   Body   : ${text || '(HTML only)'}`)
    console.log('─'.repeat(60))
    return { messageId: 'dev-mode', preview: text }
  }

  const transporter = createTransporter()
  const info = await transporter.sendMail({ from: getFrom(), to, subject, text, html })
  console.log(`📧 Email sent → ${to} [${info.messageId}]`)
  return info
}

// ── Template helper ──────────────────────────────────────────────────────────
function emailShell({ title, preheader, bodyHtml }) {
  const siteName = getSiteName()
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="id" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>${title}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .email-wrap{max-width:560px;margin:0 auto;padding:40px 16px 60px}
  .card{background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.04)}
  .header{background:linear-gradient(135deg,#0055bb 0%,#0077ed 100%);padding:36px 40px 32px;text-align:center}
  .header-icon{width:52px;height:52px;background:rgba(255,255,255,0.18);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px}
  .header h1{color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.4px;margin:0}
  .header p{color:rgba(255,255,255,0.78);font-size:13px;margin-top:4px;letter-spacing:0.1px}
  .body{padding:36px 40px}
  .greeting{font-size:16px;color:#1d1d1f;font-weight:600;margin-bottom:10px}
  .desc{font-size:15px;color:#48484a;line-height:1.65;margin-bottom:28px}
  .otp-box{text-align:center;margin:0 0 28px}
  .otp-label{font-size:12px;font-weight:600;color:#86868b;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px}
  .otp-digits{display:inline-flex;gap:10px;background:#f5f5f7;border:1.5px solid #e0e0e5;border-radius:16px;padding:18px 28px}
  .otp-digit{font-size:34px;font-weight:800;color:#0066cc;font-family:"SF Mono",Menlo,"Courier New",monospace;letter-spacing:2px;line-height:1;min-width:28px;text-align:center}
  .otp-sep{font-size:26px;color:#d1d1d6;font-weight:300;align-self:center;margin:0 2px}
  .timer-row{text-align:center;margin-bottom:24px}
  .timer-pill{display:inline-flex;align-items:center;gap:6px;background:#fff7ed;border:1px solid #fed7aa;border-radius:100px;padding:7px 16px;font-size:13px;color:#c2410c;font-weight:600}
  .divider{height:1px;background:#f0f0f5;margin:24px 0}
  .note{font-size:13px;color:#86868b;line-height:1.6;text-align:center}
  .note strong{color:#48484a}
  .warning-box{background:#fff8f0;border:1px solid #ffe0b2;border-radius:12px;padding:14px 18px;margin:20px 0;display:flex;gap:12px;align-items:flex-start}
  .warning-icon{font-size:18px;flex-shrink:0;margin-top:1px}
  .warning-text{font-size:13px;color:#7c4a0b;line-height:1.55}
  .footer{padding:24px 40px;background:#f9f9fb;border-top:1px solid #f0f0f5;text-align:center}
  .footer p{font-size:12px;color:#aeaeb2;line-height:1.6}
  .footer a{color:#0066cc;text-decoration:none}
  @media(max-width:560px){
    .email-wrap{padding:16px 8px 40px}
    .header{padding:28px 24px 24px}
    .body{padding:28px 24px}
    .footer{padding:20px 24px}
    .otp-digits{padding:14px 20px;gap:8px}
    .otp-digit{font-size:28px;min-width:22px}
  }
</style>
</head>
<body>
<div class="email-wrap">
  <div class="card">
    <div class="header">
      <div class="header-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="7" width="18" height="13" rx="3" stroke="white" stroke-width="1.8" fill="none"/>
          <path d="M3 10l9 5 9-5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <h1>${siteName}</h1>
      <p>Verifikasi Email Akun</p>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>&copy; ${year} ${siteName}. Semua hak dilindungi.<br/>
      Email ini dikirim otomatis — <strong>jangan dibalas</strong>.<br/>
      Jika kamu tidak merasa mendaftar, <a href="${getSiteUrl()}">abaikan email ini</a>.</p>
    </div>
  </div>
</div>
</body>
</html>`
}

// ── OTP Verification Email (primary — hanya OTP, no link) ───────────────────
export async function sendOtpEmail({ to, username, otp }) {
  const siteName = getSiteName()
  const digits = String(otp).split('')

  // Split into two groups: XXX · XXX
  const group1 = digits.slice(0, 3)
  const group2 = digits.slice(3, 6)

  const otpDigitsHtml =
    group1.map(d => `<span class="otp-digit">${d}</span>`).join('') +
    `<span class="otp-sep">&thinsp;&bull;&thinsp;</span>` +
    group2.map(d => `<span class="otp-digit">${d}</span>`).join('')

  const bodyHtml = `
    <p class="greeting">Halo, ${username}! 👋</p>
    <p class="desc">Masukkan kode berikut di halaman verifikasi untuk mengaktifkan akun ${siteName} kamu.</p>

    <div class="otp-box">
      <div class="otp-label">Kode Verifikasi Kamu</div>
      <div class="otp-digits">${otpDigitsHtml}</div>
    </div>

    <div class="timer-row">
      <div class="timer-pill">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        Berlaku selama 10 menit
      </div>
    </div>

    <div class="divider"></div>

    <div class="warning-box">
      <span class="warning-icon">🔒</span>
      <div class="warning-text">
        <strong>Jangan bagikan kode ini</strong> kepada siapapun, termasuk tim ${siteName}.
        Kami tidak pernah meminta kode verifikasi melalui telepon atau chat.
      </div>
    </div>

    <p class="note">Jika kamu tidak mendaftar di ${siteName}, abaikan email ini. Tidak ada tindakan yang perlu dilakukan.</p>`

  const text = `Halo ${username},\n\nKode verifikasi ${siteName} kamu: ${otp}\n\nBerlaku 10 menit. Jangan bagikan kode ini kepada siapapun.`

  return sendEmail({
    to,
    subject: `${otp} adalah kode verifikasi ${siteName} kamu`,
    html: emailShell({ title: `Kode Verifikasi ${siteName}`, preheader: `Kode: ${otp} — berlaku 10 menit`, bodyHtml }),
    text,
  })
}

// ── Welcome / account created email ─────────────────────────────────────────
export async function sendWelcomeEmail({ to, username }) {
  const siteName = getSiteName()
  const siteUrl  = getSiteUrl()

  const bodyHtml = `
    <p class="greeting">Selamat datang di ${siteName}, ${username}! 🎉</p>
    <p class="desc">Akun kamu sudah aktif dan siap digunakan. Mulai jelajahi ribuan akun game yang tersedia atau mulai jual akun kamu sekarang.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${siteUrl}" style="display:inline-block;background:#0066cc;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;letter-spacing:-0.2px">
        Mulai Sekarang →
      </a>
    </div>
    <div class="divider"></div>
    <p class="note">Ada pertanyaan? Hubungi kami di <a href="${siteUrl}" style="color:#0066cc">${siteUrl}</a></p>`

  const text = `Selamat datang di ${siteName}, ${username}!\n\nAkun kamu sudah aktif. Kunjungi ${siteUrl} untuk mulai.`

  return sendEmail({
    to,
    subject: `Selamat datang di ${siteName}, ${username}!`,
    html: emailShell({ title: `Selamat datang di ${siteName}`, preheader: `Akun kamu sudah aktif`, bodyHtml }),
    text,
  })
}

// ── Password reset email ───────────────────────────────────────────────────────
export async function sendPasswordResetEmail({ to, username, token }) {
  const siteName = getSiteName()
  const siteUrl = getSiteUrl()
  const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`

  const bodyHtml = `
    <p class="greeting">Halo ${username},</p>
    <p class="desc">Kami menerima permintaan reset password untuk akun ${siteName} kamu. Klik tombol di bawah untuk membuat password baru.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${resetUrl}" style="display:inline-block;background:#0066cc;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">
        Reset Password →
      </a>
    </div>
    <p class="note">Link berlaku 1 jam. Jika kamu tidak meminta reset, abaikan email ini.</p>
    <p class="note" style="word-break:break-all">Atau salin link: ${resetUrl}</p>`

  const text = `Halo ${username},\n\nReset password ${siteName}: ${resetUrl}\n\nBerlaku 1 jam.`

  return sendEmail({
    to,
    subject: `Reset password ${siteName}`,
    html: emailShell({ title: 'Reset Password', preheader: 'Link reset password — berlaku 1 jam', bodyHtml }),
    text,
  })
}
