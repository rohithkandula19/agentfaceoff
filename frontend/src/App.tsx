import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import type { ReactNode } from 'react'
import Navbar from '@/components/layout/Navbar'
import Landing from '@/pages/Landing'
import BattlePage from '@/pages/BattlePage'
import HistoryPage from '@/pages/HistoryPage'
import LeaderboardPage from '@/pages/LeaderboardPage'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null          // wait for token restore before redirecting
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-white">
          <Navbar />
          <Routes>
            <Route path="/"            element={<Landing />} />
            <Route path="/battle"      element={<BattlePage />} />
            <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/history"     element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/login"       element={<LoginPage />} />
            <Route path="/signup"      element={<SignupPage />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
