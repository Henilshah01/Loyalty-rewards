import { useState } from 'react';
import { api } from '../../api';
import { fmtDate, useLoad } from '../../hooks';
import { Empty, ErrorNote, StatusBadge } from '../../components/ui.jsx';
import QrSheet from '../../components/QrSheet.jsx';

function downloadCsv(name, codes, base) {
  const rows = ['serial,code,claim_url', ...codes.map((c, i) => `${i + 1},${c},${base}/claim?code=${c}`)];
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name.replace(/\W+/g, '_')}_codes.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

export default function Batches() {
  const { data, error, reload } = useLoad('/admin/batches');
  const [form, setForm] = useState({ name: '', productName: '', quantity: 100, pointsPerCode: 10, expiresAt: '' });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null); // { batch, codes } - plaintext codes, shown once
  // Where the QR codes point. Use your computer's network address to test with a phone.
  const [base, setBase] = useState(window.location.origin);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const body = { ...form, expiresAt: form.expiresAt ? new Date(form.expiresAt + 'T23:59:59').toISOString() : null };
      setFresh(await api('/admin/batches', { method: 'POST', body }));
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function voidBatch(b) {
    if (!window.confirm(`Void "${b.name}"? All ${b.active} unclaimed codes stop working. Claimed codes are unaffected.`)) return;
    try {
      await api(`/admin/batches/${b._id}/void`, { method: 'POST' });
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <div className="stack-lg">
      <form className="card stack" onSubmit={create}>
        <h2>Generate codes</h2>
        <div className="grid form-grid">
          <label>Batch name<input value={form.name} onChange={set('name')} required placeholder="Nov 2026, line A" /></label>
          <label>Product<input value={form.productName} onChange={set('productName')} required placeholder="Large storage box" /></label>
          <label>How many codes<input type="number" min="1" max="10000" value={form.quantity} onChange={set('quantity')} required /></label>
          <label>Points per code<input type="number" min="1" value={form.pointsPerCode} onChange={set('pointsPerCode')} required /></label>
          <label>Expiry date (optional)<input type="date" value={form.expiresAt} onChange={set('expiresAt')} /></label>
        </div>
        <ErrorNote error={formError} />
        <div><button className="btn primary" disabled={busy}>{busy ? 'Generating…' : 'Generate codes'}</button></div>
      </form>

      {fresh && (
        <section className="card callout stack">
          <div>
            <h2>{fresh.codes.length} codes ready for “{fresh.batch.name}”</h2>
            <p>Print the QR labels or download the CSV now. Only a hash is stored, so <strong>these codes cannot be shown again</strong>.</p>
          </div>
          <label>QR codes open this address
            <input value={base} onChange={(e) => setBase(e.target.value.replace(/\/+$/, ''))} className="mono" />
            <span className="muted small">To test with a phone, use your computer's network address, for example http://192.168.1.5:5173</span>
          </label>
          <QrSheet codes={fresh.codes} base={base} product={fresh.batch.productName} points={fresh.batch.pointsPerCode} />
          <div className="row">
            <button className="btn" onClick={() => downloadCsv(fresh.batch.name, fresh.codes, base)}>Download CSV</button>
            <button className="btn ghost" onClick={() => setFresh(null)}>I've saved them, close</button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>All batches</h2>
        <ErrorNote error={error} />
        {data?.batches.length === 0 && <Empty>No batches yet. Generate your first one above.</Empty>}
        {data?.batches.length > 0 && (
          <div className="scroll">
            <table>
              <thead><tr><th>Batch</th><th>Product</th><th className="num">Points</th><th className="num">Claimed</th><th className="num">Unclaimed</th><th>Expires</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.batches.map((b) => (
                  <tr key={b._id}>
                    <td>{b.name}<div className="muted small">{fmtDate(b.createdAt)}</div></td>
                    <td>{b.productName}</td>
                    <td className="num">{b.pointsPerCode}</td>
                    <td className="num">{b.claimed} / {b.quantity}</td>
                    <td className="num">{b.active}</td>
                    <td>{b.expiresAt ? fmtDate(b.expiresAt) : 'Never'}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td>{b.status === 'active' && <button className="btn danger sm" onClick={() => voidBatch(b)}>Void</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
