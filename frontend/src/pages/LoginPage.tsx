import { FormEvent, useState } from 'react';
import { ArrowRight, Building2, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/auth.service';
import { getApiErrorMessage } from '../services/api';
import { PasswordInput } from '../components/PasswordInput';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(''); setLoading(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      localStorage.setItem('newoon_token', result.accessToken);
      setPassword('');
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to sign in. Check your connection and try again.'));
    } finally { setLoading(false); }
  }

  return <section className="flex min-h-screen flex-col bg-white">
    <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 sm:px-10">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-brand-50 text-brand-700"><Building2 className="h-6 w-6" aria-hidden="true" /></span>
      <div><p className="text-lg font-semibold text-slate-950">Newoon MIS</p><p className="text-xs text-slate-500">KYC &amp; Engagement Platform</p></div>
    </header>
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-3 text-sm text-slate-500">Welcome to Newoon.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5" aria-busy={loading}>
          <div><label htmlFor="login-email" className="text-sm font-medium text-slate-700">Email address</label>
            <input id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} required className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50" />
          </div>
          <div><label htmlFor="login-password" className="text-sm font-medium text-slate-700">Password</label><PasswordInput id="login-password" value={password} onChange={setPassword} minLength={8} autoComplete="current-password" disabled={loading} /></div>
          {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : null}
          <button type="submit" disabled={loading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{loading ? 'Signing in...' : 'Sign in'}{!loading ? <ArrowRight className="h-4 w-4" /> : null}</button>
        </form>
      </div>
    </div>
    <footer className="px-6 py-5 text-center text-xs text-slate-500">Newoon Operations</footer>
  </section>;
}
