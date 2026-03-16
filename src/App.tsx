import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { NewApplication } from './pages/NewApplication';
import { ApplicationDetail } from './pages/ApplicationDetail';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <DialogProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="new" element={<NewApplication />} />
            <Route path="applications/:id" element={<ApplicationDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </DialogProvider>
    </AuthProvider>
  );
}
