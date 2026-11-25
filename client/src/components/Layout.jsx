import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Logo } from './ui.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The owner area has its own sidebar shell.
  if (pathname.startsWith('/admin')) return <Outlet />;

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand"><Logo />Loyalty Rewards</Link>
        <div className="grow" />
        {user && (
          <>
            <span className="muted hide-sm">{user.name}</span>
            <button className="btn sm" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
          </>
        )}
      </header>
      <main className="container"><Outlet /></main>
    </>
  );
}
