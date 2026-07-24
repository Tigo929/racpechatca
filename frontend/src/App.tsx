import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ScrollToTop } from './components/ScrollToTop';

// CRM-страницы грузим лениво — каждая попадает в свой чанк, начальный бандл меньше.
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const SalaryPage = lazy(() => import('./pages/SalaryPage'));
const MySalaryPage = lazy(() => import('./pages/MySalaryPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// loading уже обработан в CrmGate — здесь user точно определён
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/crm/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/crm/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/crm" replace />;
  return <>{children}</>;
}

/** Гейт проверки токена — ждём, пока AuthProvider определит пользователя. */
function CrmGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  if (loading) return <RouteFallback />;
  return <>{children}</>;
}

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div role="status" aria-label="Загрузка" className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/crm/login" element={<CrmGate>{user ? <Navigate to="/crm" replace /> : <LoginPage />}</CrmGate>} />
        {/* Каждый продукт — свой раздел со своим процессом. key заставляет
            страницу пересоздаться при переходе, чтобы фильтры не перетекали
            из одного раздела в другой. */}
        <Route path="/crm/photo" element={<CrmGate><PrivateRoute><OrdersPage key="photo" section="PHOTO" /></PrivateRoute></CrmGate>} />
        <Route path="/crm/tshirt" element={<CrmGate><AdminRoute><OrdersPage key="tshirt" section="TSHIRT" /></AdminRoute></CrmGate>} />
        <Route path="/crm/leads" element={<CrmGate><AdminRoute><OrdersPage key="leads" section="LEADS" /></AdminRoute></CrmGate>} />
        {/* Задачи видят все: администратор ставит, исполнитель ведёт свои */}
        <Route path="/crm/tasks" element={<CrmGate><PrivateRoute><TasksPage /></PrivateRoute></CrmGate>} />
        <Route path="/crm" element={<Navigate to="/crm/photo" replace />} />
        <Route path="/crm/users" element={<CrmGate><AdminRoute><UsersPage /></AdminRoute></CrmGate>} />
        <Route path="/crm/salary" element={<CrmGate><AdminRoute><SalaryPage /></AdminRoute></CrmGate>} />
        {/* Личный кабинет по деньгам — доступен любому вошедшему, сервер
            отдаёт баланс только по id из токена */}
        <Route path="/crm/my-salary" element={<CrmGate><PrivateRoute><MySalaryPage /></PrivateRoute></CrmGate>} />
        <Route path="/crm/reports" element={<CrmGate><AdminRoute><ReportsPage /></AdminRoute></CrmGate>} />
        <Route path="/crm/settings" element={<CrmGate><AdminRoute><SettingsPage /></AdminRoute></CrmGate>} />

        {/* Корень и любой неизвестный путь ведут в CRM */}
        <Route path="*" element={<Navigate to="/crm" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <AppRoutes />
          <Toaster position="bottom-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
