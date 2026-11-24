import { fmtDate, useLoad } from '../../hooks';
import { Empty, ErrorNote } from '../../components/ui.jsx';

export default function Security() {
  const { data, error } = useLoad('/admin/security');
  if (error) return <ErrorNote error={error} />;
  if (!data) return <p className="muted center">Loading…</p>;

  return (
    <div className="stack-lg">
      <p className="muted">Last 24 hours. Suspend a customer from the Customers tab; void a leaked batch from Batches &amp; codes.</p>

      <section className="card">
        <h2>Customers with repeated failed attempts</h2>
        {data.repeatFailures.length === 0 ? <Empty>None - all quiet.</Empty> : (
          <table>
            <thead><tr><th>Customer</th><th className="num">Failures</th><th>Last</th><th>Status</th></tr></thead>
            <tbody>
              {data.repeatFailures.map((r) => (
                <tr key={r._id}><td>{r.name}<div className="muted small">{r.email}</div></td><td className="num">{r.failures}</td><td>{fmtDate(r.lastAt)}</td><td>{r.status}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Shared IP addresses (3+ accounts)</h2>
        {data.sharedIps.length === 0 ? <Empty>None.</Empty> : (
          <table>
            <thead><tr><th>IP</th><th className="num">Accounts</th><th className="num">Attempts</th></tr></thead>
            <tbody>{data.sharedIps.map((r) => <tr key={r._id}><td className="mono">{r._id}</td><td className="num">{r.userCount}</td><td className="num">{r.attempts}</td></tr>)}</tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Recent failed attempts</h2>
        {data.recentFailures.length === 0 ? <Empty>None.</Empty> : (
          <div className="scroll">
            <table>
              <thead><tr><th>When</th><th>Customer</th><th>Outcome</th><th>IP</th></tr></thead>
              <tbody>
                {data.recentFailures.map((r) => (
                  <tr key={r._id}><td>{fmtDate(r.createdAt)}</td><td>{r.user?.email || '-'}</td><td>{r.outcome.replace('_', ' ')}</td><td className="mono">{r.ip}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
