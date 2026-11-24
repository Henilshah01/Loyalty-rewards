import { useLoad } from '../../hooks';
import { Empty, ErrorNote, Stat } from '../../components/ui.jsx';

function lastDays(series, n = 14) {
  const map = new Map(series.map((d) => [d.date, d.count]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push({ date: d, count: map.get(d) || 0 });
  }
  return out;
}

export default function Overview() {
  const { data, error } = useLoad('/admin/stats');
  if (error) return <ErrorNote error={error} />;
  if (!data) return <p className="muted center">Loading…</p>;
  const days = lastDays(data.claimsPerDay);
  const max = Math.max(1, ...days.map((d) => d.count));
  const rate = data.codes.total ? Math.round((data.codes.claimed / data.codes.total) * 100) : 0;

  return (
    <div className="stack-lg">
      <div className="grid stats">
        <Stat label="Customers" value={data.customers} />
        <Stat label="Codes claimed" value={data.codes.claimed} hint={`${rate}% of ${data.codes.total} printed`} />
        <Stat label="Points issued" value={data.points.issued} />
        <Stat label="Points outstanding" value={data.points.outstanding} hint="Liability: unspent customer balances" />
        <Stat label="Pending redemptions" value={data.pendingRedemptions} />
        <Stat label="Failed attempts (24h)" value={data.failedAttempts24h} hint="See Security tab" />
      </div>

      <section className="card">
        <h2>Claims per day (last 14 days)</h2>
        <div className="bars" role="img" aria-label="Bar chart of claims per day">
          {days.map((d) => (
            <div key={d.date} className="bar-col" title={`${d.date}: ${d.count}`}>
              <div className="bar" style={{ height: `${(d.count / max) * 100}%` }} />
              <span className="small muted">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Top customers</h2>
        {data.topCustomers.length === 0 && <Empty>No customers yet.</Empty>}
        <table>
          <thead><tr><th>Name</th><th>Email</th><th className="num">Lifetime</th><th className="num">Balance</th></tr></thead>
          <tbody>
            {data.topCustomers.map((c) => (
              <tr key={c.email}><td>{c.name}</td><td>{c.email}</td><td className="num">{c.lifetimePoints}</td><td className="num">{c.points}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
