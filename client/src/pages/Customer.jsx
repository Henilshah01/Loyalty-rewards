import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { fmtDate, useLoad } from '../hooks';
import { Empty, ErrorNote, StatusBadge } from '../components/ui.jsx';

export default function Customer() {
  const { user, refresh } = useAuth();
  const [params] = useSearchParams();
  const ledger = useLoad('/me/ledger');
  const requests = useLoad('/me/redemptions');
  const rewards = useLoad('/rewards');

  const [code, setCode] = useState(params.get('code') || '');
  const [claimMsg, setClaimMsg] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [note, setNote] = useState('');
  const [redeemMsg, setRedeemMsg] = useState(null);

  async function claim(e) {
    e.preventDefault();
    setClaiming(true);
    setClaimMsg(null);
    try {
      const r = await api('/claims', { method: 'POST', body: { code } });
      setClaimMsg({ ok: true, text: `+${r.points} points added. Balance: ${r.balance}` });
      setCode('');
      refresh();
      ledger.reload();
    } catch (err) {
      setClaimMsg({ ok: false, text: err.message });
    } finally {
      setClaiming(false);
    }
  }

  async function redeem(reward) {
    if (!window.confirm(`Redeem "${reward.name}" for ${reward.pointsCost} points?`)) return;
    setRedeemMsg(null);
    try {
      await api(`/rewards/${reward._id}/redeem`, { method: 'POST', body: { deliveryNote: note } });
      setRedeemMsg({ ok: true, text: `Requested "${reward.name}". We'll be in touch.` });
      refresh();
      ledger.reload();
      requests.reload();
      rewards.reload();
    } catch (err) {
      setRedeemMsg({ ok: false, text: err.message });
    }
  }

  return (
    <div className="stack-lg">
      <section className="card hero">
        <div>
          <div className="muted">Your points</div>
          <div className="points">{user.points}</div>
        </div>
      </section>

      <section className="card">
        <h2>Add points from a box</h2>
        <form className="row" onSubmit={claim}>
          <input
            className="mono grow" placeholder="XXXX-XXXX-XXXX-XXXX" value={code} maxLength={40}
            onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false}
            aria-label="Box code"
          />
          <button className="btn primary" disabled={claiming || !code.trim()}>{claiming ? 'Checking…' : 'Claim'}</button>
        </form>
        {claimMsg && <p className={`note ${claimMsg.ok ? 'good' : 'bad'}`} role="status">{claimMsg.text}</p>}
        <p className="muted small">Each code works once. Found it under the flap of your box.</p>
      </section>

      <section>
        <h2>Rewards</h2>
        <label className="small muted">Delivery / contact details for your reward (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Phone or address" />
        </label>
        {redeemMsg && <p className={`note ${redeemMsg.ok ? 'good' : 'bad'}`}>{redeemMsg.text}</p>}
        <ErrorNote error={rewards.error} />
        <div className="grid">
          {rewards.data?.rewards.map((r) => {
            const soldOut = r.stock === 0;
            const short = user.points < r.pointsCost;
            return (
              <div className="card" key={r._id}>
                <h3>{r.name}</h3>
                <p className="muted small">{r.description}</p>
                <div className="row between">
                  <strong>{r.pointsCost} pts</strong>
                  <button className="btn" disabled={soldOut || short} onClick={() => redeem(r)}>
                    {soldOut ? 'Sold out' : short ? `Need ${r.pointsCost - user.points} more` : 'Redeem'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {rewards.data && rewards.data.rewards.length === 0 && <Empty>No rewards available yet.</Empty>}
      </section>

      <section className="cols">
        <div className="card">
          <h2>Points activity</h2>
          {ledger.data?.entries.length === 0 && <Empty>No activity yet.</Empty>}
          <ul className="list">
            {ledger.data?.entries.map((e, i) => (
              <li key={i}>
                <span><StatusBadge status={e.type} /> {e.note}</span>
                <span className={e.points > 0 ? 'good-text' : ''}>{e.points > 0 ? '+' : ''}{e.points}<br /><span className="muted small">{fmtDate(e.createdAt)}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>My reward requests</h2>
          {requests.data?.items.length === 0 && <Empty>No requests yet.</Empty>}
          <ul className="list">
            {requests.data?.items.map((r) => (
              <li key={r._id}>
                <span>{r.rewardName}<br /><span className="muted small">{fmtDate(r.createdAt)}</span></span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
