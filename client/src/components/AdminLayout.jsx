import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Logo } from './ui.jsx';

const tabs = [
  ['/admin', 'Overview', true],
  ['/admin/batches', 'Batches & codes'],
  ['/admin/rewards', 'Rewards'],
  ['/admin/redemptions', 'Reward requests'],
  ['/admin/customers', 'Customers'],
  ['/admin/security', 'Security'],
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Most specific match wins (later tabs first), so "/admin" only matches Overview.
  const current = [...tabs].reverse().find(([to]) => pathname.startsWith(to));

  return (
    <div className="admin-shell">
      <aside className="side">
        <Link to="/admin" className="brand"><Logo />Loyalty Rewards</Link>
        <nav aria-label="Owner menu">
          {tabs.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div>{user.name}<div className="small">Factory owner</div></div>
          <button className="btn sm" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
        </div>
      </aside>
      <main className="admin-main">
        <h1 className="page-title">{current?.[1]}</h1>
        <Outlet />
      </main>
    </div>
  );
}
