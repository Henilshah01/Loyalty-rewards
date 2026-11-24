import { api } from '../../api';
import { fmtDate, useLoad } from '../../hooks';
import { Empty, ErrorNote, StatusBadge } from '../../components/ui.jsx';

export default function Customers() {
  const { data, error, reload } = useLoad('/admin/users');

  async function setStatus(u, status) {
    const verb = status === 'suspended' ? 'Suspend' : 'Reinstate';
    if (!window.confirm(`${verb} ${u.email}?`)) return;
    try {
      await api(`/admin/users/${u._id}/status`, { method: 'PATCH', body: { status } });
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <section className="card">
      <h2>Customers</h2>
      <ErrorNote error={error} />
      {data?.users.length === 0 && <Empty>No customers yet.</Empty>}
      {data?.users.length > 0 && (
        <div className="scroll">
          <table>
            <thead><tr><th>Customer</th><th className="num">Balance</th><th className="num">Lifetime</th><th>Joined</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}<div className="muted small">{u.email}</div></td>
                  <td className="num">{u.points}</td>
                  <td className="num">{u.lifetimePoints}</td>
                  <td>{fmtDate(u.createdAt)}</td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>
                    {u.status === 'active'
                      ? <button className="btn danger sm" onClick={() => setStatus(u, 'suspended')}>Suspend</button>
                      : <button className="btn sm" onClick={() => setStatus(u, 'active')}>Reinstate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
