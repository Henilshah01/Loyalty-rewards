import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ErrorNote } from '../components/ui.jsx';

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Keep ?code= from a scanned QR through the sign-in step.
  const from = location.state?.from ? location.state.from.pathname + location.state.from.search : '/';
  if (user) return <Navigate to={from} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container narrow">
      <h1 className="brand big">Box Rewards</h1>
      <p className="muted">Scan the code inside your box, collect points, claim rewards.</p>
      <form className="card stack" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
        {mode === 'register' && (
          <label>Name<input value={form.name} onChange={set('name')} required maxLength={80} autoComplete="name" /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
        <label>Password
          <input type="password" value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        <ErrorNote error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="btn link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}
