import { FormEvent, useState } from 'react';
import { ArrowRight, BadgeCheck, Building2, Eye, KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react';
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
    <section className="flex min-h-screen items-center justify-center px-5 py-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] lg:grid-cols-[1.03fr_1fr]">
        <aside className="relative hidden min-h-[680px] overflow-hidden bg-brand-950 p-12 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,160,164,0.62),transparent_27%),radial-gradient(circle_at_84%_4%,rgba(184,31,35,0.82),transparent_30%),radial-gradient(circle_at_58%_78%,rgba(239,62,69,0.58),transparent_34%),linear-gradient(135deg,#450b0d_0%,#981f23_48%,#b81f23_100%)]" />
          <div className="absolute -left-28 top-6 h-96 w-96 rounded-full border border-white/15 bg-white/10 blur-sm" />
          <div className="absolute right-[-7rem] top-[-4rem] h-80 w-80 rounded-full border border-white/15 bg-black/10" />
          <div className="absolute bottom-[-11rem] left-32 h-[28rem] w-[28rem] rounded-full border border-white/10 bg-white/10 blur-[2px]" />

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 ring-1 ring-white/15">
                <Sparkles className="h-4 w-4" />
                Newoon MIS
              </div>
              <h2 className="mt-10 max-w-md text-5xl font-semibold leading-tight tracking-normal">
                Manage KYC workflows with clarity.
              </h2>
              <p className="mt-5 max-w-sm text-base leading-7 text-white/78">
                A secure workspace for enquiries, KYC preparation, approval routing, and document control.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl bg-white/12 p-5 ring-1 ring-white/15 backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-700">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Role based workflow</p>
                    <p className="text-xs text-white/70">Operations, AML, DMLRO, MLRO, and SEF access.</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Enquiries</span>
                <span>KYC Forms</span>
                <span>Approvals</span>
                <span>Documents</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-[680px] items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:text-left">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Newoon Operations</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">Get Started Now</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">Please log in to your account to continue.</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Email address</span>
                <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full border-0 bg-transparent p-0 text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    type="email"
                    placeholder="Enter your email"
                    required
                  />
                </span>
              </label>

              <label className="block">
                <span className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  Password
                  <span className="text-xs font-semibold text-brand-700">Secure access</span>
                </span>
                <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full border-0 bg-transparent p-0 text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    type="password"
                    placeholder="Enter your password"
                    required
                  />
                  <Eye className="h-4 w-4 text-slate-400" />
                </span>
              </label>

              {error && <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Signing in...' : 'Log in'}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </form>

            <div className="my-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-400">Workflow test access</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
              {testLogins.map((item) => (
                <button
                  key={item.email}
                  type="button"
                  onClick={() => {
                    setEmail(item.email);
                    setPassword('Admin@12345');
                  }}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-brand-700">
                    {item.label === 'Company Admin' || item.label === 'Super Admin' ? <Building2 className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                    <span className="block truncate text-xs text-slate-500">{item.email} | {item.note}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-slate-500 lg:text-left">Default test password: Admin@12345</p>
          </div>
        </div>
      </div>
    </section>
  );
}
