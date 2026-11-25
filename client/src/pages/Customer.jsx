import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { fmtDate, useLoad } from '../hooks';
import { Empty, ErrorNote, StatusBadge } from '../components/ui.jsx';

const SEGMENTS = 10;

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

  // Nearest reward the customer can't afford yet drives the progress boxes.
  const list = rewards.data?.rewards ?? [];
  const next = list.filter((r) => r.stock !== 0 && r.pointsCost > user.points).sort((a, b) => a.pointsCost - b.pointsCost)[0];
  const filled = next ? Math.min(SEGMENTS, Math.floor((user.points / next.pointsCost) * SEGMENTS)) : SEGMENTS;
  const nextText = next
    ? `${next.pointsCost - user.points} more points for ${next.name}`
    : list.length ? 'You can redeem any reward below.' : 'Rewards will appear here soon.';

  async function claim(e) {
    e.preventDefault();
    setClaiming(true);
    setClaimMsg(null);
    try {
      const r = await api('/claims', { method: 'POST', body: { code } });
      setClaimMsg({ ok: true, text: `Added ${r.points} points. Your balance is ${r.balance}.` });
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
      <div className="top-grid">
        <section className="tag" aria-label="Your points">
          <span className="tag-hole" aria-hidden="true" />
          <div className="tag-name">{user.name}</div>
          {/* key restarts the stamp animation whenever the balance changes */}
          <div className="tag-points" key={user.points}>{user.points}<span>points</span></div>
          <div className="boxes" aria-hidden="true">
            {Array.from({ length: SEGMENTS }, (_, i) => <i key={i} className={i < filled ? 'on' : ''} />)}
          </div>
          <p className="tag-next">{nextText}</p>
        </section>

        <section className="card">
          <h2>Enter a box code</h2>
          <form className="stack" onSubmit={claim}>
            <input
              className="claim-input" placeholder="XXXX-XXXX-XXXX-XXXX" value={code} maxLength={40}
              onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} aria-label="Box code"
            />
            <div className="row">
              <button className="btn primary" disabled={claiming || !code.trim()}>{claiming ? 'Checking…' : 'Add points'}</button>
              <span className="muted small">Each code works once. You'll find it inside the box.</span>
            </div>
          </form>
          {claimMsg && <p className={`note ${claimMsg.ok ? 'good' : 'bad'}`} role="status">{claimMsg.text}</p>}
        </section>
      </div>

      <section className="card">
        <div className="section-title"><h2>Rewards</h2></div>
        <label className="small muted">Phone or address for delivery (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </label>
        {redeemMsg && <p className={`note ${redeemMsg.ok ? 'good' : 'bad'}`} role="status">{redeemMsg.text}</p>}
        <ErrorNote error={rewards.error} />
        <ul className="rows">
          {list.map((r) => {
            const soldOut = r.stock === 0;
            const short = user.points < r.pointsCost;
            return (
              <li key={r._id}>
                <div><strong>{r.name}</strong><div className="muted small">{r.description}</div></div>
                <span className="cost">{r.pointsCost} pts</span>
                <button className="btn" disabled={soldOut || short} onClick={() => redeem(r)}>
                  {soldOut ? 'Sold out' : short ? `${r.pointsCost - user.points} to go` : 'Redeem'}
                </button>
              </li>
            );
          })}
        </ul>
        {rewards.data && list.length === 0 && <Empty>No rewards yet. Check back soon.</Empty>}
      </section>

      <section className="cols">
        <div className="card">
          <h2>Points history</h2>
          {ledger.data?.entries.length === 0 && <Empty>No points yet. Enter your first box code above.</Empty>}
          <ul className="list">
            {ledger.data?.entries.map((e, i) => (
              <li key={i}>
                <span><StatusBadge status={e.type} /> {e.note}<br /><span className="muted small">{fmtDate(e.createdAt)}</span></span>
                <span className={e.points > 0 ? 'good-text' : ''}>{e.points > 0 ? '+' : ''}{e.points}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Your reward requests</h2>
          {requests.data?.items.length === 0 && <Empty>No requests yet. Redeem a reward when you have enough points.</Empty>}
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
