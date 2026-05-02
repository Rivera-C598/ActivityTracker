/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { hasSupabaseConfig } from './lib/supabase';
import { SetupRequired } from './components/SetupRequired';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { StudentView } from './pages/StudentView';

const PrivateRoute = () => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <Outlet />;
};

function AppRoutes() {
  if (!hasSupabaseConfig) {
    return <SetupRequired />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/view" replace />} />
      <Route path="/view" element={<StudentView />} />
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/view" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
