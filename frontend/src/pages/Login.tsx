import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const location = useLocation()
  const successMessage = (location.state as any)?.message
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage)
    }
  }, [successMessage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      
      // Fetch projects and auto-open first one if exists
      const { listProjects } = await import('../api')
      const projects = await listProjects()
      
      if (projects && projects.length > 0) {
        // Open the first (newest) project
        navigate(`/studio/${projects[0].id}`)
      } else {
        // No projects, go to empty studio
        navigate('/studio')
      }
    } catch (err: any) {
      // Better error messages
      const message = err.message || 'Failed to sign in'
      if (message.includes('Email not confirmed')) {
        setError(
          'Please check your email and click the confirmation link to activate your account.'
        )
      } else if (message.includes('Invalid login credentials')) {
        setError('Invalid email or password')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="h-screen overflow-hidden relative" 
      style={{ 
        backgroundColor: '#0a0a0a',
        backgroundImage: `
          radial-gradient(circle at 20% 20%, rgba(0, 112, 243, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(80, 227, 194, 0.06) 0%, transparent 50%),
          linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.4) 100%)
        `
      }}
    >
      {/* Dot Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.15) 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }}
      />

      {/* Logo Top-Left */}
      <div className="absolute top-6 left-6 z-50">
        <Link 
          to="/"
          style={{
            fontFamily: 'Geist, Inter, Arial, sans-serif',
            fontSize: '20px',
            fontWeight: 600,
            color: '#ffffff',
            textDecoration: 'none'
          }}
        >
          RenovaAI
        </Link>
      </div>

      <div className="relative flex h-full items-center justify-center px-4 z-10">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 
              className="text-3xl font-semibold mb-2" 
              style={{ 
                fontFamily: 'Geist, Inter, Arial, sans-serif',
                color: '#ffffff',
                letterSpacing: '-1px',
                fontWeight: 600
              }}
            >
              Welcome back
            </h1>
            <p 
              className="text-sm" 
              style={{ 
                fontFamily: 'Geist, Inter, Arial, sans-serif', 
                color: '#8f8f8f',
                lineHeight: '20px'
              }}
            >
              Sign in to continue to RenovaAI
            </p>
          </div>

          {/* Form Card */}
          <div
            className="p-6"
            style={{
              borderRadius: '16px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a'
            }}
          >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div 
                className="rounded p-3 text-sm"
                style={{
                  backgroundColor: '#2a1010',
                  border: '1px solid #4a1010',
                  color: '#ff6b6b',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2"
                style={{ 
                  fontFamily: 'Geist, Inter, sans-serif',
                  color: '#ffffff',
                  fontWeight: 500,
                  lineHeight: '20px',
                  letterSpacing: '-0.28px'
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-sm outline-none transition"
                style={{
                  borderRadius: '10px',
                  backgroundColor: '#0a0a0a',
                  color: '#ffffff',
                  border: '1px solid #2a2a2a',
                  fontFamily: 'Geist, Inter, sans-serif',
                  lineHeight: '20px'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0070f3'
                  e.target.style.boxShadow = '0 0 0 1px #0070f3'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#2a2a2a'
                  e.target.style.boxShadow = 'none'
                }}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2"
                style={{ 
                  fontFamily: 'Geist, Inter, sans-serif',
                  color: '#ffffff',
                  fontWeight: 500,
                  lineHeight: '20px',
                  letterSpacing: '-0.28px'
                }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 pr-10 text-sm outline-none transition"
                  style={{
                    borderRadius: '10px',
                    backgroundColor: '#0a0a0a',
                    color: '#ffffff',
                    border: '1px solid #2a2a2a',
                    fontFamily: 'Geist, Inter, sans-serif',
                    lineHeight: '20px'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0070f3'
                    e.target.style.boxShadow = '0 0 0 1px #0070f3'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#2a2a2a'
                    e.target.style.boxShadow = 'none'
                  }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                  style={{ color: '#6a6a6a' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6a6a6a'}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderRadius: '10px',
                backgroundColor: loading ? '#3a3a3a' : '#ffffff',
                color: loading ? '#6a6a6a' : '#0a0a0a',
                fontFamily: 'Geist, Inter, sans-serif',
                fontWeight: 500,
                lineHeight: '20px'
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#e5e5e5')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p 
              className="text-center text-sm"
              style={{ 
                fontFamily: 'Geist, Inter, sans-serif',
                color: '#6a6a6a',
                lineHeight: '20px'
              }}
            >
              Don't have an account?{' '}
              <Link 
                to="/signup" 
                className="font-medium transition"
                style={{ color: '#0070f3' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#0761d1'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#0070f3'}
              >
                Sign up
              </Link>
            </p>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}
