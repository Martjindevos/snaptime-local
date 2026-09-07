import { useState } from 'react'

interface Props {
  daysLeft: number
  licenseValid?: boolean
  licenseKey?: string
  licenseExpiresAt?: number | null
  licenseExpired?: boolean
  onActivated: () => void
  onCancel?: () => void
}

export default function LicenseGate({ daysLeft, licenseValid, licenseKey, licenseExpiresAt, licenseExpired, onActivated, onCancel }: Props) {
  const [newLicenseKey, setNewLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')

  const trialExpired = daysLeft <= 0
  const needsPurchase = !licenseValid && (trialExpired || licenseExpired)

  const handleBuyLicense = () => {
    window.electron.ipcRenderer.invoke('open-license-purchase-page')
  }

  const handleActivate = async () => {
    if (!newLicenseKey.trim()) {
      setError('Please enter a license key')
      return
    }
    setActivating(true)
    setError('')
    try {
      const result = await window.electron.ipcRenderer.invoke('activate-license', newLicenseKey.trim())
      if (result.success) {
        onActivated()
      } else {
        setError(result.error || 'Activation failed')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ textAlign: 'center' }}>
        {licenseValid ? (
          <>
            <h2>License Active</h2>
            <p style={{ color: '#6b7280', marginBottom: '8px' }}>
              Key: <code>{licenseKey}</code>
            </p>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
              Valid until {licenseExpiresAt ? new Date(licenseExpiresAt).toLocaleDateString() : '-'}
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
              Enter a different key below to replace it.
            </p>
          </>
        ) : (
          <>
            <h2>{licenseExpired ? 'License Expired' : trialExpired ? 'Trial Expired' : `Trial: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</h2>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
              {licenseExpired
                ? 'Your license was valid for 1 year and has expired. Enter a new license key to continue.'
                : trialExpired
                ? 'Your 3-day trial has ended. Enter a license key to continue using SnapTime Local.'
                : 'Enter a license key any time to skip the trial countdown.'}
            </p>
          </>
        )}

        {needsPurchase && (
          <button
            onClick={handleBuyLicense}
            style={{
              width: '100%',
              marginBottom: '16px',
              background: '#10b981',
              color: 'white',
              padding: '10px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Buy a License →
          </button>
        )}

        <input
          type="text"
          placeholder="License key"
          value={newLicenseKey}
          onChange={(e) => setNewLicenseKey(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: '12px' }}
        />

        {error && <p className="error">{error}</p>}

        <button onClick={handleActivate} disabled={activating}>
          {activating ? 'Activating...' : 'Activate License'}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            style={{ marginTop: '12px', background: 'none', color: '#6b7280', border: 'none', cursor: 'pointer', fontSize: '12px' }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
