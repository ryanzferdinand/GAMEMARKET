const PATTERNS = [
  { name: 'whatsapp', regex: /(\+?\d{1,3}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}|wa\.me\/\d+|whatsapp/i },
  { name: 'telegram', regex: /t\.me\/[\w]+|telegram|@\w{4,}/i },
  { name: 'discord', regex: /discord\.gg\/[\w]+|discord/i },
  { name: 'line', regex: /line\.me\/[\w]+|\bline\s*id\b/i },
  { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'phone', regex: /(\+62|62|0)8[1-9]\d{6,10}/g },
  { name: 'social', regex: /instagram\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com/i },
]

function maskMatch(text, match) {
  const start = Math.max(0, match.index - 2)
  const end = Math.min(text.length, match.index + match[0].length + 2)
  const before = text.slice(0, start)
  const after = text.slice(end)
  const masked = '*'.repeat(Math.min(match[0].length + 4, 20))
  return before + masked + after
}

export function scanMessage(content = '') {
  if (!content?.trim()) {
    return { clean: true, warnings: [], maskedContent: content, detected: [] }
  }

  let maskedContent = content
  const warnings = []
  const detected = []

  for (const { name, regex } of PATTERNS) {
    const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
    const re = new RegExp(regex.source, flags)
    let match
    while ((match = re.exec(content)) !== null) {
      detected.push(name)
      warnings.push(`Kontak eksternal terdeteksi (${name}). Gunakan chat platform untuk keamanan.`)
      maskedContent = maskMatch(maskedContent, match)
    }
  }

  return {
    clean: detected.length === 0,
    warnings: [...new Set(warnings)],
    maskedContent,
    detected: [...new Set(detected)],
  }
}
