import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

const PUBLIC_LINKS = [
  { to: '/',       label: 'Overview' },
  { to: '/battle', label: 'Battle' },
]

const AUTH_LINKS = [
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/history',     label: 'History' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  const visibleLinks = user ? [...PUBLIC_LINKS, ...AUTH_LINKS] : PUBLIC_LINKS

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-text text-white text-[10px] font-bold">
            AF
          </div>
          <span className="text-sm font-semibold text-text">AgentFaceOff</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {visibleLinks.map(({ to, label }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-100
                  ${active
                    ? 'bg-zinc-100 text-text font-medium'
                    : 'text-muted hover:text-text hover:bg-zinc-50'
                  }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Auth */}
        <div className="flex items-center">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-accent text-white text-[10px] font-black flex items-center justify-center">
                {user.username[0].toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-text">{user.username}</span>
              <button onClick={logout} className="text-xs text-muted hover:text-text transition-colors ml-1">
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-accent btn-sm">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  )
}
