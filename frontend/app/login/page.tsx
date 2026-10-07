'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import './login.css';

type Step = 'login' | 'signup' | 'signup-otp' | 'set-password' | 'forgot' | 'reset-otp' | 'reset-password';

async function post(path: string, body: object) {
  const response = await fetch(`/api/auth/${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || result.detail || 'Something went wrong. Try again.');
  return result;
}

export default function LoginPage() {
  const [step, setStep] = useState<Step>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [ticket, setTicket] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function go(next: Step) { setStep(next); setError(''); setNotice(''); setOtp(''); setPassword(''); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (step === 'login') { await post('login', { username, password }); window.location.assign('/'); }
      if (step === 'signup') { const result = await post('signup', { username, email }); go('signup-otp'); setNotice(result.delivery === 'email' ? 'We sent a six-digit code to your email. It expires in 10 minutes. Check your spam folder too.' : 'Email is not configured on this local server. Find your code in the server log.'); }
      if (step === 'signup-otp') { const result = await post('verify-signup', { email, code: otp }); setTicket(result.ticket); go('set-password'); }
      if (step === 'set-password') { await post('set-password', { ticket, password }); window.location.assign('/'); }
      if (step === 'forgot') { await post('forgot-password', { email }); go('reset-otp'); setNotice('If this email has an account, a code is on its way. It expires in 10 minutes. Check your spam folder too.'); }
      if (step === 'reset-otp') { const result = await post('verify-reset', { email, code: otp }); setTicket(result.ticket); go('reset-password'); }
      if (step === 'reset-password') { await post('reset-password', { ticket, password }); go('login'); setNotice('Password updated. Welcome back!'); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function resend() { setBusy(true); setError(''); setNotice(''); try { const result = await post('resend-code', { email, purpose: step === 'signup-otp' ? 'signup' : 'password_reset' }); setNotice(result.delivery === 'development_log' ? 'Email is not configured on this local server. Find your new code in the server log.' : 'If this email can receive a code, a new one is on its way.'); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Please try again.'); } finally { setBusy(false); } }

  const heading: Record<Step, string> = { login: 'Ready to explore?', signup: 'Your adventure starts here.', 'signup-otp': 'Check your inbox.', 'set-password': 'Make it yours.', forgot: 'Find your way back.', 'reset-otp': 'One more little step.', 'reset-password': 'Choose a new password.' };
  const subtitle: Record<Step, string> = { login: 'Your ideas, discoveries, and little wins are waiting for you.', signup: 'Pick a username and add your email to begin.', 'signup-otp': `Enter the code sent to ${email}.`, 'set-password': 'Create a strong password to protect your space.', forgot: 'Enter the email you used when you joined.', 'reset-otp': `Enter the code sent to ${email}.`, 'reset-password': 'A fresh start is ready for you.' };
  const button: Record<Step, string> = { login: 'Enter my workspace', signup: 'Send my code', 'signup-otp': 'Verify my email', 'set-password': 'Create my space', forgot: 'Send reset code', 'reset-otp': 'Verify reset code', 'reset-password': 'Save new password' };
  return <main className="auth-page">
    <div className="auth-ambient auth-ambient-a" aria-hidden="true" />
    <div className="auth-ambient auth-ambient-b" aria-hidden="true" />
    <div className="auth-ambient auth-ambient-c" aria-hidden="true" />
    <div className="auth-shell">
      <section className="auth-scene" aria-label="A colorful learning scene">
        <div className="auth-brand"><span className="auth-brand-mark">s<span>·</span></span><span>shreehan<span className="auth-brand-dot">.</span></span></div>
        <span className="auth-scene-pill">✦ YOUR LEARNING SPACE</span>
        <div className="auth-story">
          <span className="auth-kicker"><i /> A BRIGHTER DAY STARTS HERE</span>
          <h1>Big dreams.<br /><em>Little steps.</em></h1>
          <p>Every lesson is a new adventure. Come on in and see what you can discover today!</p>
        </div>
        <div className="auth-illustration" aria-hidden="true">
          <div className="auth-sun" /><div className="auth-cloud auth-cloud-one" /><div className="auth-cloud auth-cloud-two" />
          <div className="auth-book"><span className="auth-book-left" /><span className="auth-book-right" /><span className="auth-book-spine" /></div>
          <div className="auth-pencil" />
          <span className="auth-star auth-star-one">✦</span><span className="auth-star auth-star-two">✳</span><span className="auth-star auth-star-three">✦</span><span className="auth-star auth-star-four">✦</span>
        </div>
        <div className="auth-scene-note">✶ Learn · Imagine · Grow</div>
      </section>
      <section className="auth-card">
        <div className="auth-card-inner">
          <div className="auth-card-icon" aria-hidden="true"><Sparkles size={27} /></div>
          <span className="auth-card-eyebrow">WELCOME TO SHREEHAN HQ</span>
          <h2>{heading[step]}</h2>
          <p className="auth-subtitle">{subtitle[step]}</p>
          <form onSubmit={submit}>
            {(step === 'signup' || step === 'login') && <label><span><UserRound size={15} /> Username</span><input autoComplete="username" required minLength={3} maxLength={32} value={username} onChange={event => setUsername(event.target.value)} placeholder="Your favorite name" /></label>}
            {(step === 'signup' || step === 'forgot') && <label><span><Mail size={15} /> Email address</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
            {(step === 'signup-otp' || step === 'reset-otp') && <label><span><ShieldCheck size={15} /> Six-digit code</span><input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="auth-otp" /></label>}
            {(step === 'login' || step === 'set-password' || step === 'reset-password') && <label><span><KeyRound size={15} /> Password</span><span className="auth-password"><input type={showPassword ? 'text' : 'password'} autoComplete={step === 'login' ? 'current-password' : 'new-password'} required minLength={step === 'login' ? 1 : 6} value={password} onChange={event => setPassword(event.target.value)} placeholder={step === 'login' ? 'Enter your password' : 'At least 6 characters'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>}
            {step === 'login' && <button type="button" className="auth-text-action auth-forgot" onClick={() => go('forgot')}>Forgot password?</button>}
            {(step === 'signup-otp' || step === 'reset-otp') && <button type="button" className="auth-text-action auth-forgot" disabled={busy} onClick={resend}>Send a new code</button>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status"><Check size={15} />{notice}</p>}
            <button className="auth-submit" disabled={busy}>{busy ? 'One moment…' : button[step]}<ArrowRight size={19} /></button>
          </form>
          {step !== 'login' && <div className="auth-switch"><button onClick={() => go('login')}>← Back to sign in</button></div>}
          <div className="auth-safe"><ShieldCheck size={17} /> A little space that’s all yours.</div>
        </div>
      </section>
    </div>
  </main>;
}
