import os from 'os'

const TRIAL_DAYS = 3
const LICENSE_VALIDITY_DAYS = 365
const MS_PER_DAY = 24 * 60 * 60 * 1000

interface LicenseState {
  installedAt: number
  licenseKey: string
  licenseValid: boolean
  licenseActivatedAt?: number
  licenseExpiresAt?: number
}

function getDeviceMacAddress(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.mac || 'unknown'
      }
    }
  }
  return 'unknown'
}

function getLicenseStatus(state: LicenseState) {
  const daysElapsed = (Date.now() - state.installedAt) / MS_PER_DAY
  const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - daysElapsed))
  const trialExpired = daysElapsed >= TRIAL_DAYS

  const hasLicense = !!state.licenseValid && !!state.licenseActivatedAt
  const licenseExpiresAt = hasLicense ? (state.licenseExpiresAt || state.licenseActivatedAt! + LICENSE_VALIDITY_DAYS * MS_PER_DAY) : null
  const licenseExpired = hasLicense && licenseExpiresAt && Date.now() >= licenseExpiresAt
  const licenseDaysLeft = hasLicense && licenseExpiresAt ? Math.max(0, Math.ceil((licenseExpiresAt - Date.now()) / MS_PER_DAY)) : 0

  return {
    trialExpired,
    daysLeft,
    licenseValid: hasLicense && !licenseExpired,
    licenseKey: state.licenseKey || '',
    licenseActivatedAt: state.licenseActivatedAt || null,
    licenseExpired,
    licenseDaysLeft,
    licenseExpiresAt,
    allowed: !trialExpired || (hasLicense && !licenseExpired),
  }
}

async function validateSnapTimeLicense(licenseKey: string): Promise<{ valid: boolean; error?: string; expiresAt?: number }> {
  try {
    const deviceId = getDeviceMacAddress()
    console.log('[License Validation] Key:', licenseKey, 'DeviceId:', deviceId)
    const response = await fetch('https://www.snaptime.nl/api/license/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: licenseKey,
        deviceId: deviceId,
      }),
    })
    const data: any = await response.json()
    console.log('[License API Response]', JSON.stringify(data, null, 2))
    if (data.valid) {
      let expiresAt: number | undefined
      if (data.expiresAt) {
        expiresAt = typeof data.expiresAt === 'string' ? new Date(data.expiresAt).getTime() : data.expiresAt
      } else if (data.expires_at) {
        expiresAt = typeof data.expires_at === 'string' ? new Date(data.expires_at).getTime() : data.expires_at
      } else if (data.expiry) {
        expiresAt = typeof data.expiry === 'string' ? new Date(data.expiry).getTime() : data.expiry
      }
      console.log('[License expiresAt]', expiresAt, 'from', data.expiresAt || data.expires_at || data.expiry)
      return { valid: true, expiresAt }
    }
    return { valid: false, error: data.error || 'Invalid license key' }
  } catch (error) {
    return { valid: false, error: String(error) }
  }
}

export { getLicenseStatus, validateSnapTimeLicense, TRIAL_DAYS }
