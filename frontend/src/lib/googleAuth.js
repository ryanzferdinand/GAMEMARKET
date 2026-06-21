import { GOOGLE_CLIENT_ID } from './constants'

let initPromise = null
let currentCallback = null

function runInit(onSuccess, onError) {
  if (!window.google?.accounts?.id) {
    onError?.('Google Sign-In belum dimuat')
    return
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      if (response?.credential) onSuccess(response.credential)
      else onError?.('Token Google tidak diterima')
    },
    error_callback: (err) => {
      console.error('[Google Sign-In]', err)
      const msg =
        err?.type === 'popup_failed_to_open'
          ? 'Popup Google diblokir browser. Izinkan popup untuk situs ini.'
          : err?.type === 'popup_closed'
            ? 'Login Google dibatalkan'
            : 'Login Google gagal — cek Authorized JavaScript Origins di Google Console'
      onError?.(msg)
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: false,
    itp_support: true,
  })
}

/**
 * Load GSI script once and initialize Google Identity Services.
 * Requires Authorized JavaScript Origins (bukan Redirect URI):
 *   http://localhost:3000
 *   https://schwinn.my.id
 */
export function ensureGoogleSignIn(onSuccess, onError) {
  if (!GOOGLE_CLIENT_ID) {
    onError?.('VITE_GOOGLE_CLIENT_ID belum diatur di frontend/.env')
    return Promise.reject(new Error('Missing client ID'))
  }

  currentCallback = { onSuccess, onError }

  if (window.google?.accounts?.id) {
    runInit(onSuccess, onError)
    return Promise.resolve()
  }

  if (initPromise) {
    return initPromise.then(() => runInit(onSuccess, onError))
  }

  initPromise = new Promise((resolve, reject) => {
    let script = document.getElementById('google-gsi-script')
    if (!script) {
      script = document.createElement('script')
      script.id = 'google-gsi-script'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Gagal memuat script Google'))
  })

  return initPromise
    .then(() => runInit(onSuccess, onError))
    .catch((err) => {
      onError?.(err.message)
      throw err
    })
}

export function renderGoogleButton(elementId, { width = 360, text = 'signin_with' } = {}) {
  const el = document.getElementById(elementId)
  if (!el || !window.google?.accounts?.id) return

  el.innerHTML = ''
  window.google.accounts.id.renderButton(el, {
    theme: 'outline',
    size: 'large',
    width: Math.min(width, el.offsetWidth || 360),
    text,
    locale: 'id',
    shape: 'rectangular',
  })
}

export function promptGoogleOneTap(onSuccess, onError) {
  return ensureGoogleSignIn(onSuccess, onError).then(() => {
    window.google?.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap unavailable — button still works
      }
    })
  })
}
