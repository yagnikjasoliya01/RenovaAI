import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Dashboard from './pages/Dashboard'
import Report from './pages/Report'
import ReportsList from './pages/ReportsList'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import VerifyEmail from './pages/VerifyEmail'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuth } from './context/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
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
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: '#0a0a0a',
        color: '#ffffff',
        fontFamily: 'Geist, Inter, sans-serif'
      }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f0f0f',
            color: '#ffffff',
            border: '1px solid #1a1a1a',
            borderRadius: '10px',
            fontFamily: 'Geist, Inter, sans-serif',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#0f0f0f',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#0f0f0f',
            },
          },
        }}
      />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route
            path="/studio"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/:projectId"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/:projectId"
            element={
              <ProtectedRoute>
                <ReportsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report/:projectId/:reportId"
            element={
              <ProtectedRoute>
                <Report />
              </ProtectedRoute>
            }
          />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}
