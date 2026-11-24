import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  ['/admin', 'Overview', true],
  ['/admin/batches', 'Batches & codes'],
  ['/admin/rewards', 'Rewards'],
  ['/admin/redemptions', 'Redemptions'],
  ['/admin/customers', 'Customers'],
  ['/admin/security', 'Security'],
];

export default function AdminLayout() {
  return (
    <>
      <nav className="tabs">
        {tabs.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
