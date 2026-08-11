import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  // Auto-redirect to studio if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/studio')
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="text-center">
          <div 
            className="mb-4 h-12 w-12 animate-spin rounded-full border-4 mx-auto" 
            style={{ 
              borderColor: '#2a2a2a',
              borderTopColor: '#ffffff'
            }}
          />
          <p style={{ fontFamily: 'Geist, Inter, sans-serif', color: '#8f8f8f' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden relative" 
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
      
      {/* Header */}
      <header 
        className="relative z-40 w-full"
        style={{ 
          borderBottom: '1px solid #1a1a1a'
        }}
      >
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <h1 
            className="text-xl font-semibold"
            style={{
              fontFamily: 'Geist, Inter, Arial, sans-serif',
              color: '#ffffff',
              fontWeight: 600,
              letterSpacing: '-0.4px'
            }}
          >
            RenovaAI
          </h1>
          <div className="flex items-center gap-3 relative z-50">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium transition cursor-pointer"
              style={{
                borderRadius: '12px',
                backgroundColor: '#1a1a1a',
                color: '#ffffff',
                border: '1px solid #2a2a2a',
                fontFamily: 'Geist, Inter, sans-serif',
                fontWeight: 500,
                lineHeight: '20px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 text-sm font-medium transition cursor-pointer"
              style={{
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                color: '#0a0a0a',
                fontFamily: 'Geist, Inter, sans-serif',
                fontWeight: 500,
                lineHeight: '20px',
                height: '40px',
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e5e5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex items-center justify-center overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 w-full">
          {/* Hero Content */}
          <div className="mx-auto max-w-3xl text-center mb-12">
            {/* Main Headline */}
            <h2 
              className="mb-4"
              style={{
                fontFamily: 'Geist, Inter, Arial, sans-serif',
                fontSize: '42px',
                fontWeight: 600,
                lineHeight: '1.1',
                letterSpacing: '-2px',
                color: '#ffffff'
              }}
            >
              AI-Powered Exterior Renovation Planning
            </h2>

            {/* Subheadline */}
            <p 
              className="mb-8"
              style={{
                fontFamily: 'Geist, Inter, sans-serif',
                fontSize: '16px',
                fontWeight: 400,
                lineHeight: '24px',
                color: '#a1a1a1',
                maxWidth: '580px',
                margin: '0 auto 2rem'
              }}
            >
              Upload your house photo, select materials, see realistic designs, and get instant cost estimates—all before construction begins.
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center gap-4 mb-12 relative z-50">
              <Link
                to="/signup"
                className="px-6 py-3 text-base font-medium transition cursor-pointer"
                style={{
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  color: '#0a0a0a',
                  fontFamily: 'Geist, Inter, sans-serif',
                  fontWeight: 500,
                  lineHeight: '20px',
                  height: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e5e5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 text-base font-medium transition cursor-pointer"
                style={{
                  borderRadius: '12px',
                  backgroundColor: '#1a1a1a',
                  color: '#ffffff',
                  border: '1px solid #2a2a2a',
                  textDecoration: 'none',
                  fontFamily: 'Geist, Inter, sans-serif',
                  fontWeight: 500,
                  lineHeight: '20px',
                  height: '44px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mx-auto max-w-5xl grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Feature 1 */}
            <div 
              className="p-5"
              style={{
                borderRadius: '16px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a'
              }}
            >
              <div 
                className="mb-3 text-2xl"
                style={{ color: '#ffffff' }}
              >
                📸
              </div>
              <h3 
                className="mb-2"
                style={{
                  fontFamily: 'Geist, Inter, sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: '22px',
                  letterSpacing: '-0.3px',
                  color: '#ffffff'
                }}
              >
                Upload & Visualize
              </h3>
              <p 
                style={{
                  fontFamily: 'Geist, Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 400,
                  lineHeight: '18px',
                  color: '#8f8f8f'
                }}
              >
                Upload your house photo and see AI-powered redesigns
              </p>
            </div>

            {/* Feature 2 */}
            <div 
              className="p-5"
              style={{
                borderRadius: '16px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a'
              }}
            >
              <div 
                className="mb-3 text-2xl"
                style={{ color: '#ffffff' }}
              >
                🎨
              </div>
              <h3 
                className="mb-2"
                style={{
                  fontFamily: 'Geist, Inter, sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: '22px',
                  letterSpacing: '-0.3px',
                  color: '#ffffff'
                }}
              >
                Select Materials
              </h3>
              <p 
                style={{
                  fontFamily: 'Geist, Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 400,
                  lineHeight: '18px',
                  color: '#8f8f8f'
                }}
              >
                Choose paint, tiles, cladding & more materials
              </p>
            </div>

            {/* Feature 3 */}
            <div 
              className="p-5"
              style={{
                borderRadius: '16px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a'
              }}
            >
              <div 
                className="mb-3 text-2xl"
                style={{ color: '#ffffff' }}
              >
                💰
              </div>
              <h3 
                className="mb-2"
                style={{
                  fontFamily: 'Geist, Inter, sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: '22px',
                  letterSpacing: '-0.3px',
                  color: '#ffffff'
                }}
              >
                Estimate Costs
              </h3>
              <p 
                style={{
                  fontFamily: 'Geist, Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 400,
                  lineHeight: '18px',
                  color: '#8f8f8f'
                }}
              >
                Get detailed quantities and cost breakdown
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
