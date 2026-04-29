import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRegister } from '@/lib/auth'
import { useAuth } from '@/lib/AuthContext'

export default function SignupPage() {
  const nav = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError(null)
    setLoading(true)
    try {
      const token = await apiRegister(email, username, password)
      await login(token)
      nav('/battle')
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-zinc-950 flex items-center justify-center px-4 py-16">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 40% 40% at 50% 40%, rgba(232,108,58,0.08) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-1">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white text-xs font-black">
              AF
            </div>
          </Link>
          <h1 className="text-3xl font-black text-white tracking-tight">Join the Fight.</h1>
          <p className="text-zinc-400 text-sm">Create your account to save battle history.</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">

          {error && (
            <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email</label>
            <input
              type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5
                         text-sm text-white placeholder:text-zinc-600
                         focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20
                         transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Username</label>
            <input
              type="text" required autoComplete="username"
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="fighter123"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5
                         text-sm text-white placeholder:text-zinc-600
                         focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20
                         transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
            <input
              type="password" required autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5
                         text-sm text-white placeholder:text-zinc-600
                         focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20
                         transition-all"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-accent hover:bg-[#D45E2E] disabled:opacity-50 text-white
                       font-bold py-3 rounded-xl transition-colors text-sm
                       shadow-lg shadow-accent/25 mt-2"
          >
            {loading ? 'Creating account…' : 'Create account →'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:text-white font-semibold transition-colors">
            Sign in →
          </Link>
        </p>

        <p className="text-center text-xs text-zinc-700">
          <Link to="/battle" className="hover:text-zinc-500 transition-colors">
            Continue without account
          </Link>
        </p>
      </div>
    </div>
  )
}
