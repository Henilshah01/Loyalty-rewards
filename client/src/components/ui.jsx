export const Stat = ({ label, value, hint }) => (
  <div className="card stat">
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
    {hint && <div className="muted small">{hint}</div>}
  </div>
);

export const Badge = ({ tone = 'neutral', children }) => <span className={`badge ${tone}`}>{children}</span>;

const tones = {
  pending: 'warn', fulfilled: 'good', rejected: 'bad', active: 'good', voided: 'bad', suspended: 'bad',
  earn: 'good', refund: 'good', redeem: 'neutral',
};
export const StatusBadge = ({ status }) => <Badge tone={tones[status] || 'neutral'}>{status}</Badge>;

export const ErrorNote = ({ error }) => (error ? <p className="note bad" role="alert">{error}</p> : null);
export const Empty = ({ children }) => <p className="muted center pad">{children}</p>;
