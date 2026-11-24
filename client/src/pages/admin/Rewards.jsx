import { useState } from 'react';
import { api } from '../../api';
import { useLoad } from '../../hooks';
import { Empty, ErrorNote, StatusBadge } from '../../components/ui.jsx';

export default function Rewards() {
  const { data, error, reload } = useLoad('/admin/rewards');
  const [form, setForm] = useState({ name: '', description: '', pointsCost: 100, stock: '' });
  const [formError, setFormError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    setFormError('');
    try {
      await api('/admin/rewards', { method: 'POST', body: { ...form, stock: form.stock === '' ? null : Number(form.stock) } });
      setForm({ name: '', description: '', pointsCost: 100, stock: '' });
      reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

  const patch = async (r, body) => {
    try { await api(`/admin/rewards/${r._id}`, { method: 'PATCH', body }); reload(); } catch (err) { window.alert(err.message); }
  };
  const editStock = (r) => {
    const v = window.prompt('New stock (blank = unlimited)', r.stock ?? '');
    if (v === null) return;
    patch(r, { stock: v.trim() === '' ? null : Number(v) });
  };

  return (
    <div className="stack-lg">
      <form className="card stack" onSubmit={create}>
        <h2>Add a reward</h2>
        <div className="grid form-grid">
          <label>Name<input value={form.name} onChange={set('name')} required maxLength={80} /></label>
          <label>Description<input value={form.description} onChange={set('description')} maxLength={300} /></label>
          <label>Points cost<input type="number" min="1" value={form.pointsCost} onChange={set('pointsCost')} required /></label>
          <label>Stock (blank = unlimited)<input type="number" min="0" value={form.stock} onChange={set('stock')} /></label>
        </div>
        <ErrorNote error={formError} />
        <div><button className="btn primary">Add reward</button></div>
      </form>

      <section className="card">
        <h2>Catalogue</h2>
        <ErrorNote error={error} />
        {data?.rewards.length === 0 && <Empty>No rewards yet.</Empty>}
        {data?.rewards.length > 0 && (
          <div className="scroll">
            <table>
              <thead><tr><th>Reward</th><th className="num">Cost</th><th className="num">Stock</th><th>Visible</th><th /></tr></thead>
              <tbody>
                {data.rewards.map((r) => (
                  <tr key={r._id}>
                    <td>{r.name}<div className="muted small">{r.description}</div></td>
                    <td className="num">{r.pointsCost}</td>
                    <td className="num">{r.stock ?? '∞'}</td>
                    <td><StatusBadge status={r.active ? 'active' : 'suspended'} /></td>
                    <td className="row">
                      <button className="btn sm" onClick={() => editStock(r)}>Stock</button>
                      <button className="btn sm" onClick={() => patch(r, { active: !r.active })}>{r.active ? 'Hide' : 'Show'}</button>
                    </td>
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
