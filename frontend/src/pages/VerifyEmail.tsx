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
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-blue-500 mx-auto" />
          <p className="text-zinc-400">Verifying your email...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          {verificationStatus === 'success' ? (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <svg
                  className="h-8 w-8 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="mb-3 text-2xl font-semibold text-zinc-100">
                Email Verified Successfully!
              </h1>
              <p className="mb-6 text-zinc-400">
                Your email has been confirmed. You can now log in to your account.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
              >
                Go to Login
              </button>
            </>
          ) : (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <svg
                  className="h-8 w-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="mb-3 text-2xl font-semibold text-zinc-100">
                Verification Failed
              </h1>
              <p className="mb-6 text-zinc-400">
                {errorMessage || 'We couldn\'t verify your email. The link may have expired.'}
              </p>
              <button
                onClick={() => navigate('/signup')}
                className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
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
