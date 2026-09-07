// Fill in once the Gumroad product exists (Product > Share > permalink at the end of the URL)
const GUMROAD_PRODUCT_PERMALINK = 'SR0X1N7dk2fuXC3JfdPikw=='

const TRIAL_DAYS = 3
const LICENSE_VALIDITY_DAYS = 365
const MS_PER_DAY = 24 * 60 * 60 * 1000

interface LicenseState {
  installedAt: number
  licenseKey: string
  licenseValid: boolean
  licenseActivatedAt?: number
}

function getLicenseStatus(state: LicenseState) {
  const daysElapsed = (Date.now() - state.installedAt) / MS_PER_DAY
  const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - daysElapsed))
  const trialExpired = daysElapsed >= TRIAL_DAYS

  const hasLicense = !!state.licenseValid && !!state.licenseActivatedAt
  const licenseDaysElapsed = hasLicense ? (Date.now() - state.licenseActivatedAt!) / MS_PER_DAY : 0
  const licenseExpired = hasLicense && licenseDaysElapsed >= LICENSE_VALIDITY_DAYS
  const licenseDaysLeft = hasLicense ? Math.max(0, Math.ceil(LICENSE_VALIDITY_DAYS - licenseDaysElapsed)) : 0
  const licenseExpiresAt = hasLicense ? state.licenseActivatedAt! + LICENSE_VALIDITY_DAYS * MS_PER_DAY : null

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

// Verifies a license key against Gumroad's public License Verification API.
// https://app.gumroad.com/api#verifying-a-license
async function verifyGumroadLicense(licenseKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: GUMROAD_PRODUCT_PERMALINK,
        license_key: licenseKey,
      }),
    })
    const data: any = await response.json()
    if (data.success) {
      return { valid: true }
    }
    return { valid: false, error: data.message || 'Invalid license key' }
  } catch (error) {
    return { valid: false, error: String(error) }
  }
}

export { getLicenseStatus, verifyGumroadLicense, TRIAL_DAYS }
