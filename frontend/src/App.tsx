import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Dashboard from './pages/Dashboard'
import Report from './pages/Report'
import ReportsList from './pages/ReportsList'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuth } from './context/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-blue-500 mx-auto" />
          <p className="text-zinc-400">Loading...</p>
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#18181b',
            color: '#fafafa',
            border: '1px solid #27272a',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#18181b',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#18181b',
            },
          },
        }}
      />
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Navigate to="/studio" replace />} />
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
