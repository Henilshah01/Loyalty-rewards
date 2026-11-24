import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Login from './pages/Login.jsx';
import Customer from './pages/Customer.jsx';
import Overview from './pages/admin/Overview.jsx';
import Batches from './pages/admin/Batches.jsx';
import Rewards from './pages/admin/Rewards.jsx';
import Redemptions from './pages/admin/Redemptions.jsx';
import Customers from './pages/admin/Customers.jsx';
import Security from './pages/admin/Security.jsx';

function RequireAuth({ admin = false, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted center">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  return user.role === 'admin' ? <Navigate to="/admin" replace /> : <Customer />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        {/* QR codes on boxes can point here: /claim?code=XXXX-XXXX-XXXX-XXXX */}
        <Route path="/claim" element={<RequireAuth><Customer /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth admin><AdminLayout /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="batches" element={<Batches />} />
          <Route path="rewards" element={<Rewards />} />
          <Route path="redemptions" element={<Redemptions />} />
          <Route path="customers" element={<Customers />} />
          <Route path="security" element={<Security />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
