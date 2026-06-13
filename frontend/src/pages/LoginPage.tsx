import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Printer } from 'lucide-react';
import { useAuth } from '../context/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate('/crm', { replace: true });
    } catch {
      toast.error('Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #3730A3 100%)' }}>
      {/* Декоративные круги на фоне */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #818CF8, transparent)' }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #F59E0B, transparent)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Логотип */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-2xl" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 8px 32px rgba(217,119,6,0.4)' }}>
            <Printer size={30} className="text-white" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight text-balance">
            Распечатка <span style={{ color: '#FCD34D' }}>PRO</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: '#A5B4FC' }}>Система управления заявками</p>
        </div>

        {/* Карточка */}
        <div className="rounded-3xl p-8" style={{ background: 'rgba(255,255,255,0.98)', boxShadow: '0 24px 64px rgba(30,27,75,0.4), 0 0 0 1px rgba(255,255,255,0.1)' }}>
          <h2 className="text-base font-bold text-gray-900 mb-6">Войдите в систему</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Логин</label>
              <input
                id="login-username"
                name="username"
                autoComplete="username"
                spellCheck={false}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-transparent focus-visible:bg-white transition-all"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Пароль</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-transparent focus-visible:bg-white transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-60 mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              style={{ background: loading ? '#6366F1' : 'linear-gradient(135deg, #4F46E5, #6366F1)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}
            >
              {loading ? 'Входим…' : 'Войти'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#6366F1' }}>
          © 2026 Распечатка PRO
        </p>
      </div>
    </div>
  );
}
