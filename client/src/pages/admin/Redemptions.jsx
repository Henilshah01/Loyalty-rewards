import { useState } from 'react';
import { api } from '../../api';
import { fmtDate, useLoad } from '../../hooks';
import { Empty, ErrorNote, StatusBadge } from '../../components/ui.jsx';

export default function Redemptions() {
  const [status, setStatus] = useState('pending');
  const { data, error, reload } = useLoad(`/admin/redemptions?status=${status}`);

  async function resolve(r, action) {
    const note = window.prompt(action === 'reject' ? 'Reason for rejecting (points are refunded):' : 'Note (optional):', '');
    if (note === null) return;
    try {
      await api(`/admin/redemptions/${r._id}/resolve`, { method: 'POST', body: { action, note } });
    } catch (err) {
      window.alert(err.message);
    }
    reload();
  }

  return (
    <section className="card">
      <div className="row between">
        <h2>Reward requests</h2>
        <div className="seg">
          {['pending', 'fulfilled', 'rejected'].map((s) => (
            <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
      </div>
      <ErrorNote error={error} />
      {data?.items.length === 0 && <Empty>Nothing {status}.</Empty>}
      {data?.items.length > 0 && (
        <div className="scroll">
          <table>
            <thead><tr><th>Customer</th><th>Reward</th><th className="num">Points</th><th>Delivery note</th><th>Requested</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r._id}>
                  <td>{r.user?.name}<div className="muted small">{r.user?.email}</div></td>
                  <td>{r.rewardName}</td>
                  <td className="num">{r.pointsCost}</td>
                  <td>{r.deliveryNote || '-'}</td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td><StatusBadge status={r.status} />{r.adminNote && <div className="muted small">{r.adminNote}</div>}</td>
                  <td className="row">
                    {r.status === 'pending' && (
                      <>
                        <button className="btn primary sm" onClick={() => resolve(r, 'fulfil')}>Fulfil</button>
                        <button className="btn danger sm" onClick={() => resolve(r, 'reject')}>Reject</button>
                      </>
                    )}
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
