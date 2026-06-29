import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'sonner';
import { auth } from '../lib/firebase';
import { getUser } from '../lib/db';
import { LoginScreen } from './components/LoginScreen';
import { CustomerDashboard } from './components/CustomerDashboard';
import { BarberDashboard } from './components/BarberDashboard';
import { AdminDashboard } from './components/AdminDashboard';

interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'barber' | 'customer';
  barberId?: string;
}

const TOAST_STYLE = {
  background: '#141d15',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#eef4ee',
  fontFamily: 'Inter, sans-serif',
  borderRadius: '0.75rem',
};

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.body.style.fontFamily = 'Inter, sans-serif';
    document.body.style.background = '#F8FAFC';

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUser(firebaseUser.uid);
        if (profile) {
          setUser({ uid: firebaseUser.uid, name: profile.name, email: profile.email, role: profile.role, barberId: profile.barberId });
        } else {
          await auth.signOut();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setChecking(false);
    });

    return unsub;
  }, []);

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#07090a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(27,128,50,0.2)', borderTopColor: '#1b8032', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#75897a', fontSize: '0.875rem' }}>Loading Daily Barber…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: TOAST_STYLE }} />
      {!user && <LoginScreen onLogin={setUser} />}
      {user?.role === 'customer' && <CustomerDashboard user={user} onLogout={() => setUser(null)} />}
      {user?.role === 'barber' && <BarberDashboard user={user} onLogout={() => setUser(null)} />}
      {user?.role === 'admin' && <AdminDashboard user={user} onLogout={() => setUser(null)} />}
    </>
  );
}
