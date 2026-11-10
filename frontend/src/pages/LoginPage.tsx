import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isCodeChallenge, login, LoginCodeChallenge, LoginSession, resendLoginCode, verifyLoginCode } from '../services/auth.service';
import { getApiErrorMessage } from '../services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Email sign-in code step (shown only when the server requires a code).
  const [challenge, setChallenge] = useState<LoginCodeChallenge | null>(null);
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  function finish(session: LoginSession) {
    localStorage.setItem('newoon_token', session.accessToken);
    setPassword(''); setCode('');
    navigate('/dashboard', { replace: true });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(''); setNotice(''); setLoading(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (isCodeChallenge(result)) {
        setPassword('');
        setChallenge(result);
        setResendIn(result.resendAfterSeconds);
        return;
      }
      finish(result);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to sign in. Check your connection and try again.'));
    } finally { setLoading(false); }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !challenge) return;
    setError(''); setNotice(''); setLoading(true);
    try {
      finish(await verifyLoginCode(challenge.challengeId, code));
    } catch (requestError) {
      setCode('');
      setError(getApiErrorMessage(requestError, 'Unable to verify the code. Try again.'));
    } finally { setLoading(false); }
  }

  async function handleResend() {
    if (loading || !challenge || resendIn > 0) return;
    setError(''); setNotice(''); setLoading(true);
    try {
      const next = await resendLoginCode(challenge.challengeId);
      setChallenge(next); setCode('');
      setResendIn(next.resendAfterSeconds);
      setNotice(`A new code was sent to ${next.maskedEmail}.`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to send a new code. Try again.'));
    } finally { setLoading(false); }
  }

  function backToPassword() {
    setChallenge(null); setCode(''); setError(''); setNotice(''); setResendIn(0);
  }

  return <section className="flex min-h-screen items-center justify-center px-5 py-8">
    <div className="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] lg:grid-cols-[1.03fr_1fr]">
      <aside className="relative hidden min-h-[680px] overflow-hidden bg-brand-950 p-12 text-white lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#450b0d_0%,#981f23_48%,#b81f23_100%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-3 rounded-2xl bg-white/10 py-2 pl-2 pr-4 ring-1 ring-white/15"><img src="/brand/newoon-mark.png" alt="" className="h-10 w-10 rounded-xl bg-white" width={40} height={40} /><span className="text-xs font-semibold uppercase tracking-wide text-white/90">Newoon MIS</span></div>
            <h2 className="mt-10 max-w-md text-5xl font-semibold leading-tight tracking-normal">Manage KYC workflows with clarity.</h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-white/80">A secure workspace for enquiries, KYC preparation, approval routing, and document control.</p>
          </div>
          <div className="grid gap-4">
            <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-brand-700"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Role based workflow</p><p className="text-xs text-white/70">Operations, AML, DMLRO, MLRO, and SEF access.</p></div></div></div>
            <div className="flex items-center justify-between text-sm text-white/70"><span>Enquiries</span><span>KYC Forms</span><span>Approvals</span><span>Documents</span></div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 items-center justify-center px-6 py-10 sm:px-10 lg:min-h-[680px] lg:px-16">
        <div className="w-full min-w-0 max-w-md">
          <div className="mb-8 text-center lg:text-left"><img src="/brand/newoon-logo.png" alt="Newoon Global LTD." className="mx-auto h-14 w-auto lg:mx-0" width={125} height={56} /><h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{challenge ? 'Check your email' : 'Get Started Now'}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{challenge ? <>We sent a 6-digit sign-in code to <span className="font-semibold text-slate-700">{challenge.maskedEmail}</span>. It expires in {Math.round(challenge.expiresInSeconds / 60)} minutes.</> : 'Please log in to your account to continue.'}</p></div>
          {challenge ? <form onSubmit={handleVerify} className="space-y-5" aria-busy={loading}>
            <div><label htmlFor="login-code" className="text-xs font-semibold text-slate-700">Sign-in code</label>
              <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100"><ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" /><input id="login-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={loading} placeholder="Enter the 6-digit code" required className="min-w-0 flex-1 border-0 bg-transparent p-0 text-lg tracking-[0.4em] text-slate-950 outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-slate-400" /></div>
            </div>
            {error ? <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {notice ? <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
            <button type="submit" disabled={loading || code.length !== 6} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{loading ? 'Checking...' : 'Verify and sign in'}{!loading ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /> : null}</button>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <button type="button" onClick={handleResend} disabled={loading || resendIn > 0} className="font-semibold text-brand-700 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-slate-400">{resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}</button>
              <button type="button" onClick={backToPassword} disabled={loading} className="font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60">Use a different account</button>
            </div>
          </form> : <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
            <div><label htmlFor="login-email" className="text-xs font-semibold text-slate-700">Email address</label>
              <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100"><Mail className="h-4 w-4 shrink-0 text-slate-400" /><input id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} placeholder="Enter your email" required className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-950 outline-none placeholder:text-slate-400" /></div>
            </div>
            <div><label htmlFor="login-password" className="flex items-center justify-between text-xs font-semibold text-slate-700">Password<span className="text-brand-700">Secure access</span></label>
              <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100"><KeyRound className="h-4 w-4 shrink-0 text-slate-400" /><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} placeholder="Enter your password" required minLength={8} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-950 outline-none placeholder:text-slate-400" /><button type="button" disabled={loading} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-600">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
            </div>
            {error ? <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            <button type="submit" disabled={loading} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{loading ? 'Signing in...' : 'Log in'}{!loading ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /> : null}</button>
          </form>}
        </div>
      </div>
    </div>
  </section>;
}
