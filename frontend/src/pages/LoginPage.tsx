import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/auth.service';

const testLogins = [
  { label: 'Super Admin', email: 'admin@newoon.com', note: 'Full platform setup' },
  { label: 'Company Admin', email: 'company.admin@newoon.com', note: 'Full tenant workflow testing' },
  { label: 'Operations', email: 'operations@newoon.com', note: 'Clients, KYC preparation, submit to AML' },
  { label: 'AML Supervisor', email: 'aml.supervisor@newoon.com', note: 'Supervisor review stage' },
  { label: 'DMLRO', email: 'dmlro@newoon.com', note: 'DMLRO review stage' },
  { label: 'MLRO', email: 'mlro@newoon.com', note: 'Final MLRO decision' },
  { label: 'SEF', email: 'sef@newoon.com', note: 'Management decision for high-risk files' }
];

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@newoon.com');
  const [password, setPassword] = useState('Admin@12345');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      localStorage.setItem('newoon_token', result.accessToken);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white p-8 text-slate-950 shadow-2xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Newoon</p>
          <h1 className="mt-2 text-2xl font-semibold">KYC & Engagement MIS</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to manage tenants, modules, users, and workflow foundations.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              type="email"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              type="password"
              required
            />
          </label>
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow test logins</p>
          <div className="mt-3 grid gap-2">
            {testLogins.map((item) => (
              <button
                key={item.email}
                type="button"
                onClick={() => {
                  setEmail(item.email);
                  setPassword('Admin@12345');
                }}
                className="rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                <span className="block text-xs text-slate-500">{item.email} | {item.note}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Default test password: Admin@12345</p>
        </div>
      </div>
    </section>
  );
}
