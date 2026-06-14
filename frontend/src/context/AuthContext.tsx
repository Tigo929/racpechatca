import { useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { AuthUser } from '../types/index';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialToken] = useState(() => localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(initialToken !== null);

  useEffect(() => {
    if (!initialToken) return;
    authApi.me()
      .then(setUser)
      .catch(() => localStorage.removeItem('access_token'))
      .finally(() => setLoading(false));
  }, [initialToken]);

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    localStorage.setItem('access_token', res.access_token);
    // Получаем полный профиль (с id) одним запросом
    const me = await authApi.me();
    setUser(me);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
