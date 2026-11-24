import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Box Rewards</Link>
        <div className="grow" />
        {user && (
          <>
            <span className="muted hide-sm">{user.name}{user.role === 'admin' ? ' · owner' : ''}</span>
            <button className="btn ghost" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
          </>
        )}
      </header>
      <main className="container"><Outlet /></main>
    </>
  );
}
