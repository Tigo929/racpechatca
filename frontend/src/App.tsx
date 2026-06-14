import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ScrollToTop } from './components/ScrollToTop';
import { LandingPage } from './pages/LandingPage';
import { productSlugs } from './landing/data/productPages';

// CRM и продуктовые страницы грузим лениво — посетителю лендинга
// не нужно скачивать код админки и наоборот. Меньше начальный бандл = быстрее LCP.
const ProductLandingPage = lazy(() =>
  import('./landing/pages/ProductLandingPage').then((m) => ({ default: m.ProductLandingPage })),
);
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const SalaryPage = lazy(() => import('./pages/SalaryPage'));
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// loading уже обработан в AppRoutes — здесь user точно определён
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

/** Гейт проверки токена — только для CRM, лендинг рендерится сразу. */
function CrmGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div role="status" aria-label="Загрузка" className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
    </div>
  );
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
      <Route path="/" element={<LandingPage />} />

      {productSlugs.map((slug) => (
        <Route key={slug} path={`/${slug}`} element={<ProductLandingPage />} />
      ))}

      <Route path="/crm/login" element={<CrmGate>{user ? <Navigate to="/crm" replace /> : <LoginPage />}</CrmGate>} />
      <Route path="/crm" element={<CrmGate><PrivateRoute><OrdersPage /></PrivateRoute></CrmGate>} />
      <Route path="/crm/users" element={<CrmGate><AdminRoute><UsersPage /></AdminRoute></CrmGate>} />
      <Route path="/crm/salary" element={<CrmGate><AdminRoute><SalaryPage /></AdminRoute></CrmGate>} />
      <Route path="/crm/reports" element={<CrmGate><AdminRoute><ReportsPage /></AdminRoute></CrmGate>} />

      <Route path="*" element={<Navigate to="/" replace />} />
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
