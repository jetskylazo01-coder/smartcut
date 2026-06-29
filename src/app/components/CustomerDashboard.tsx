import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { Scissors, Calendar, Clock, Star, ChevronRight, X, Check, LogOut, User, History, ChevronLeft, Plus, Trophy, Bell, Camera, AlertCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../../lib/firebase';
import { listenBarbers, listenServices, listenCustomerReservations, createReservation, updateReservationStatus, listenCustomer, updateCustomer, listenNotifications, markNotificationRead, markAllNotificationsRead, listenBarberDateBookings, rateReservation } from '../../lib/db';
import type { DBBarber, DBService, DBReservation, DBCustomer, DBNotification, DBServiceItem, ReservationStatus } from '../../lib/db';
import { uploadImage } from '../../lib/cloudinary';
import { CustomerHistoryModule } from './CustomerHistoryModule';
import { fmt12 } from '../../lib/timeFormat';
import { Sidebar } from './Sidebar';
import logoImg from '../../imports/logo.png';

interface Props { user: { uid: string; name: string; email: string }; onLogout: () => void; }
type Nav = 'home' | 'book' | 'appointments' | 'history' | 'profile';

// Light-mode tokens
const G      = '#16A34A';
const DARK   = '#111827';
const MID    = '#6B7280';
const BG     = '#F8FAFC';
const WHITE  = '#FFFFFF';
const BDR    = '#E5E7EB';
const LITE   = '#F9FAFB';
const GREEN_BG = '#F0FDF4';
const GREEN_BDR = '#BBF7D0';
const WARN   = '#F59E0B';
const ERR    = '#EF4444';
const BLUE   = '#3B82F6';
const SHADOW = '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)';

const STATUS: Record<ReservationStatus, { color: string; bg: string }> = {
  Pending:   { color: '#92400E', bg: '#FEF3C7' },
  Confirmed: { color: '#166534', bg: '#DCFCE7' },
  Completed: { color: '#1E40AF', bg: '#DBEAFE' },
  Cancelled: { color: '#991B1B', bg: '#FEE2E2' },
};

const ALL_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STEPS = ['Service', 'Barber', 'Date & Time', 'Confirm'];
const NAV_ITEMS = [
  { id: 'home' as Nav,         label: 'Home',         icon: Scissors },
  { id: 'book' as Nav,         label: 'Book',         icon: Calendar },
  { id: 'appointments' as Nav, label: 'Appointments', icon: History  },
  { id: 'history' as Nav,      label: 'Loyalty',      icon: Trophy   },
  { id: 'profile' as Nav,      label: 'Profile',      icon: User     },
];

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: WHITE, borderRadius: '0.875rem', border: `1px solid ${BDR}`, boxShadow: SHADOW, ...style }}>{children}</div>;
}

/** Interactive 5-star rating widget — defined at module level to avoid remount issues */
function StarRating({
  reservationId, barberId, existingRating, onRated,
}: {
  reservationId: string; barberId: string; existingRating?: number; onRated: (r: number) => void;
}) {
  const [hovered, setHovered]   = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(!!existingRating);
  const current                  = existingRating ?? 0;

  const handleRate = async (rating: number) => {
    if (done || submitting) return;
    setSubmitting(true);
    try {
      await rateReservation(reservationId, barberId, rating);
      setDone(true);
      onRated(rating);
      toast.success('Thanks for your rating!');
    } catch { toast.error('Rating failed. Try again.'); }
    setSubmitting(false);
  };

  if (done && current > 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {[1,2,3,4,5].map(i => (
          <Star key={i} size={14} fill={i <= current ? '#F59E0B' : 'transparent'} color={i <= current ? '#F59E0B' : '#D1D5DB'} />
        ))}
        <span style={{ color: '#6B7280', fontSize: '0.75rem', marginLeft: '0.25rem' }}>Your rating</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
      <span style={{ color: '#6B7280', fontSize: '0.75rem', marginRight: '0.25rem' }}>Rate:</span>
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          onClick={() => handleRate(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          disabled={submitting}
          style={{ background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', padding: '0.125rem', display: 'flex' }}
        >
          <Star
            size={18}
            fill={i <= (hovered || current) ? '#F59E0B' : 'transparent'}
            color={i <= (hovered || current) ? '#F59E0B' : '#D1D5DB'}
            style={{ transition: 'fill 0.1s' }}
          />
        </button>
      ))}
    </div>
  );
}

function Badge({ status }: { status: ReservationStatus }) {
  const s = STATUS[status];
  return <span style={{ display: 'inline-flex', padding: '0.2rem 0.625rem', borderRadius: '999px', background: s.bg, color: s.color, fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>{status}</span>;
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card style={{ padding: '1.125rem 1.25rem' }}>
      <p style={{ color: MID, fontSize: '0.75rem', fontWeight: 500, margin: '0 0 0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ color: accent ? G : DARK, fontWeight: 700, fontSize: '1.5rem', margin: 0 }}>{value}</p>
    </Card>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {[80, 64, 64].map((h, i) => <div key={i} style={{ height: h, background: '#F3F4F6', borderRadius: '0.75rem', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, fullWidth }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; fullWidth?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '0.6875rem 1.375rem', borderRadius: '0.625rem', background: disabled ? '#86EFAC' : G, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Inter, sans-serif', boxShadow: disabled ? 'none' : `0 2px 8px ${G}40`, width: fullWidth ? '100%' : undefined, justifyContent: fullWidth ? 'center' : undefined }}>
      {children}
    </button>
  );
}

export function CustomerDashboard({ user, onLogout }: Props) {
  const [nav, setNav]                   = useState<Nav>('home');
  const [barbers, setBarbers]           = useState<DBBarber[]>([]);
  const [services, setServices]         = useState<DBService[]>([]);
  const [reservations, setReservations] = useState<DBReservation[]>([]);
  const [customer, setCustomer]         = useState<DBCustomer | null>(null);
  const [notifs, setNotifs]             = useState<DBNotification[]>([]);
  const [loading, setLoading]           = useState(true);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState(0);
  const [selSvcs, setSelSvcs]     = useState<DBService[]>([]);   // multi-service
  const [selBarber, setSelBarber] = useState<DBBarber | null>(null);
  const [calYear, setCalYear]     = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]   = useState(new Date().getMonth());
  const [selDate, setSelDate]     = useState<string | null>(null);
  const [selTime, setSelTime]     = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [booking, setBooking]     = useState(false);

  // Multi-service computed values
  const totalPrice    = selSvcs.reduce((s, x) => s + x.price, 0);
  const totalDuration = selSvcs.reduce((s, x) => s + x.duration, 0);

  useEffect(() => {
    const u: (() => void)[] = [];
    u.push(listenBarbers(setBarbers));
    u.push(listenServices(s => { setServices(s); setLoading(false); }));
    u.push(listenCustomerReservations(user.uid, setReservations));
    u.push(listenNotifications(user.uid, setNotifs));
    u.push(listenCustomer(user.uid, setCustomer)); // real-time — updates when loyalty tier changes
    return () => u.forEach(fn => fn());
  }, [user.uid]);

  useEffect(() => {
    if (!selBarber || !selDate) { setBookedSlots([]); return; }
    return listenBarberDateBookings(selBarber.id, selDate, setBookedSlots);
  }, [selBarber?.id, selDate]);

  const handleLogout = async () => { await signOut(auth); onLogout(); };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingPhoto(true);
    try { const url = await uploadImage(file); await updateCustomer(user.uid, { photo: url }); setCustomer(p => p ? { ...p, photo: url } : p); toast.success('Photo updated.'); }
    catch { toast.error('Upload failed.'); }
    setUploadingPhoto(false); e.target.value = '';
  };

  const resetBook = () => {
    setStep(0); setSelSvcs([]); setSelBarber(null);
    setSelDate(null); setSelTime(null); setBookedSlots([]);
  };

  const toggleSvc = (svc: DBService) => {
    setSelSvcs(prev =>
      prev.find(s => s.id === svc.id)
        ? prev.filter(s => s.id !== svc.id)
        : [...prev, svc]
    );
  };

  const handleBook = async () => {
    if (selSvcs.length === 0 || !selDate || !selTime || booking) return;
    if (bookedSlots.includes(selTime)) { toast.error('Slot just taken — pick another.'); setSelTime(null); return; }
    setBooking(true);
    try {
      const barber = selBarber ?? barbers.find(b => b.available) ?? barbers[0];
      if (!barber) throw new Error('No barbers available.');

      const serviceItems: DBServiceItem[] = selSvcs.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration }));
      const serviceLabel = selSvcs.length === 1 ? selSvcs[0].name : selSvcs.map(s => s.name).join(' + ');

      await createReservation({
        customerId: user.uid, customer: user.name,
        barberId: barber.id, barber: barber.name,
        serviceId: selSvcs[0].id,
        service: serviceLabel,
        services: serviceItems,
        totalDuration,
        date: selDate, time: selTime,
        amount: totalPrice,
        status: 'Pending',
      });
      toast.success(`Booked ${selSvcs.length} service${selSvcs.length > 1 ? 's' : ''}! Awaiting confirmation.`);
      resetBook(); setNav('appointments');
    } catch (e: any) { toast.error(e.message); }
    setBooking(false);
  };

  const unread   = notifs.filter(n => !n.isRead).length;
  const upcoming = reservations.filter(r => r.status === 'Confirmed' || r.status === 'Pending');
  const past     = reservations.filter(r => r.status === 'Completed' || r.status === 'Cancelled');
  const today    = new Date();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const barberSlots = selBarber?.availableSlots ?? ALL_SLOTS;

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar nav={nav} setNav={n => { setNav(n); if (n !== 'book') resetBook(); }} items={NAV_ITEMS} userName={user.name} userRole="Customer" userPhoto={customer?.photo} onLogout={handleLogout} />

      <main style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', position: 'relative' }}>
          <button onClick={() => { setNotifOpen(o => !o); if (unread) markAllNotificationsRead(user.uid); }}
            style={{ position: 'relative', width: 36, height: 36, borderRadius: '0.5rem', background: WHITE, border: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: SHADOW }}>
            <Bell size={15} color={notifOpen ? G : MID} />
            {unread > 0 && <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: ERR, border: `2px solid ${WHITE}` }} />}
          </button>
          {notifOpen && (
            <>
              <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{ position: 'absolute', top: '110%', right: 0, width: 320, maxHeight: 400, background: WHITE, border: `1px solid ${BDR}`, borderRadius: '0.875rem', zIndex: 50, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${BDR}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: DARK, fontWeight: 600, fontSize: '0.875rem' }}>Notifications</span>
                  {unread > 0 && <span style={{ background: ERR, color: '#fff', borderRadius: '999px', fontSize: '0.625rem', fontWeight: 700, padding: '0.1rem 0.4rem' }}>{unread}</span>}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {notifs.length === 0 ? <p style={{ color: MID, padding: '1.25rem', textAlign: 'center', fontSize: '0.8125rem' }}>No notifications</p>
                    : notifs.map(n => (
                        <div key={n.id} onClick={() => markNotificationRead(n.id)} style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${BDR}`, cursor: 'pointer', background: n.isRead ? WHITE : '#F0FDF4', borderLeft: n.isRead ? '3px solid transparent' : `3px solid ${G}` }}>
                          <p style={{ color: DARK, fontWeight: n.isRead ? 400 : 600, fontSize: '0.8125rem', margin: 0 }}>{n.title}</p>
                          <p style={{ color: MID, fontSize: '0.75rem', marginTop: '0.2rem', lineHeight: 1.5 }}>{n.message}</p>
                        </div>
                      ))
                  }
                </div>
              </div>
            </>
          )}
        </div>

        <AnimatePresence mode="wait">

          {/* ── HOME ── */}
          {nav === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ marginBottom: '1.75rem' }}>
                <p style={{ color: MID, fontSize: '0.875rem', margin: '0 0 0.25rem' }}>Welcome back,</p>
                <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.02em', margin: 0 }}>{user.name.split(' ')[0]} 👋</h1>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <StatCard label="Total Visits" value={customer?.totalVisits ?? 0} accent />
                <StatCard label="Last Visit" value={customer?.lastVisit ?? '—'} />
                <StatCard label="Total Spent" value={`₱${(customer?.totalSpent ?? 0).toLocaleString()}`} />
              </div>

              {/* CTA Card */}
              <Card style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', fontWeight: 500, margin: '0 0 0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ready for a fresh cut?</p>
                    <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.25, margin: '0 0 0.375rem' }}>Book your next appointment</h2>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', margin: 0 }}>Starting at ₱150 · 13 services · Real-time availability</p>
                  </div>
                  <button onClick={() => setNav('book')} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: '1.5px solid rgba(255,255,255,0.35)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(4px)' }}>
                    Book Now <ArrowRight size={15} />
                  </button>
                </div>
              </Card>

              {/* Upcoming */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>Upcoming Appointments</h3>
                  <button onClick={() => setNav('appointments')} style={{ color: G, fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>View all →</button>
                </div>
                {loading ? <Skeleton /> : upcoming.length === 0
                  ? <Card style={{ padding: '1.75rem', textAlign: 'center' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}><Calendar size={20} color={G} /></div>
                      <p style={{ color: MID, fontSize: '0.875rem', margin: '0 0 1rem' }}>No upcoming appointments</p>
                      <PrimaryBtn onClick={() => setNav('book')}><Plus size={14} /> Book now</PrimaryBtn>
                    </Card>
                  : <Card>
                      {upcoming.slice(0, 3).map((r, i) => (
                        <div key={r.id} style={{ padding: '0.875rem 1.125rem', borderBottom: i < Math.min(upcoming.length, 3) - 1 ? `1px solid ${BDR}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>{r.service}</p>
                            <p style={{ color: MID, fontSize: '0.8rem', marginTop: '0.2rem' }}>{r.barber} · {r.date} {fmt12(r.time)}</p>
                          </div>
                          <Badge status={r.status} />
                        </div>
                      ))}
                    </Card>
                }
              </div>

              {/* Barbers */}
              <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 0.75rem' }}>Our Barbers</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                {barbers.map(b => (
                  <Card key={b.id} style={{ padding: '1rem 1.125rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <img src={b.photo} alt={b.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${BDR}` }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</p>
                      <p style={{ color: MID, fontSize: '0.75rem', marginTop: '0.125rem' }}>{b.speciality}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                        <Star size={11} fill="#F59E0B" color="#F59E0B" />
                        <span style={{ color: '#92400E', fontSize: '0.6875rem', fontWeight: 600 }}>{b.rating}</span>
                        <span style={{ padding: '0.1rem 0.4rem', borderRadius: '999px', background: b.available ? GREEN_BG : '#FEE2E2', color: b.available ? '#166534' : '#991B1B', fontSize: '0.625rem', fontWeight: 600 }}>{b.available ? 'Available' : 'Off'}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── BOOK ── */}
          {nav === 'book' && (
            <motion.div key="book" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
                <div>
                  <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: 0 }}>Book Appointment</h1>
                  <p style={{ color: MID, fontSize: '0.875rem', marginTop: '0.25rem' }}>{STEPS[step]} — Step {step + 1} of {STEPS.length}</p>
                </div>
                {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', background: WHITE, border: `1px solid ${BDR}`, cursor: 'pointer', color: MID, fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif' }}><ChevronLeft size={14} /> Back</button>}
              </div>

              {/* Step indicator */}
              <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '2rem' }}>
                {STEPS.map((s, i) => (
                  <div key={s} style={{ flex: 1 }}>
                    <div style={{ height: 3, borderRadius: 2, background: i < step ? G : i === step ? G : '#E5E7EB', opacity: i < step ? 0.4 : 1, transition: 'background 0.25s' }} />
                    <p style={{ color: i <= step ? G : MID, fontSize: '0.6875rem', fontWeight: i === step ? 600 : 400, marginTop: '0.375rem' }}>{s}</p>
                  </div>
                ))}
              </div>

              {step === 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
                  {/* Left: service list */}
                  <div>
                    <p style={{ color: MID, fontSize: '0.875rem', marginBottom: '1.25rem' }}>Select one or more services. Prices and duration add up automatically.</p>
                    {loading ? <Skeleton /> : (() => {
                      const daily  = services.filter(s => s.isActive && s.category !== 'Other');
                      const others = services.filter(s => s.isActive && s.category === 'Other');
                      const SvcCard = ({ s }: { s: typeof services[0] }) => {
                        const selected = !!selSvcs.find(x => x.id === s.id);
                        return (
                          <button onClick={() => toggleSvc(s)} style={{ background: selected ? GREEN_BG : WHITE, border: `1.5px solid ${selected ? G : BDR}`, borderRadius: '0.75rem', padding: '0.875rem 1rem', cursor: 'pointer', textAlign: 'left', width: '100%', boxShadow: SHADOW, transition: 'all 0.15s', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            {/* Checkbox */}
                            <div style={{ width: 18, height: 18, borderRadius: '0.3rem', border: `2px solid ${selected ? G : BDR}`, background: selected ? G : WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.125rem' }}>
                              {selected && <Check size={11} color="#fff" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: selected ? '#166534' : DARK, fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{s.name}</p>
                              <p style={{ color: MID, fontSize: '0.75rem', marginTop: '0.2rem', lineHeight: 1.4 }}>{s.description}</p>
                              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
                                <span style={{ color: G, fontWeight: 700, fontSize: '0.9rem' }}>₱{s.price}</span>
                                <span style={{ color: MID, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={11} />{s.duration} min</span>
                              </div>
                            </div>
                          </button>
                        );
                      };
                      return (
                        <div style={{ marginBottom: '1.25rem' }}>
                          {daily.length > 0 && <>
                            <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Daily Services</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>{daily.map(s => <SvcCard key={s.id} s={s} />)}</div>
                          </>}
                          {others.length > 0 && <>
                            <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Other Services</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{others.map(s => <SvcCard key={s.id} s={s} />)}</div>
                          </>}
                        </div>
                      );
                    })()}
                    <PrimaryBtn onClick={() => selSvcs.length > 0 && setStep(1)} disabled={selSvcs.length === 0}>Continue <ArrowRight size={14} /></PrimaryBtn>
                  </div>

                  {/* Right: sticky summary panel */}
                  <div style={{ position: 'sticky', top: '1.5rem' }}>
                    <Card style={{ padding: '1.25rem' }}>
                      <p style={{ color: DARK, fontWeight: 700, fontSize: '0.9375rem', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ display: 'inline-flex', width: 20, height: 20, borderRadius: '50%', background: selSvcs.length > 0 ? G : BDR, color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>{selSvcs.length}</span>
                        Booking Summary
                      </p>
                      {selSvcs.length === 0 ? (
                        <p style={{ color: MID, fontSize: '0.8125rem', textAlign: 'center', padding: '1rem 0' }}>Select services to see the summary</p>
                      ) : (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                            {selSvcs.map(s => (
                              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1, minWidth: 0 }}>
                                  <button onClick={() => toggleSvc(s)} style={{ width: 14, height: 14, borderRadius: '50%', background: '#FEE2E2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={9} color="#991B1B" /></button>
                                  <span style={{ color: DARK, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                </div>
                                <span style={{ color: G, fontWeight: 600, fontSize: '0.8125rem', marginLeft: '0.5rem', flexShrink: 0 }}>₱{s.price}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ borderTop: `1px solid ${BDR}`, paddingTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: MID, fontSize: '0.8125rem' }}>Duration</span>
                              <span style={{ color: DARK, fontWeight: 600, fontSize: '0.8125rem' }}>{totalDuration} min</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: DARK, fontWeight: 700, fontSize: '0.9375rem' }}>Total</span>
                              <span style={{ color: G, fontWeight: 800, fontSize: '1.125rem' }}>₱{totalPrice.toLocaleString()}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </Card>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <p style={{ color: MID, fontSize: '0.875rem', marginBottom: '1.25rem' }}>Optional — skip to assign any available barber.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1.5rem' }}>
                    {barbers.map(b => {
                      const active = selBarber?.id === b.id;
                      return (
                        <button key={b.id} onClick={() => setSelBarber(active ? null : b)} style={{ background: active ? GREEN_BG : WHITE, border: `1.5px solid ${active ? G : BDR}`, borderRadius: '0.75rem', padding: '1rem', cursor: 'pointer', textAlign: 'left', boxShadow: SHADOW, transition: 'all 0.15s' }}>
                          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                            <img src={b.photo} alt={b.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${active ? G : BDR}`, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: active ? '#166534' : DARK, fontWeight: 600, fontSize: '0.9rem', margin: 0, fontFamily: 'Inter, sans-serif' }}>{b.name}</p>
                              <p style={{ color: MID, fontSize: '0.6875rem', fontFamily: 'Inter, sans-serif' }}>{b.speciality}</p>
                            </div>
                            {active && <div style={{ width: 18, height: 18, borderRadius: '50%', background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={11} color="#fff" /></div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <PrimaryBtn onClick={() => setStep(2)}>{selBarber ? `Continue with ${selBarber.name.split(' ')[0]}` : 'Any Barber'} <ArrowRight size={14} /></PrimaryBtn>
                </div>
              )}

              {step === 2 && (
                <div>
                  {selBarber && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: GREEN_BG, border: `1px solid ${GREEN_BDR}`, borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                      <img src={selBarber.photo} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ color: '#166534', fontSize: '0.8125rem', fontWeight: 500 }}>Booking with <strong>{selBarber.name}</strong></span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    {/* Calendar */}
                    <Card style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                        <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }} style={{ background: LITE, border: `1px solid ${BDR}`, borderRadius: '0.375rem', cursor: 'pointer', color: MID, display: 'flex', padding: '0.3rem' }}><ChevronLeft size={14} /></button>
                        <p style={{ color: DARK, fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{MONTHS[calMonth]} {calYear}</p>
                        <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }} style={{ background: LITE, border: `1px solid ${BDR}`, borderRadius: '0.375rem', cursor: 'pointer', color: MID, display: 'flex', padding: '0.3rem' }}><ChevronRight size={14} /></button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
                        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <p key={d} style={{ color: '#9CA3AF', fontSize: '0.625rem', fontWeight: 600, padding: '0.2rem 0', margin: 0 }}>{d}</p>)}
                        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                          const isPast = new Date(ds) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                          const isSel = selDate === ds;
                          const isToday = today.getDate() === day && today.getMonth() === calMonth && today.getFullYear() === calYear;
                          return (
                            <button key={day} onClick={() => { if (!isPast) { setSelDate(ds); setSelTime(null); } }} disabled={isPast}
                              style={{ padding: '0.3rem', borderRadius: '0.375rem', border: isSel ? `1.5px solid ${G}` : '1.5px solid transparent', background: isSel ? G : isToday ? GREEN_BG : 'transparent', color: isPast ? '#D1D5DB' : isSel ? '#fff' : isToday ? G : DARK, fontSize: '0.8125rem', fontWeight: isSel || isToday ? 700 : 400, cursor: isPast ? 'not-allowed' : 'pointer' }}>
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Slots */}
                    <Card style={{ padding: '1rem' }}>
                      <p style={{ color: DARK, fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.75rem' }}>{selDate ? 'Pick a time' : 'Select a date first'}</p>
                      {selDate && (
                        <>
                          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                            {[{ c: G, l: 'Open' }, { c: ERR, l: 'Taken' }, { c: '#D1D5DB', l: 'Blocked' }].map(x => (
                              <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: x.c }} />
                                <span style={{ color: MID, fontSize: '0.6875rem' }}>{x.l}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.375rem' }}>
                            {ALL_SLOTS.map(t => {
                              const inBarber = barberSlots.includes(t);
                              const booked   = bookedSlots.includes(t);
                              const avail    = inBarber && !booked;
                              const sel      = selTime === t;
                              let bg = LITE, border = `1px solid ${BDR}`, color = '#D1D5DB', cursor = 'not-allowed';
                              if (booked) { bg = '#FEF2F2'; border = `1px solid #FECACA`; color = '#FCA5A5`'; }
                              else if (avail) { bg = sel ? G : WHITE; border = sel ? `1.5px solid ${G}` : `1px solid ${BDR}`; color = sel ? '#fff' : DARK; cursor = 'pointer'; }
                              return (
                                <button key={t} onClick={() => avail && setSelTime(t)} disabled={!avail} title={booked ? 'Already booked' : !inBarber ? 'Not available' : ''}
                                  style={{ padding: '0.4375rem', borderRadius: '0.375rem', border, background: bg, color, fontSize: '0.75rem', fontWeight: sel ? 700 : 400, cursor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', transition: 'all 0.1s' }}>
                                  {fmt12(t)}{booked && <AlertCircle size={9} color="#EF4444" />}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </Card>
                  </div>
                  <PrimaryBtn onClick={() => selDate && selTime && setStep(3)} disabled={!selDate || !selTime}>Continue <ArrowRight size={14} /></PrimaryBtn>
                </div>
              )}

              {step === 3 && (
                <div style={{ maxWidth: 460 }}>
                  <Card style={{ padding: '1.375rem', marginBottom: '1rem' }}>
                    <h3 style={{ color: DARK, fontWeight: 700, fontSize: '1rem', margin: '0 0 1.125rem' }}>Confirm Booking</h3>

                    {/* Services list */}
                    <div style={{ background: GREEN_BG, border: `1px solid ${GREEN_BDR}`, borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                      <p style={{ color: '#166534', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.625rem' }}>{selSvcs.length} Service{selSvcs.length > 1 ? 's' : ''} Selected</p>
                      {selSvcs.map((s, i) => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: i > 0 ? '0.375rem' : 0, marginTop: i > 0 ? '0.375rem' : 0, borderTop: i > 0 ? `1px solid ${GREEN_BDR}` : 'none' }}>
                          <span style={{ color: '#166534', fontWeight: 500, fontSize: '0.875rem' }}>{s.name}</span>
                          <span style={{ color: G, fontWeight: 700, fontSize: '0.875rem' }}>₱{s.price}</span>
                        </div>
                      ))}
                    </div>

                    {/* Summary rows */}
                    {[
                      ['Total Duration', `${totalDuration} min`],
                      ['Date', selDate],
                      ['Time', selTime ? fmt12(selTime) : ''],
                      ['Barber', selBarber?.name ?? 'Any available'],
                    ].map(([l, v]) => (
                      <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: `1px solid ${BDR}` }}>
                        <span style={{ color: MID, fontSize: '0.875rem' }}>{l}</span>
                        <span style={{ color: DARK, fontWeight: 600, fontSize: '0.875rem' }}>{v}</span>
                      </div>
                    ))}

                    {/* Total */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.875rem 0 0' }}>
                      <span style={{ color: DARK, fontWeight: 700, fontSize: '1rem' }}>Total</span>
                      <span style={{ color: G, fontWeight: 800, fontSize: '1.25rem' }}>₱{totalPrice.toLocaleString()}</span>
                    </div>

                    <div style={{ marginTop: '0.875rem', padding: '0.625rem 0.75rem', background: '#FFFBEB', border: `1px solid #FDE68A`, borderRadius: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <AlertCircle size={14} color={WARN} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                      <p style={{ color: '#92400E', fontSize: '0.75rem', lineHeight: 1.5, margin: 0 }}>Status will be <strong>Pending</strong> until confirmed by the admin.</p>
                    </div>
                  </Card>
                  <button onClick={handleBook} disabled={booking} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.625rem', background: booking ? '#86EFAC' : G, color: '#fff', fontWeight: 600, fontSize: '0.9375rem', border: 'none', cursor: booking ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontFamily: 'Inter, sans-serif', boxShadow: booking ? 'none' : `0 4px 16px ${G}40` }}>
                    {booking ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> Booking…</> : <><Check size={16} /> Confirm {selSvcs.length} Service{selSvcs.length > 1 ? 's' : ''}</>}
                  </button>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}
            </motion.div>
          )}

          {/* ── APPOINTMENTS ── */}
          {nav === 'appointments' && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem' }}>
                <div>
                  <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: 0 }}>Appointments</h1>
                  <p style={{ color: MID, fontSize: '0.875rem', marginTop: '0.25rem' }}>{reservations.length} total bookings</p>
                </div>
                <PrimaryBtn onClick={() => setNav('book')}><Plus size={13} /> New Booking</PrimaryBtn>
              </div>

              <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>Upcoming</p>
              {loading ? <Skeleton /> : upcoming.length === 0
                ? <Card style={{ padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}><p style={{ color: MID, fontSize: '0.875rem' }}>No upcoming appointments</p></Card>
                : <Card style={{ marginBottom: '1.5rem' }}>
                    {upcoming.map((r, i) => (
                      <div key={r.id} style={{ padding: '0.875rem 1.125rem', borderBottom: i < upcoming.length - 1 ? `1px solid ${BDR}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>{r.service}</p>
                          <p style={{ color: MID, fontSize: '0.8rem', marginTop: '0.2rem' }}>{r.barber} · {r.date} {fmt12(r.time)} · <span style={{ color: G, fontWeight: 600 }}>₱{r.amount}</span></p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <Badge status={r.status} />
                          {r.status !== 'Cancelled' && <button onClick={() => { updateReservationStatus(r.id, 'Cancelled'); toast.success('Cancelled.'); }} style={{ width: 28, height: 28, borderRadius: '50%', background: '#FEF2F2', border: `1px solid #FECACA`, cursor: 'pointer', color: ERR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>}
                        </div>
                      </div>
                    ))}
                  </Card>
              }

              <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>Past</p>
              <Card>
                {past.length === 0
                  ? <div style={{ padding: '1.5rem', textAlign: 'center' }}><p style={{ color: MID, fontSize: '0.875rem' }}>No past appointments</p></div>
                  : past.map((r, i) => (
                      <div key={r.id} style={{ padding: '0.875rem 1.125rem', borderBottom: i < past.length - 1 ? `1px solid ${BDR}` : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: r.status === 'Completed' ? '0.625rem' : 0 }}>
                          <div>
                            <p style={{ color: DARK, fontWeight: 500, fontSize: '0.9375rem', margin: 0 }}>{r.service}</p>
                            <p style={{ color: MID, fontSize: '0.8rem', marginTop: '0.2rem' }}>{r.barber} · {r.date}</p>
                          </div>
                          <Badge status={r.status} />
                        </div>

                        {/* Star rating — only for completed, unrated or already rated */}
                        {r.status === 'Completed' && (
                          <div style={{ paddingTop: '0.5rem', borderTop: `1px solid ${BDR}` }}>
                            <StarRating
                              reservationId={r.id}
                              barberId={r.barberId}
                              existingRating={r.customerRating}
                              onRated={rating => {
                                setReservations(prev => prev.map(x =>
                                  x.id === r.id ? { ...x, customerRating: rating } : x
                                ));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))
                }
              </Card>
            </motion.div>
          )}

          {/* ── HISTORY ── */}
          {nav === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 0.375rem' }}>Loyalty & History</h1>
              <p style={{ color: MID, fontSize: '0.875rem', marginBottom: '1.75rem' }}>Your tier, preferred barber, and service timeline.</p>
              {customer ? <CustomerHistoryModule customer={customer} reservations={reservations} barbers={barbers} /> : <Skeleton />}
            </motion.div>
          )}

          {/* ── PROFILE ── */}
          {nav === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 1.75rem' }}>Profile</h1>
              <div style={{ maxWidth: 420 }}>
                <Card style={{ padding: '1.375rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingBottom: '1.125rem', marginBottom: '1.125rem', borderBottom: `1px solid ${BDR}` }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', background: GREEN_BG, border: `2px solid ${GREEN_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {customer?.photo ? <img src={customer.photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: G, fontWeight: 700, fontSize: '1.375rem' }}>{user.name.charAt(0)}</span>}
                      </div>
                      <button onClick={() => photoRef.current?.click()} disabled={uploadingPhoto} style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: G, border: `2px solid ${WHITE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingPhoto ? 'not-allowed' : 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                        {uploadingPhoto ? <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> : <Camera size={11} color="#fff" />}
                      </button>
                      <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                    </div>
                    <div>
                      <p style={{ color: DARK, fontWeight: 700, fontSize: '1.125rem', margin: 0 }}>{user.name}</p>
                      <p style={{ color: MID, fontSize: '0.875rem', marginTop: '0.125rem' }}>{user.email}</p>
                      <span style={{ display: 'inline-block', marginTop: '0.375rem', padding: '0.2rem 0.625rem', borderRadius: '999px', background: GREEN_BG, color: '#166534', fontSize: '0.6875rem', fontWeight: 600 }}>{customer?.loyaltyTier ?? 'Bronze'} Member</span>
                    </div>
                  </div>
                  {[['Total Visits', customer?.totalVisits ?? 0], ['Total Spent', `₱${(customer?.totalSpent ?? 0).toLocaleString()}`], ['Last Visit', customer?.lastVisit ?? '—'], ['Member Since', customer?.joinDate ?? '—'], ['Phone', customer?.phone || '—']].map(([l, v]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: `1px solid ${BDR}` }}>
                      <span style={{ color: MID, fontSize: '0.875rem' }}>{l}</span>
                      <span style={{ color: DARK, fontWeight: 500, fontSize: '0.875rem' }}>{v}</span>
                    </div>
                  ))}
                </Card>
                <button onClick={handleLogout} style={{ width: '100%', padding: '0.6875rem', borderRadius: '0.625rem', background: WHITE, color: ERR, fontWeight: 600, fontSize: '0.875rem', border: `1px solid #FECACA`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontFamily: 'Inter, sans-serif' }}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
