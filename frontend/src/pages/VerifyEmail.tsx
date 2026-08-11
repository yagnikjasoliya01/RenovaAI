import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    // Check if user is verified
    const checkVerification = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          setVerificationStatus('error')
          setErrorMessage(error.message)
          return
        }

        if (session?.user?.email_confirmed_at) {
          setVerificationStatus('success')
        } else {
          // Check for hash params in URL (Supabase sends verification tokens)
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          
          if (accessToken) {
            setVerificationStatus('success')
          } else {
            setVerificationStatus('error')
            setErrorMessage('Verification link may have expired or is invalid.')
          }
        }
      } catch (err) {
        setVerificationStatus('error')
        setErrorMessage('An unexpected error occurred.')
      }
    }

    checkVerification()
  }, [])

  if (verificationStatus === 'loading') {
    return (
      <div 
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: '#0a0a0a' }}
      >
        <div className="text-center">
          <div 
            className="mb-4 h-12 w-12 animate-spin rounded-full border-4 mx-auto"
            style={{
              borderColor: '#2a2a2a',
              borderTopColor: '#ffffff'
            }}
          />
          <p style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}>
            Verifying your email...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      <div className="w-full max-w-md">
        <div 
          className="p-8 text-center"
          style={{
            borderRadius: '16px',
            border: '1px solid #1a1a1a',
            backgroundColor: '#0f0f0f'
          }}
        >
          {verificationStatus === 'success' ? (
            <>
              <div 
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
              >
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: '#10b981' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 
                className="mb-3 text-2xl font-semibold"
                style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                Email Verified Successfully!
              </h1>
              <p 
                className="mb-6"
                style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                Your email has been confirmed. You can now log in to your account.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  borderRadius: '10px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
              >
                Go to Login
              </button>
            </>
          ) : (
            <>
              <div 
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              >
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: '#ef4444' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 
                className="mb-3 text-2xl font-semibold"
                style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                Verification Failed
              </h1>
              <p 
                className="mb-6"
                style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                {errorMessage || 'We couldn\'t verify your email. The link may have expired.'}
              </p>
              <button
                onClick={() => navigate('/signup')}
                className="w-full px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  borderRadius: '10px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
              >
                Back to Signup
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
