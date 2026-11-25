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

/** Brand mark: a box with yellow tape. */
export const Logo = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="7" width="20" height="15" fill="currentColor" />
    <rect x="9" y="7" width="6" height="15" fill="var(--signal)" />
    <rect x="2" y="2" width="20" height="5" fill="currentColor" opacity=".55" />
  </svg>
);
