import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
      navigate('/', { replace: true });
    } catch {
      toast.error('Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Логотип */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-900/30 mb-4">
            <Printer size={30} className="text-indigo-950" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight text-balance">Распечатка <span className="text-amber-400">PRO</span></h1>
          <p className="text-indigo-300 text-sm mt-1">Система управления заявками</p>
        </div>

        {/* Карточка */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-indigo-950/50 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Вход в систему</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
              <input
                id="login-username"
                name="username"
                autoComplete="username"
                spellCheck={false}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-transparent transition-shadow"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-transparent transition-shadow"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm shadow-amber-200 mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              {loading ? 'Вход…' : 'Войти'}
            </button>
          </form>
        </div>

        <p className="text-center text-indigo-400 text-xs mt-6">
          © 2026 Распечатка PRO
        </p>
      </div>
    </div>
  );
}
