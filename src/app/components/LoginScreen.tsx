import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'sonner';
import { auth } from '../../lib/firebase';
import { getUser, createUser, createCustomer } from '../../lib/db';
import type { UserRole } from '../../lib/db';
import logoImg from '../../imports/logo.png';

interface AppUser { uid: string; name: string; email: string; role: UserRole; barberId?: string; }
interface Props { onLogin: (u: AppUser) => void; }
type Mode = 'login' | 'register';

const G    = '#16A34A';
const DARK = '#111827';
const MID  = '#6B7280';
const BDR  = '#E5E7EB';

const INP_BASE: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem',
  borderRadius: '0.5rem', border: `1px solid ${BDR}`,
  background: '#fff', color: DARK,
  fontSize: '0.9375rem', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

// Defined at module level so it never remounts on parent re-render
function Field({ label, type, value, onChange, placeholder, req = true }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string; req?: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const isPw = type === 'password';
  return (
    <div>
      <label style={{ display: 'block', color: DARK, fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem', fontFamily: 'Inter, sans-serif' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={isPw && showPw ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={req}
          onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}20`; }}
          onBlur={e => { e.target.style.borderColor = BDR; e.target.style.boxShadow = 'none'; }}
          style={{ ...INP_BASE, paddingRight: isPw ? '2.75rem' : '0.875rem' }}
        />
        {isPw && (
          <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: MID, display: 'flex', padding: 0 }}>
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function LoginScreen({ onLogin }: Props) {
  const [mode, setMode]   = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw]       = useState('');
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = (m: Mode) => { setMode(m); setEmail(''); setPw(''); setName(''); setPhone(''); };

  const authErr = (code: string, msg: string) => {
    const m: Record<string, string> = {
      'auth/invalid-credential':   'Incorrect email or password.',
      'auth/user-not-found':        'No account found with this email.',
      'auth/email-already-in-use':  'Email already registered — sign in instead.',
      'auth/weak-password':         'Password must be at least 6 characters.',
      'auth/too-many-requests':     'Too many attempts. Try again later.',
    };
    toast.error(m[code] ?? msg ?? 'Something went wrong.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pw);
      const profile = await getUser(cred.user.uid);
      if (!profile) { await auth.signOut(); throw new Error('Account not configured. Contact admin.'); }
      toast.success(`Welcome back, ${profile.name}!`);
      onLogin({ uid: cred.user.uid, name: profile.name, email: profile.email, role: profile.role, barberId: profile.barberId });
    } catch (err: any) { authErr(err.code, err.message); }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Please enter your name.'); return; }
    if (pw.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      const uid = cred.user.uid;
      const today = new Date().toISOString().split('T')[0];
      await createUser(uid, { name: name.trim(), email: email.trim(), role: 'customer' });
      await createCustomer(uid, { name: name.trim(), email: email.trim(), phone: phone.trim(), totalVisits: 0, totalSpent: 0, lastVisit: today, loyaltyTier: 'Bronze', loyaltyPoints: 0, visitStreak: 0, joinDate: today });
      toast.success('Account created. Welcome!');
      onLogin({ uid, name: name.trim(), email: email.trim(), role: 'customer' });
    } catch (err: any) { authErr(err.code, err.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo & brand */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: '1.25rem', background: '#fff', boxShadow: '0 4px 16px rgba(22,163,74,0.15), 0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1rem', overflow: 'hidden' }}>
            <img src={logoImg} alt="SmartCut" style={{ width: 80, height: 80, objectFit: 'contain', mixBlendMode: 'multiply' }} />
          </div>
          <h1 style={{ color: DARK, fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em', margin: '0 0 0.25rem' }}>SmartCut</h1>
          <p style={{ color: MID, fontSize: '0.875rem', margin: 0 }}>Daily Barber Hair Studio</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '1rem', border: `1px solid ${BDR}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${BDR}` }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button key={m} onClick={() => reset(m)} style={{
                padding: '0.875rem 1rem', background: mode === m ? '#fff' : '#F9FAFB',
                border: 'none', borderBottom: mode === m ? `2px solid ${G}` : '2px solid transparent',
                cursor: 'pointer', color: mode === m ? G : MID,
                fontWeight: mode === m ? 600 : 400, fontSize: '0.875rem',
                marginBottom: -1, transition: 'all 0.15s', fontFamily: 'Inter, sans-serif',
              }}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div style={{ padding: '1.75rem' }}>
            <AnimatePresence mode="wait">
              {mode === 'login' ? (
                <motion.form key="login" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }} transition={{ duration: 0.15 }} onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@email.com" />
                  <Field label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••••" />
                  <button type="submit" disabled={loading} style={{ marginTop: '0.25rem', padding: '0.75rem', borderRadius: '0.625rem', background: loading ? '#15803d' : G, color: '#fff', fontWeight: 600, fontSize: '0.9375rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s', boxShadow: loading ? 'none' : `0 2px 8px ${G}40` }}>
                    {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Signing in…</> : <>Sign In <ArrowRight size={16} /></>}
                  </button>
                  <p style={{ color: MID, fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                    Admin & barber accounts are created by the administrator only.
                  </p>
                </motion.form>
              ) : (
                <motion.form key="register" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }} onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Field label="Full Name" type="text" value={name} onChange={setName} placeholder="Juan dela Cruz" />
                  <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@email.com" />
                  <Field label="Phone number" type="tel" value={phone} onChange={setPhone} placeholder="09XXXXXXXXX" req={false} />
                  <Field label="Password" type="password" value={pw} onChange={setPw} placeholder="Min. 6 characters" />
                  <button type="submit" disabled={loading} style={{ marginTop: '0.25rem', padding: '0.75rem', borderRadius: '0.625rem', background: loading ? '#15803d' : G, color: '#fff', fontWeight: 600, fontSize: '0.9375rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s', boxShadow: loading ? 'none' : `0 2px 8px ${G}40` }}>
                    {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating account…</> : <>Create Account <ArrowRight size={16} /></>}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p style={{ color: '#9CA3AF', fontSize: '0.75rem', textAlign: 'center', marginTop: '1.5rem' }}>
          SmartCut · Daily Barber Hair Studio · 2026
        </p>
      </motion.div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
