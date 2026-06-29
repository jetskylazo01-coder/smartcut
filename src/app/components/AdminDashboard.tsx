// SmartCut Admin Dashboard
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { Scissors, Users, DollarSign, Calendar, BarChart2, Star, Check, X, Plus, Search, Trash2, Clock, FileText, TrendingUp, Upload, Bell, Key, LogOut, AlertCircle, ChevronRight, UserPlus, Filter, RotateCcw, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../../lib/firebase';
import { listenAllBarbers, listenServices, listenAllReservations, listenTransactions, listenCustomers, addBarber, addService, deleteBarber, restoreBarber, updateBarber, deleteService, updateReservationStatus, completeReservation, sendNotification, listenNotifications, markNotificationRead, createBarberAuthAccount } from '../../lib/db';
import type { DBBarber, DBService, DBReservation, DBTransaction, DBCustomer, DBNotification, ReservationStatus } from '../../lib/db';
import { uploadImage } from '../../lib/cloudinary';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { fmt12 } from '../../lib/timeFormat';
import { WalkInForm } from './WalkInForm';
import { Sidebar } from './Sidebar';

interface Props { user: { uid: string; name: string; email: string }; onLogout: () => void; }
type Nav = 'overview' | 'analytics' | 'barbers' | 'services' | 'reservations' | 'walkin' | 'sales' | 'reports';

const G      = '#16A34A';
const DARK   = '#111827';
const MID    = '#6B7280';
const BG     = '#F8FAFC';
const WHITE  = '#FFFFFF';
const BDR    = '#E5E7EB';
const LITE   = '#F9FAFB';
const GREEN_BG  = '#F0FDF4';
const GREEN_BDR = '#BBF7D0';
const WARN   = '#F59E0B';
const ERR    = '#EF4444';
const BLUE   = '#3B82F6';
const SHADOW = '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)';
const DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const STATUS: Record<ReservationStatus, { color: string; bg: string; dot: string }> = {
  Pending:   { color: '#92400E', bg: '#FEF3C7', dot: WARN  },
  Confirmed: { color: '#166534', bg: '#DCFCE7', dot: G     },
  Completed: { color: '#1E40AF', bg: '#DBEAFE', dot: BLUE  },
  Cancelled: { color: '#991B1B', bg: '#FEE2E2', dot: ERR   },
};

const NAV_ITEMS = [
  { id: 'overview' as Nav,     label: 'Overview',     icon: BarChart2  },
  { id: 'analytics' as Nav,    label: 'Analytics',    icon: TrendingUp },
  { id: 'barbers' as Nav,      label: 'Barbers',      icon: Users      },
  { id: 'services' as Nav,     label: 'Services',     icon: Scissors   },
  { id: 'reservations' as Nav, label: 'Reservations', icon: Calendar   },
  { id: 'walkin' as Nav,       label: 'Walk-In',      icon: UserPlus   },
  { id: 'sales' as Nav,        label: 'Sales Log',    icon: DollarSign },
  { id: 'reports' as Nav,      label: 'Reports',      icon: FileText   },
];

const inp: React.CSSProperties = { padding: '0.5625rem 0.75rem', borderRadius: '0.5rem', border: `1px solid ${BDR}`, background: WHITE, color: DARK, fontSize: '0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' };

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: WHITE, borderRadius: '0.875rem', border: `1px solid ${BDR}`, boxShadow: SHADOW, ...style }}>{children}</div>;
}

function Badge({ status }: { status: ReservationStatus }) {
  const s = STATUS[status];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.175rem 0.5625rem', borderRadius: '999px', background: s.bg, color: s.color, fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />{status}
  </span>;
}

function KpiCard({ label, value, sub, color, icon: Icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: any }) {
  return (
    <Card style={{ padding: '1.25rem 1.375rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <p style={{ color: MID, fontSize: '0.8125rem', fontWeight: 500, margin: 0 }}>{label}</p>
        {Icon && <div style={{ width: 32, height: 32, borderRadius: '0.5rem', background: color ? `${color}15` : LITE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} color={color ?? MID} /></div>}
      </div>
      <p style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', margin: '0 0 0.25rem' }}>{value}</p>
      {sub && <p style={{ color: MID, fontSize: '0.75rem', margin: 0 }}>{sub}</p>}
    </Card>
  );
}

function PrimaryBtn({ children, onClick, disabled, small }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: small ? '0.4375rem 0.875rem' : '0.6875rem 1.25rem', borderRadius: '0.5rem', background: disabled ? '#86EFAC' : G, color: '#fff', fontWeight: 600, fontSize: small ? '0.8rem' : '0.875rem', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontFamily: 'Inter, sans-serif', boxShadow: disabled ? 'none' : `0 2px 8px ${G}40` }}>
      {children}
    </button>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {[72, 56, 56].map((h, i) => <div key={i} style={{ height: h, background: '#F3F4F6', borderRadius: '0.75rem', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}

export function AdminDashboard({ user, onLogout }: Props) {
  const [nav, setNav]                   = useState<Nav>('overview');
  const [barbers, setBarbers]           = useState<DBBarber[]>([]);
  const [services, setServices]         = useState<DBService[]>([]);
  const [reservations, setReservations] = useState<DBReservation[]>([]);
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);
  const [customers, setCustomers]       = useState<DBCustomer[]>([]);
  const [notifs, setNotifs]             = useState<DBNotification[]>([]);
  const [loading, setLoading]           = useState(true);
  const [notifOpen, setNotifOpen]       = useState(false);

  const [showBarberForm, setShowBarberForm] = useState(false);
  const [showArchived, setShowArchived]     = useState(false);
  const [expandedBarber, setExpandedBarber] = useState<string | null>(null);
  const [bName, setBName] = useState(''); const [bSpec, setBSpec] = useState('');
  const [bPhone, setBPhone] = useState(''); const [bEmail, setBEmail] = useState('');
  const [bPw, setBPw] = useState(''); const [bPhoto, setBPhoto] = useState<File | null>(null);
  const [bPreview, setBPreview] = useState(''); const [addingBarber, setAddingBarber] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const [showSvcForm, setShowSvcForm] = useState(false);
  const [sName, setSName] = useState(''); const [sPrice, setSPrice] = useState('');
  const [sDur, setSDur] = useState(''); const [sDesc, setSDesc] = useState(''); const [sCat, setSCat] = useState('Hair');
  const [search, setSearch] = useState(''); const [statusF, setStatusF] = useState<ReservationStatus | 'All'>('All');
  const [salesTypeFilter, setSalesTypeFilter] = useState<'all' | 'reservation' | 'walkin'>('all');
  const [salesBarberFilter, setSalesBarberFilter] = useState('all');

  // Core listeners — start immediately (needed by overview + reservations + sales)
  useEffect(() => {
    const u: (() => void)[] = [];
    u.push(listenAllBarbers(setBarbers));
    u.push(listenServices(setServices));
    u.push(listenAllReservations(r => { setReservations(r); setLoading(false); }));
    u.push(listenTransactions(setTransactions));
    return () => u.forEach(fn => fn());
  }, []);

  // Lazy listeners — only start when the user navigates to a tab that needs them
  useEffect(() => {
    if (nav !== 'overview' && nav !== 'reports' && nav !== 'analytics') return;
    return listenCustomers(setCustomers);
  }, [nav]);

  useEffect(() => {
    if (nav !== 'overview') return;
    return listenNotifications(null, setNotifs);
  }, [nav]);

  const handleLogout = async () => { await signOut(auth); onLogout(); };

  const handleAddBarber = async () => {
    if (!bName.trim() || !bEmail.trim()) { toast.error('Name and email required.'); return; }
    if (bPw.length < 6) { toast.error('Password must be 6+ characters.'); return; }
    setAddingBarber(true);
    try {
      let photoUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format';
      if (bPhoto) { toast.info('Uploading photo…'); photoUrl = await uploadImage(bPhoto); }
      const id = await addBarber({ name: bName.trim(), speciality: bSpec.trim() || 'General', phone: bPhone.trim(), email: bEmail.trim().toLowerCase(), photo: photoUrl, rating: 0, reviews: 0, available: true, joinDate: new Date().toISOString().split('T')[0], completedToday: 0, totalCompleted: 0, availableSlots: ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'] });
      await createBarberAuthAccount(bEmail.trim().toLowerCase(), bPw, id, bName.trim());
      toast.success(`${bName} added successfully.`);
      setBName(''); setBSpec(''); setBPhone(''); setBEmail(''); setBPw(''); setBPhoto(null); setBPreview(''); setShowBarberForm(false);
    } catch (e: any) { toast.error(e.message); }
    setAddingBarber(false);
  };

  const handleAddSvc = async () => {
    if (!sName.trim() || !sPrice) { toast.error('Name and price required.'); return; }
    await addService({ name: sName.trim(), description: sDesc.trim(), category: sCat, price: parseFloat(sPrice), duration: parseInt(sDur) || 30, isActive: true });
    toast.success('Service added.'); setSName(''); setSPrice(''); setSDur(''); setSDesc(''); setSCat('Hair'); setShowSvcForm(false);
  };

  const handleStatus = async (id: string, status: ReservationStatus, customerId?: string) => {
    await updateReservationStatus(id, status);
    if (status === 'Confirmed' && customerId) {
      const r = reservations.find(x => x.id === id);
      if (r) await sendNotification({ customerId, type: 'confirmation', title: 'Booking Confirmed', message: `Your ${r.service} with ${r.barber} on ${r.date} at ${fmt12(r.time)} is confirmed.`, isRead: false, sentAt: new Date().toISOString(), reservationId: id });
    }
    toast.success(`Reservation ${status.toLowerCase()}.`);
  };

  /**
   * Complete a reservation — uses the unified completeReservation() which:
   * 1. Marks reservation as Completed in Firestore
   * 2. Auto-creates a transaction record (idempotent — won't duplicate)
   * 3. Updates customer loyalty stats
   * Everything flows to analytics automatically via real-time listeners.
   */
  const handleCompleteReservation = async (r: DBReservation) => {
    try {
      await completeReservation(r.id, 'Cash');
      // Also send notification to customer
      await sendNotification({
        customerId: r.customerId,
        type: 'confirmation',
        title: 'Service Completed',
        message: `Your ${r.service} appointment with ${r.barber} has been completed. Thank you for visiting!`,
        isRead: false,
        sentAt: new Date().toISOString(),
        reservationId: r.id,
      });
      toast.success('Appointment completed. Transaction and analytics updated.');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to complete reservation.');
    }
  };

  const unread  = useMemo(() => notifs.filter(n => !n.isRead).length, [notifs]);
  const pending = useMemo(() => reservations.filter(r => r.status === 'Pending'), [reservations]);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayRev = useMemo(() => transactions.filter(t => t.date === todayStr).reduce((s, t) => s + (t.amount ?? 0), 0), [transactions, todayStr]);
  const totalRev = useMemo(() => transactions.reduce((s, t) => s + (t.amount ?? 0), 0), [transactions]);
  const filteredRes = useMemo(() => reservations.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.customer.toLowerCase().includes(q) || r.barber.toLowerCase().includes(q) || r.service.toLowerCase().includes(q)) && (statusF === 'All' || r.status === statusF);
  }), [reservations, search, statusF]);

  const salesByDay = useMemo(() => {
    const map: Record<string, number> = {};
    DAYS.forEach(d => { map[d] = 0; });
    transactions.forEach(t => { if (!t.date) return; const d = new Date(t.date); const k = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]; map[k] += (t.amount ?? 0); });
    return DAYS.map(day => ({ day, revenue: map[day] }));
  }, [transactions]);

  const salesBySvc = useMemo(() => {
    const colors = [G, '#22C55E', BLUE, WARN, ERR];
    const map: Record<string, number> = {};
    transactions.forEach(t => { if (t.service) map[t.service] = (map[t.service] || 0) + (t.amount ?? 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value], i) => ({ name, value, color: colors[i] }));
  }, [transactions]);

  // ── Sales Log data — memoized for performance ──────────────────────────────
  const salesData = useMemo(() => {
    // Step 1: Collect all reservation IDs that already have a recorded transaction
    const txnResIds = new Set<string>();
    transactions.forEach(t => {
      if (t.reservationId && t.reservationId !== '') txnResIds.add(t.reservationId);
    });

    // Step 2: Completed reservations that have NO recorded transaction yet
    const completedResWithoutTxn = reservations.filter(
      r => r.status === 'Completed' && r.id && !txnResIds.has(r.id)
    );

    // Step 3: Build display-safe virtual entries for those reservations
    const syntheticEntries = completedResWithoutTxn.map(r => {
      const serviceLabel = (r.services && r.services.length > 0)
        ? r.services.map(s => s.name).join(' + ')
        : (r.service || '');
      return {
        id:            `res-${r.id}`,
        type:          'reservation' as const,
        reservationId: r.id,
        customer:      r.customer || '',
        customerPhone: '',
        barber:        r.barber || '',
        barberId:      r.barberId || '',
        service:       serviceLabel,
        services:      r.services || [],
        amount:        r.amount || 0,
        date:          r.date || '',
        time:          r.time || '',
        paymentMethod: '(Pending Record)',
        completedAt:   r.updatedAt || r.date || '',
        notes:         '',
      };
    });

    // Step 4: Normalise real transactions to ensure no undefined fields crash the render
    const normalisedTxns = transactions.map(t => ({
      ...t,
      customer:      t.customer      || '',
      barber:        t.barber        || '',
      service:       t.service       || '',
      amount:        t.amount        || 0,
      date:          t.date          || '',
      time:          t.time          || '',
      paymentMethod: t.paymentMethod || '—',
      type:          t.type          || 'reservation',
    }));

    // Step 5: Merge and sort newest-first by SERVICE DATE + TIME
    // (i.e. when the customer was actually served, not when admin clicked Complete).
    // completedAt reflects when the admin processed the record — useless for ordering
    // because a July appointment completed today would get a June timestamp.
    const toMs = (entry: any): number => {
      const date: string = entry.date || '';
      if (!date) return 0;
      // Extract HH:mm safely — handles "14:30", "14:30:00", missing
      const timeMatch = typeof entry.time === 'string' ? entry.time.match(/^(\d{1,2}):(\d{2})/) : null;
      const timePart  = timeMatch
        ? `T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00Z`
        : 'T00:00:00Z';
      const ms = Date.parse(date + timePart);
      return isNaN(ms) ? 0 : ms;
    };
    const merged = [...normalisedTxns, ...syntheticEntries].sort((a, b) => toMs(b) - toMs(a));

    const walkinRev   = merged.filter(t => t.type === 'walkin').reduce((s, t) => s + (t.amount || 0), 0);
    const reservedRev = merged.filter(t => t.type !== 'walkin').reduce((s, t) => s + (t.amount || 0), 0);

    return { merged, walkinRev, reservedRev, totalCount: merged.length };
  }, [transactions, reservations]);

  const filteredSalesEntries = useMemo(() => {
    return salesData.merged.filter(t => {
      const typeOk   = salesTypeFilter === 'all'
        || (salesTypeFilter === 'walkin' ? t.type === 'walkin' : t.type !== 'walkin');
      const barberOk = salesBarberFilter === 'all' || t.barber === salesBarberFilter;
      return typeOk && barberOk;
    });
  }, [salesData.merged, salesTypeFilter, salesBarberFilter]);

  const navWithBadge = NAV_ITEMS.map(n => n.id === 'reservations' ? { ...n, badge: pending.length } : n);

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar nav={nav} setNav={setNav} items={navWithBadge} userName={user.name} userRole="Administrator" onLogout={handleLogout} />

      <main style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
        {/* Notification bell */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', position: 'relative' }}>
          <button onClick={() => setNotifOpen(o => !o)} style={{ position: 'relative', width: 36, height: 36, borderRadius: '0.5rem', background: WHITE, border: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: SHADOW }}>
            <Bell size={15} color={notifOpen ? G : MID} />
            {unread > 0 && <span style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: '50%', background: ERR, border: `2px solid ${WHITE}` }} />}
          </button>
          {notifOpen && (
            <>
              <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{ position: 'absolute', top: '110%', right: 0, width: 320, maxHeight: 400, background: WHITE, border: `1px solid ${BDR}`, borderRadius: '0.875rem', zIndex: 50, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${BDR}` }}>
                  <span style={{ color: DARK, fontWeight: 600, fontSize: '0.875rem' }}>Notifications {unread > 0 && <span style={{ marginLeft: '0.375rem', background: ERR, color: '#fff', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.375rem' }}>{unread}</span>}</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {notifs.length === 0 ? <p style={{ color: MID, padding: '1.25rem', textAlign: 'center', fontSize: '0.8125rem' }}>No notifications</p>
                    : notifs.map(n => (
                        <div key={n.id} onClick={() => markNotificationRead(n.id)} style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${BDR}`, cursor: 'pointer', background: n.isRead ? WHITE : GREEN_BG, borderLeft: n.isRead ? '3px solid transparent' : `3px solid ${G}` }}>
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

          {/* OVERVIEW */}
          {nav === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <p style={{ color: MID, fontSize: '0.875rem', margin: '0 0 0.25rem' }}>{new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.02em', margin: '0 0 1.75rem' }}>Dashboard</h1>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <KpiCard label="Today's Revenue" value={`₱${todayRev.toLocaleString()}`} sub="from today's sales" color={G} icon={DollarSign} />
                <KpiCard label="Customers" value={customers.length} sub="registered" color={BLUE} icon={Users} />
                <KpiCard label="Pending" value={pending.length} sub="awaiting approval" color={WARN} icon={Clock} />
                <KpiCard label="Completed Today" value={reservations.filter(r => r.status === 'Completed' && r.date === todayStr).length} sub="appointments" color={G} icon={Check} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Card style={{ padding: '1.375rem' }}>
                  <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1.375rem' }}>Revenue by Day of Week</p>
                  {totalRev === 0
                    ? <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: MID, fontSize: '0.875rem' }}>No sales recorded yet</p></div>
                    : (() => {
                        const maxRev = Math.max(...salesByDay.map(d => d.revenue), 1);
                        return (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 120 }}>
                            {salesByDay.map(d => (
                              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: '100%', justifyContent: 'flex-end' }}>
                                {d.revenue > 0 && <span style={{ color: MID, fontSize: '0.55rem', fontFamily: 'DM Mono, monospace' }}>{d.revenue >= 1000 ? `${(d.revenue/1000).toFixed(1)}k` : d.revenue}</span>}
                                <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: d.revenue > 0 ? G : '#E5E7EB', height: `${Math.max((d.revenue / maxRev) * 95, d.revenue > 0 ? 4 : 0)}px`, transition: 'height 0.3s' }} />
                                <span style={{ color: MID, fontSize: '0.6875rem', fontWeight: 500 }}>{d.day}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                  }
                </Card>

                <Card style={{ padding: '1.375rem' }}>
                  <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1rem' }}>By Service</p>
                  {salesBySvc.length === 0 ? <p style={{ color: MID, fontSize: '0.875rem' }}>No sales yet</p> : (() => {
                    const total = salesBySvc.reduce((s, x) => s + x.value, 0) || 1;
                    return (
                      <div>
                        <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: '1rem' }}>
                          {salesBySvc.map(s => <div key={s.name} style={{ background: s.color, width: `${(s.value / total) * 100}%`, minWidth: 3 }} />)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {salesBySvc.map(s => (
                            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                              <span style={{ color: MID, fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                              <span style={{ color: DARK, fontSize: '0.75rem', fontWeight: 600 }}>₱{s.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              </div>

              {barbers.filter(b => !b.isDeleted).length > 0 && (
                <Card style={{ padding: '1.375rem' }}>
                  <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1.125rem' }}>Barber Team Performance</p>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(barbers.filter(b => !b.isDeleted).length, 4)}, 1fr)`, gap: '0.75rem' }}>
                    {barbers.filter(b => !b.isDeleted).map(b => {
                      const barberRes  = reservations.filter(r => r.barberId === b.id && r.status === 'Completed');
                      const ratedRes   = barberRes.filter(r => r.customerRating && r.customerRating > 0);
                      const liveRating = ratedRes.length > 0
                        ? (ratedRes.reduce((s, r) => s + (r.customerRating ?? 0), 0) / ratedRes.length)
                        : b.rating;
                      const liveReviews = ratedRes.length > 0 ? ratedRes.length : b.reviews;
                      const todayC = barberRes.filter(r => r.date === todayStr).length;
                      return (
                        <div key={b.id} style={{ textAlign: 'center', padding: '1rem 0.875rem', borderRadius: '0.75rem', background: LITE, border: `1px solid ${BDR}`, position: 'relative' }}>
                          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.625rem' }}>
                            <img src={b.photo} alt={b.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', display: 'block', border: `2px solid ${BDR}` }} />
                            <span style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', background: b.available ? G : '#9CA3AF', border: '2px solid #F9FAFB' }} />
                          </div>
                          <p style={{ color: DARK, fontWeight: 700, fontSize: '0.875rem', margin: '0 0 0.125rem' }}>{b.name.split(' ')[0]}</p>
                          <p style={{ color: MID, fontSize: '0.7rem', margin: '0 0 0.5rem' }}>{b.speciality}</p>
                          {/* Stars */}
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '1px', marginBottom: '0.2rem' }}>
                            {[1,2,3,4,5].map(i => <Star key={i} size={12} fill={i <= Math.round(liveRating) ? '#F59E0B' : 'transparent'} color={i <= Math.round(liveRating) ? '#F59E0B' : '#D1D5DB'} />)}
                          </div>
                          <p style={{ color: '#92400E', fontWeight: 700, fontSize: '0.875rem', margin: '0 0 0.125rem' }}>{liveRating > 0 ? liveRating.toFixed(1) : '—'}</p>
                          <p style={{ color: MID, fontSize: '0.65rem', margin: '0 0 0.5rem' }}>{liveReviews} review{liveReviews !== 1 ? 's' : ''}</p>
                          <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                            <span style={{ padding: '0.125rem 0.5rem', borderRadius: '999px', background: '#F0FDF4', color: '#166534', fontSize: '0.6rem', fontWeight: 700 }}>{todayC} today</span>
                            <span style={{ padding: '0.125rem 0.5rem', borderRadius: '999px', background: LITE, color: MID, fontSize: '0.6rem', fontWeight: 600 }}>{b.totalCompleted} total</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {/* ANALYTICS */}
          {nav === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 0.375rem' }}>Analytics</h1>
              <p style={{ color: MID, fontSize: '0.875rem', margin: '0 0 1.75rem' }}>Live insights computed from your Firestore data.</p>
              <AnalyticsDashboard barbers={barbers} reservations={reservations} transactions={transactions} customers={customers} />
            </motion.div>
          )}

          {/* BARBERS */}
          {nav === 'barbers' && (
            <motion.div key="barbers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem' }}>
                <div>
                  <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: 0 }}>Barbers</h1>
                  <p style={{ color: MID, fontSize: '0.875rem', marginTop: '0.25rem' }}>{barbers.filter(b => !b.isDeleted).length} active{barbers.filter(b => b.isDeleted).length > 0 ? ` · ${barbers.filter(b => b.isDeleted).length} archived` : ''}</p>
                </div>
                <PrimaryBtn onClick={() => setShowBarberForm(v => !v)}><Plus size={14} /> Add Barber</PrimaryBtn>
              </div>

              {showBarberForm && (
                <Card style={{ padding: '1.375rem', marginBottom: '1.25rem', border: `1px solid ${GREEN_BDR}`, background: '#FAFFFE' }}>
                  <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 0.25rem' }}>New Barber Account</h3>
                  <p style={{ color: MID, fontSize: '0.8125rem', margin: '0 0 1.25rem' }}>A Firebase Auth login will be created so the barber can sign in.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.125rem' }}>
                    <div onClick={() => photoRef.current?.click()} style={{ width: 56, height: 56, borderRadius: '50%', background: bPreview ? 'transparent' : LITE, border: `1.5px dashed ${GREEN_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                      {bPreview ? <img src={bPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Upload size={18} color={MID} />}
                    </div>
                    <div><p style={{ color: DARK, fontWeight: 500, fontSize: '0.875rem', margin: 0 }}>Profile Photo</p><p style={{ color: MID, fontSize: '0.75rem', marginTop: '0.125rem' }}>Uploaded to Cloudinary · Click circle to select</p></div>
                    <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setBPhoto(f); setBPreview(URL.createObjectURL(f)); } }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
                    {[['Full Name *', bName, setBName, 'text', 'Juan Santos'], ['Speciality', bSpec, setBSpec, 'text', 'Fade & Taper'], ['Email *', bEmail, setBEmail, 'email', 'barber@studio.ph'], ['Phone', bPhone, setBPhone, 'tel', '09XXXXXXXXX']].map(([l, v, s, t, p]) => (
                      <div key={l as string}>
                        <label style={{ display: 'block', color: DARK, fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.3rem', fontFamily: 'Inter, sans-serif' }}>{l as string}</label>
                        <input style={inp} type={t as string} value={v as string} onChange={e => (s as (v: string) => void)(e.target.value)} placeholder={p as string} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: '1.125rem' }}>
                    <label style={{ display: 'block', color: DARK, fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.3rem', fontFamily: 'Inter, sans-serif' }}>Initial Password * (6+ characters)</label>
                    <input style={inp} type="password" value={bPw} onChange={e => setBPw(e.target.value)} placeholder="Secure password for barber's login" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <PrimaryBtn onClick={handleAddBarber} disabled={addingBarber}>{addingBarber ? 'Creating…' : 'Create Barber'}</PrimaryBtn>
                    <button onClick={() => setShowBarberForm(false)} style={{ padding: '0.6875rem 1.125rem', borderRadius: '0.5rem', background: WHITE, color: MID, fontWeight: 500, fontSize: '0.875rem', border: `1px solid ${BDR}`, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                  </div>
                </Card>
              )}

              {loading ? <Skeleton /> : (() => {
                const activeBarbers   = barbers.filter(b => !b.isDeleted);
                const archivedBarbers = barbers.filter(b => b.isDeleted);
                return (
                  <>
                    {/* Active list */}
                    {activeBarbers.length === 0
                      ? <Card style={{ padding: '3rem', textAlign: 'center', marginBottom: '1rem' }}>
                          <p style={{ color: MID }}>No active barbers. Add one above.</p>
                        </Card>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                          {activeBarbers.map(b => {
                            const isExpanded = expandedBarber === b.id;
                            // Per-barber stats from real data
                            const barberRes  = reservations.filter(r => r.barberId === b.id && r.status === 'Completed');
                            const barberTxns = transactions.filter(t => t.barber === b.name || t.barberId === b.id);
                            const barberRev  = barberTxns.reduce((s, t) => s + t.amount, 0);
                            const todayCount = barberRes.filter(r => r.date === todayStr).length
                                            + transactions.filter(t => (t.barber === b.name || t.barberId === b.id) && t.type === 'walkin' && t.date === todayStr).length;
                            // Ratings data
                            const ratedRes   = barberRes.filter(r => r.customerRating && r.customerRating > 0);
                            const avgRating  = ratedRes.length > 0
                              ? (ratedRes.reduce((s, r) => s + (r.customerRating ?? 0), 0) / ratedRes.length)
                              : b.rating;
                            const reviewCount = ratedRes.length > 0 ? ratedRes.length : b.reviews;

                            return (
                              <Card key={b.id} style={{ overflow: 'hidden' }}>
                                {/* Main row */}
                                <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                  <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <img src={b.photo} alt={b.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${BDR}` }} />
                                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: '50%', background: b.available ? G : '#9CA3AF', border: '2px solid #fff' }} title={b.available ? 'Available' : 'Off today'} />
                                  </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                                      <p style={{ color: DARK, fontWeight: 700, fontSize: '1rem', margin: 0 }}>{b.name}</p>
                                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: b.available ? GREEN_BG : '#F9FAFB', color: b.available ? '#166534' : MID, fontSize: '0.6875rem', fontWeight: 600, border: `1px solid ${b.available ? GREEN_BDR : BDR}` }}>
                                        {b.available ? 'Available' : 'Off Today'}
                                      </span>
                                    </div>
                                    <p style={{ color: MID, fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>{b.speciality}</p>

                                    {/* Rating stars */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                      <div style={{ display: 'flex', gap: '1px' }}>
                                        {[1,2,3,4,5].map(i => (
                                          <Star key={i} size={13} fill={i <= Math.round(avgRating) ? '#F59E0B' : 'transparent'} color={i <= Math.round(avgRating) ? '#F59E0B' : '#D1D5DB'} />
                                        ))}
                                      </div>
                                      <span style={{ color: '#92400E', fontWeight: 700, fontSize: '0.8125rem' }}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
                                      <span style={{ color: MID, fontSize: '0.75rem' }}>({reviewCount} review{reviewCount !== 1 ? 's' : ''})</span>
                                      <span style={{ color: '#D1D5DB', fontSize: '0.75rem' }}>·</span>
                                      <span style={{ color: MID, fontSize: '0.75rem' }}>{b.totalCompleted.toLocaleString()} cuts total</span>
                                    </div>
                                  </div>

                                  {/* Quick stats */}
                                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                                    <div style={{ textAlign: 'center', padding: '0.375rem 0.75rem', background: LITE, borderRadius: '0.5rem', border: `1px solid ${BDR}` }}>
                                      <p style={{ color: G, fontWeight: 700, fontSize: '1.125rem', margin: 0 }}>{todayCount}</p>
                                      <p style={{ color: MID, fontSize: '0.625rem', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Today</p>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '0.375rem 0.75rem', background: '#F0FDF4', borderRadius: '0.5rem', border: `1px solid ${GREEN_BDR}` }}>
                                      <p style={{ color: G, fontWeight: 700, fontSize: '1.125rem', margin: 0 }}>₱{barberRev >= 1000 ? `${(barberRev/1000).toFixed(1)}k` : barberRev}</p>
                                      <p style={{ color: MID, fontSize: '0.625rem', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenue</p>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                                    <button
                                      onClick={() => setExpandedBarber(isExpanded ? null : b.id)}
                                      title={isExpanded ? 'Collapse' : 'View details'}
                                      style={{ height: 32, padding: '0 0.625rem', borderRadius: '0.5rem', background: isExpanded ? GREEN_BG : LITE, border: `1px solid ${isExpanded ? GREEN_BDR : BDR}`, cursor: 'pointer', color: isExpanded ? '#166534' : MID, fontSize: '0.75rem', fontWeight: 500, fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      {isExpanded ? 'Less' : 'Details'}
                                    </button>
                                    <button
                                      onClick={async () => { await updateBarber(b.id, { available: !b.available }); toast.success(`${b.name} marked as ${b.available ? 'off' : 'available'}.`); }}
                                      title={b.available ? 'Mark as off' : 'Mark as available'}
                                      style={{ height: 32, padding: '0 0.625rem', borderRadius: '0.5rem', background: LITE, border: `1px solid ${BDR}`, cursor: 'pointer', color: MID, fontSize: '0.75rem', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                                      {b.available ? 'Set Off' : 'Set On'}
                                    </button>
                                    <button
                                      onClick={() => { deleteBarber(b.id); toast.success(`${b.name} archived.`); if (expandedBarber === b.id) setExpandedBarber(null); }}
                                      title="Archive barber"
                                      style={{ width: 32, height: 32, borderRadius: '0.5rem', background: '#FEF2F2', border: `1px solid #FECACA`, cursor: 'pointer', color: ERR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded detail panel */}
                                {isExpanded && (
                                  <div style={{ borderTop: `1px solid ${BDR}`, padding: '1rem 1.25rem', background: LITE }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                                      {[
                                        { label: 'Phone',         value: b.phone || '—' },
                                        { label: 'Email',         value: b.email },
                                        { label: 'Joined',        value: b.joinDate },
                                        { label: 'Slots Open',    value: `${b.availableSlots?.length ?? 0} of 14` },
                                      ].map(s => (
                                        <div key={s.label} style={{ padding: '0.625rem 0.75rem', background: '#fff', borderRadius: '0.5rem', border: `1px solid ${BDR}` }}>
                                          <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 500, margin: '0 0 0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                                          <p style={{ color: DARK, fontWeight: 600, fontSize: '0.8125rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</p>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Rating breakdown */}
                                    <div style={{ padding: '0.875rem 1rem', background: '#fff', borderRadius: '0.5rem', border: `1px solid ${BDR}`, marginBottom: '0.75rem' }}>
                                      <p style={{ color: DARK, fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <Star size={14} fill="#F59E0B" color="#F59E0B" /> Customer Ratings
                                      </p>
                                      {ratedRes.length === 0
                                        ? <p style={{ color: MID, fontSize: '0.8125rem' }}>No ratings yet from customers.</p>
                                        : (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            <div style={{ textAlign: 'center' }}>
                                              <p style={{ color: '#92400E', fontWeight: 800, fontSize: '2rem', margin: 0 }}>{avgRating.toFixed(1)}</p>
                                              <div style={{ display: 'flex', gap: '1px', justifyContent: 'center', margin: '0.25rem 0' }}>
                                                {[1,2,3,4,5].map(i => <Star key={i} size={14} fill={i <= Math.round(avgRating) ? '#F59E0B' : 'transparent'} color={i <= Math.round(avgRating) ? '#F59E0B' : '#D1D5DB'} />)}
                                              </div>
                                              <p style={{ color: MID, fontSize: '0.75rem', margin: 0 }}>{ratedRes.length} review{ratedRes.length !== 1 ? 's' : ''}</p>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                              {[5,4,3,2,1].map(star => {
                                                const cnt = ratedRes.filter(r => r.customerRating === star).length;
                                                const pct = ratedRes.length > 0 ? (cnt / ratedRes.length) * 100 : 0;
                                                return (
                                                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                                    <span style={{ color: MID, fontSize: '0.7rem', fontWeight: 500, width: 8 }}>{star}</span>
                                                    <Star size={10} fill="#F59E0B" color="#F59E0B" />
                                                    <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                                      <div style={{ height: '100%', width: `${pct}%`, background: '#F59E0B', borderRadius: 3 }} />
                                                    </div>
                                                    <span style={{ color: MID, fontSize: '0.7rem', width: 20, textAlign: 'right' }}>{cnt}</span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )
                                      }
                                    </div>

                                    {/* Recent appointments for this barber */}
                                    {barberRes.length > 0 && (
                                      <div>
                                        <p style={{ color: DARK, fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.5rem' }}>Recent Completed Appointments</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                          {barberRes.slice(0, 5).map(r => (
                                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#fff', borderRadius: '0.5rem', border: `1px solid ${BDR}` }}>
                                              <div>
                                                <p style={{ color: DARK, fontWeight: 500, fontSize: '0.8125rem', margin: 0 }}>{r.customer}</p>
                                                <p style={{ color: MID, fontSize: '0.75rem', margin: '0.1rem 0 0' }}>{r.service} · {r.date}</p>
                                              </div>
                                              <div style={{ textAlign: 'right' }}>
                                                <p style={{ color: G, fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>₱{r.amount}</p>
                                                {r.customerRating && (
                                                  <div style={{ display: 'flex', gap: '1px', justifyContent: 'flex-end', marginTop: '0.125rem' }}>
                                                    {[1,2,3,4,5].map(i => <Star key={i} size={10} fill={i <= r.customerRating! ? '#F59E0B' : 'transparent'} color={i <= r.customerRating! ? '#F59E0B' : '#D1D5DB'} />)}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                    }

                    {/* Archived barbers */}
                    {archivedBarbers.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowArchived(v => !v)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', background: '#FEF2F2', border: `1px solid #FECACA`, cursor: 'pointer', color: '#991B1B', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', marginBottom: '0.75rem' }}>
                          <RotateCcw size={14} />
                          Archived Barbers ({archivedBarbers.length})
                          <ChevronDown size={14} style={{ marginLeft: 'auto', transform: showArchived ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        {showArchived && (
                          <Card style={{ border: `1px solid #FECACA`, background: '#FFFAFA' }}>
                            {archivedBarbers.map((b, i) => (
                              <div key={b.id} style={{ padding: '1rem 1.25rem', borderBottom: i < archivedBarbers.length - 1 ? `1px solid #FECACA` : 'none', display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                                <img src={b.photo} alt={b.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2px solid #FECACA`, flexShrink: 0, filter: 'grayscale(0.5)' }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.2rem' }}>
                                    <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>{b.name}</p>
                                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.6875rem', fontWeight: 600 }}>Archived</span>
                                  </div>
                                  <p style={{ color: MID, fontSize: '0.8125rem', margin: 0 }}>{b.speciality} · {b.email}</p>
                                  {b.deletedAt && <p style={{ color: '#9CA3AF', fontSize: '0.7rem', margin: '0.125rem 0 0' }}>Archived {new Date(b.deletedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                                </div>
                                <button
                                  onClick={async () => { await restoreBarber(b.id); toast.success(`${b.name} restored and is now active.`); }}
                                  title="Restore barber"
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4375rem 0.875rem', borderRadius: '0.5rem', background: GREEN_BG, border: `1px solid ${GREEN_BDR}`, cursor: 'pointer', color: '#166534', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                  <RotateCcw size={13} /> Restore
                                </button>
                              </div>
                            ))}
                          </Card>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          )}

          {/* SERVICES */}
          {nav === 'services' && (
            <motion.div key="services" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem' }}>
                <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: 0 }}>Services</h1>
                <PrimaryBtn onClick={() => setShowSvcForm(v => !v)}><Plus size={14} /> Add Service</PrimaryBtn>
              </div>

              {showSvcForm && (
                <Card style={{ padding: '1.375rem', marginBottom: '1.25rem', border: `1px solid ${GREEN_BDR}`, background: '#FAFFFE' }}>
                  <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1rem' }}>New Service</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
                    {[['Name *', sName, setSName, 'text', 'e.g. Kapogi Package'], ['Price ₱ *', sPrice, setSPrice, 'number', '350'], ['Duration (min)', sDur, setSDur, 'number', '90']].map(([l, v, s, t, p]) => (
                      <div key={l as string}>
                        <label style={{ display: 'block', color: DARK, fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.3rem', fontFamily: 'Inter, sans-serif' }}>{l as string}</label>
                        <input style={inp} type={t as string} value={v as string} onChange={e => (s as any)(e.target.value)} placeholder={p as string} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1.125rem' }}>
                    <div>
                      <label style={{ display: 'block', color: DARK, fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.3rem', fontFamily: 'Inter, sans-serif' }}>Category</label>
                      <select style={{ ...inp, cursor: 'pointer' }} value={sCat} onChange={e => setSCat(e.target.value)}>{['Hair','Beard','Package','Facial','Other'].map(c => <option key={c}>{c}</option>)}</select>
                    </div>
                    <div>
                      <label style={{ display: 'block', color: DARK, fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.3rem', fontFamily: 'Inter, sans-serif' }}>Description</label>
                      <input style={inp} value={sDesc} onChange={e => setSDesc(e.target.value)} placeholder="Brief description" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <PrimaryBtn onClick={handleAddSvc}>Save Service</PrimaryBtn>
                    <button onClick={() => setShowSvcForm(false)} style={{ padding: '0.6875rem 1.125rem', borderRadius: '0.5rem', background: WHITE, color: MID, fontWeight: 500, fontSize: '0.875rem', border: `1px solid ${BDR}`, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                  </div>
                </Card>
              )}

              {(() => {
                const daily = services.filter(s => s.category !== 'Other');
                const others = services.filter(s => s.category === 'Other');
                const Row = ({ s }: { s: typeof services[0] }) => (
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1px solid ${BDR}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>{s.name}</p>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: LITE, color: MID, fontSize: '0.6875rem', fontWeight: 500, border: `1px solid ${BDR}` }}>{s.category}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <span style={{ color: G, fontWeight: 700, fontSize: '0.9375rem' }}>₱{s.price}</span>
                        <span style={{ color: MID, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={12} />{s.duration} min</span>
                      </div>
                    </div>
                    <button onClick={() => { deleteService(s.id); toast.success('Removed.'); }} style={{ width: 32, height: 32, borderRadius: '0.5rem', background: '#FEF2F2', border: `1px solid #FECACA`, cursor: 'pointer', color: ERR, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '0.75rem' }}><Trash2 size={14} /></button>
                  </div>
                );
                if (loading) return <Skeleton />;
                if (services.length === 0) return <Card style={{ padding: '3rem', textAlign: 'center' }}><p style={{ color: MID }}>No services yet.</p></Card>;
                return (
                  <div>
                    {daily.length > 0 && <><p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.625rem' }}>Daily Services</p><Card style={{ marginBottom: '1rem', overflow: 'hidden' }}>{daily.map(s => <Row key={s.id} s={s} />)}</Card></>}
                    {others.length > 0 && <><p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.625rem' }}>Other Services</p><Card style={{ overflow: 'hidden' }}>{others.map(s => <Row key={s.id} s={s} />)}</Card></>}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* RESERVATIONS */}
          {nav === 'reservations' && (
            <motion.div key="reservations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 1.75rem' }}>Reservations</h1>
              <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1.25rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={14} color={MID} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input style={{ ...inp, paddingLeft: '2.25rem' }} placeholder="Search customer, barber, service…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select value={statusF} onChange={e => setStatusF(e.target.value as any)} style={{ ...inp, width: 'auto', paddingRight: '2rem', cursor: 'pointer' }}>
                  {['All','Pending','Confirmed','Completed','Cancelled'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              {loading ? <Skeleton /> : filteredRes.length === 0
                ? <Card style={{ padding: '2.5rem', textAlign: 'center' }}><p style={{ color: MID }}>No reservations found.</p></Card>
                : <Card style={{ overflow: 'hidden' }}>
                    {filteredRes.map((r, i) => (
                      <div key={r.id} style={{ padding: '0.875rem 1.25rem', borderBottom: i < filteredRes.length - 1 ? `1px solid ${BDR}` : 'none', display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                        <div style={{ width: 4, height: 40, borderRadius: 2, background: STATUS[r.status].dot, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>{r.customer} <span style={{ color: MID, fontWeight: 400, fontSize: '0.875rem' }}>→ {r.service}</span></p>
                          <p style={{ color: MID, fontSize: '0.8rem', marginTop: '0.2rem' }}>{r.barber} · {r.date} {fmt12(r.time)} · <span style={{ color: G, fontWeight: 700 }}>₱{r.amount}</span></p>
                        </div>
                        <Badge status={r.status} />
                        {r.status === 'Pending' && (
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <PrimaryBtn onClick={() => handleStatus(r.id, 'Confirmed', r.customerId)} small><Check size={12} /> Confirm</PrimaryBtn>
                            <button onClick={() => handleStatus(r.id, 'Cancelled')} style={{ width: 30, height: 30, borderRadius: '0.5rem', background: '#FEF2F2', border: `1px solid #FECACA`, cursor: 'pointer', color: ERR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
                          </div>
                        )}
                        {r.status === 'Confirmed' && (
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button onClick={() => handleCompleteReservation(r)} style={{ padding: '0.4375rem 0.75rem', borderRadius: '0.375rem', background: '#EFF6FF', border: `1px solid #BFDBFE`, color: '#1E40AF', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontFamily: 'Inter, sans-serif' }}><Check size={12} /> Complete</button>
                            <button onClick={() => handleStatus(r.id, 'Cancelled')} style={{ width: 30, height: 30, borderRadius: '0.5rem', background: '#FEF2F2', border: `1px solid #FECACA`, cursor: 'pointer', color: ERR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </Card>
              }
            </motion.div>
          )}

          {/* WALK-IN */}
          {nav === 'walkin' && (
            <motion.div key="walkin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 0.375rem' }}>Walk-In Customer</h1>
              <p style={{ color: MID, fontSize: '0.875rem', margin: '0 0 1.75rem' }}>Record services for customers who arrived without a reservation.</p>
              <WalkInForm barbers={barbers} services={services} onSuccess={() => toast.success('Walk-in recorded.')} />
            </motion.div>
          )}

          {/* SALES */}
          {nav === 'sales' && (
            <motion.div key="sales" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 1.5rem' }}>Sales Log</h1>

              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <KpiCard label="Total Revenue"       value={`₱${(salesData.reservedRev + salesData.walkinRev).toLocaleString()}`} color={G}        icon={DollarSign} />
                <KpiCard label="Reservation Revenue" value={`₱${salesData.reservedRev.toLocaleString()}`}                          color={BLUE}      icon={Calendar}   />
                <KpiCard label="Walk-In Revenue"     value={`₱${salesData.walkinRev.toLocaleString()}`}                            color={'#8B5CF6'} icon={UserPlus}   />
                <KpiCard label="Total Records"       value={salesData.totalCount}                                                   color={G}         icon={FileText}   />
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {(['all','reservation','walkin'] as const).map(f => (
                  <button key={f} onClick={() => setSalesTypeFilter(f)}
                    style={{ padding: '0.4375rem 1rem', borderRadius: '999px', border: `1.5px solid ${salesTypeFilter === f ? G : BDR}`, background: salesTypeFilter === f ? GREEN_BG : WHITE, color: salesTypeFilter === f ? '#166534' : MID, fontWeight: salesTypeFilter === f ? 700 : 400, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
                    {f === 'all' ? 'All' : f === 'reservation' ? 'Reservations' : 'Walk-Ins'}
                  </button>
                ))}
                <select value={salesBarberFilter} onChange={e => setSalesBarberFilter(e.target.value)}
                  style={{ padding: '0.4375rem 0.75rem', borderRadius: '0.5rem', border: `1px solid ${BDR}`, background: WHITE, color: DARK, fontSize: '0.8125rem', outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  <option value="all">All Barbers</option>
                  {barbers.filter(b => !b.isDeleted).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
                <span style={{ color: MID, fontSize: '0.8125rem', marginLeft: 'auto' }}>
                  {filteredSalesEntries.length} record{filteredSalesEntries.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* List */}
              {loading ? <Skeleton /> : filteredSalesEntries.length === 0
                ? <Card style={{ padding: '2.5rem', textAlign: 'center' }}><p style={{ color: MID }}>No records match your filters.</p></Card>
                : <Card style={{ overflow: 'hidden' }}>
                    {/* Column header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', padding: '0.5rem 1.25rem', borderBottom: `1px solid ${BDR}`, background: LITE }}>
                      <span style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer · Service · Barber</span>
                      <span style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Amount</span>
                    </div>

                    {filteredSalesEntries.map((t, i) => {
                      const isWalkin    = t.type === 'walkin';
                      const isSynthetic = t.id.startsWith('res-');
                      const phone       = (t as any).customerPhone as string | undefined;
                      const payment     = (t as any).paymentMethod as string | undefined;

                      // Format date as "Jun 26"
                      const dateObj   = t.date ? new Date(t.date + 'T00:00:00') : null;
                      const dateLabel = dateObj
                        ? dateObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                        : t.date;
                      const timeLabel = fmt12(t.time);

                      return (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.875rem',
                            padding: '0.875rem 1.25rem',
                            borderBottom: i < filteredSalesEntries.length - 1 ? `1px solid ${BDR}` : 'none',
                            background: isSynthetic ? '#FAFFF8' : WHITE,
                          }}
                        >
                          {/* Left accent bar */}
                          <div style={{ width: 3, height: 40, borderRadius: 2, background: isWalkin ? '#8B5CF6' : BLUE, flexShrink: 0 }} />

                          {/* Avatar initial */}
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: isWalkin ? '#EDE9FE' : '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ color: isWalkin ? '#5B21B6' : '#1E40AF', fontWeight: 700, fontSize: '0.875rem' }}>
                              {(t.customer || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>

                          {/* Main info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                              <span style={{ color: DARK, fontWeight: 700, fontSize: '0.9375rem' }}>{t.customer || '—'}</span>
                              <span style={{
                                padding: '0.125rem 0.5rem',
                                borderRadius: '999px',
                                background: isWalkin ? '#EDE9FE' : '#DBEAFE',
                                color: isWalkin ? '#5B21B6' : '#1E40AF',
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                letterSpacing: '0.03em',
                                flexShrink: 0,
                              }}>
                                {isWalkin ? 'Walk-In' : 'Reservation'}
                              </span>
                              {phone && <span style={{ color: MID, fontSize: '0.75rem' }}>{phone}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                              <span style={{ color: MID, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.service || '—'}</span>
                              <span style={{ color: '#D1D5DB', fontSize: '0.75rem' }}>·</span>
                              <span style={{ color: MID, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>by {t.barber || '—'}</span>
                            </div>
                          </div>

                          {/* Date + time */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ color: DARK, fontSize: '0.8125rem', fontWeight: 500, display: 'block' }}>{dateLabel || '—'}</span>
                            <span style={{ color: MID, fontSize: '0.75rem', fontFamily: 'DM Mono, monospace' }}>{timeLabel || '—'}</span>
                          </div>

                          {/* Amount */}
                          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 72 }}>
                            <span style={{ color: G, fontWeight: 800, fontSize: '1rem', display: 'block' }}>₱{(t.amount ?? 0).toLocaleString()}</span>
                            <span style={{ color: MID, fontSize: '0.7rem' }}>{payment && payment !== '—' ? payment : 'Cash'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
              }
            </motion.div>
          )}

          {/* REPORTS */}
          {nav === 'reports' && (() => {
            const rptTxnResIds = new Set(transactions.map(t => t.reservationId).filter(id => id && id !== ''));
            const rptResWithoutTxn = reservations.filter(r => r.status === 'Completed' && !rptTxnResIds.has(r.id));

            const walkinTxns   = transactions.filter(t => t.type === 'walkin');
            const reservedTxns = transactions.filter(t => t.type !== 'walkin');
            const walkinRev    = walkinTxns.reduce((s, t) => s + t.amount, 0);
            const reservedRev  = reservedTxns.reduce((s, t) => s + t.amount, 0)
                               + rptResWithoutTxn.reduce((s, r) => s + r.amount, 0);

            const completedRes  = reservations.filter(r => r.status === 'Completed').length;
            const cancelledRes  = reservations.filter(r => r.status === 'Cancelled').length;
            const totalResCount = reservations.filter(r => r.status !== 'Cancelled').length || 1;
            const completionRate = Math.round((completedRes / totalResCount) * 100);
            const allTxnCount   = transactions.length + rptResWithoutTxn.length;
            const avgTicket     = allTxnCount > 0 ? Math.round(totalRev / allTxnCount) : 0;

            // Monthly revenue
            const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const monthMap: Record<string, { rev: number; count: number }> = {};
            MONS.forEach(m => { monthMap[m] = { rev: 0, count: 0 }; });
            transactions.forEach(t => {
              if (!t.date) return;
              const m = MONS[new Date(t.date).getMonth()];
              monthMap[m].rev   += t.amount;
              monthMap[m].count += 1;
            });
            rptResWithoutTxn.forEach(r => {
              if (!r.date) return;
              const m = MONS[new Date(r.date).getMonth()];
              monthMap[m].rev   += r.amount;
              monthMap[m].count += 1;
            });
            const monthlyData = MONS.map(m => ({ label: m, revenue: monthMap[m].rev, count: monthMap[m].count }));
            const maxMon = Math.max(...monthlyData.map(d => d.revenue), 1);

            // Top services by revenue
            const svcRevMap: Record<string, { rev: number; count: number }> = {};
            transactions.forEach(t => {
              if (!t.service) return;
              if (!svcRevMap[t.service]) svcRevMap[t.service] = { rev: 0, count: 0 };
              svcRevMap[t.service].rev   += t.amount;
              svcRevMap[t.service].count += 1;
            });
            const topSvcs = Object.entries(svcRevMap).sort((a, b) => b[1].rev - a[1].rev).slice(0, 6);
            const maxSvcRev = topSvcs[0]?.[1].rev || 1;

            // Per-barber revenue breakdown
            const barberRevMap: Record<string, { name: string; rev: number; count: number; walkin: number; reserved: number }> = {};
            transactions.forEach(t => {
              const key = t.barberId || t.barber;
              if (!key) return;
              if (!barberRevMap[key]) barberRevMap[key] = { name: t.barber, rev: 0, count: 0, walkin: 0, reserved: 0 };
              barberRevMap[key].rev   += t.amount;
              barberRevMap[key].count += 1;
              if (t.type === 'walkin') barberRevMap[key].walkin += 1;
              else barberRevMap[key].reserved += 1;
            });
            const barberStats = Object.values(barberRevMap).sort((a, b) => b.rev - a.rev);

            return (
              <motion.div key="reports" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 1.75rem' }}>Reports</h1>

                {/* Revenue KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <KpiCard label="Total Revenue"       value={`₱${totalRev.toLocaleString()}`}       color={G}         icon={DollarSign} sub="all-time combined" />
                  <KpiCard label="Reservation Revenue" value={`₱${reservedRev.toLocaleString()}`}     color={BLUE}      icon={Calendar}   sub="from bookings" />
                  <KpiCard label="Walk-In Revenue"     value={`₱${walkinRev.toLocaleString()}`}       color={'#8B5CF6'} icon={UserPlus}   sub="drop-in customers" />
                </div>

                {/* Operational KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <KpiCard label="Completed"       value={completedRes}               color={G}         icon={Check}      sub="reservations done" />
                  <KpiCard label="Completion Rate" value={`${completionRate}%`}       color={G}         icon={TrendingUp} sub="of non-cancelled" />
                  <KpiCard label="Avg Ticket"      value={`₱${avgTicket.toLocaleString()}`} color={BLUE} icon={DollarSign} sub="per transaction" />
                  <KpiCard label="Cancelled"       value={cancelledRes}               color={ERR}       icon={X}          sub="reservations" />
                </div>

                {/* Monthly revenue chart */}
                <Card style={{ padding: '1.375rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>Monthly Revenue</h3>
                    <span style={{ color: MID, fontSize: '0.75rem' }}>All-time · {new Date().getFullYear()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.375rem', height: 140 }}>
                    {monthlyData.map(d => (
                      <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: '100%', justifyContent: 'flex-end' }}>
                        {d.revenue > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                            <span style={{ color: DARK, fontSize: '0.5rem', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>{d.revenue >= 1000 ? `${(d.revenue/1000).toFixed(1)}k` : d.revenue}</span>
                            <span style={{ color: MID, fontSize: '0.45rem' }}>{d.count}x</span>
                          </div>
                        )}
                        <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: d.revenue > 0 ? G : '#F3F4F6', height: `${Math.max((d.revenue / maxMon) * 100, d.revenue > 0 ? 3 : 0)}px`, transition: 'height 0.3s' }} />
                        <span style={{ color: MID, fontSize: '0.55rem', fontWeight: 500 }}>{d.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Two-column: top services + barber performance */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  {/* Top services */}
                  <Card style={{ padding: '1.375rem' }}>
                    <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1.125rem' }}>Top Services by Revenue</h3>
                    {topSvcs.length === 0 ? <p style={{ color: MID, fontSize: '0.875rem' }}>No transactions yet.</p>
                      : topSvcs.map(([name, stats], i) => (
                          <div key={name} style={{ marginBottom: i < topSvcs.length - 1 ? '0.875rem' : 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minWidth: 0, flex: 1 }}>
                                <span style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>#{i+1}</span>
                                <span style={{ color: DARK, fontWeight: 500, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.5rem' }}>
                                <span style={{ color: G, fontWeight: 700, fontSize: '0.8125rem' }}>₱{stats.rev.toLocaleString()}</span>
                                <span style={{ color: MID, fontSize: '0.7rem', display: 'block' }}>{stats.count} sale{stats.count !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(stats.rev / maxSvcRev) * 100}%`, background: i === 0 ? G : '#22C55E', borderRadius: 3 }} />
                            </div>
                          </div>
                        ))
                    }
                  </Card>

                  {/* Per-barber revenue */}
                  <Card style={{ padding: '1.375rem' }}>
                    <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1.125rem' }}>Barber Revenue Breakdown</h3>
                    {barberStats.length === 0 ? <p style={{ color: MID, fontSize: '0.875rem' }}>No barber transactions yet.</p>
                      : barberStats.map((b, i) => (
                          <div key={b.name} style={{ padding: '0.625rem 0', borderBottom: i < barberStats.length - 1 ? `1px solid ${BDR}` : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ color: G, fontWeight: 700, fontSize: '0.875rem' }}>{b.name.charAt(0)}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: DARK, fontWeight: 600, fontSize: '0.875rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</p>
                              <p style={{ color: MID, fontSize: '0.7rem', margin: '0.1rem 0 0' }}>{b.reserved} reserved · {b.walkin} walk-in</p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ color: G, fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>₱{b.rev.toLocaleString()}</p>
                              <p style={{ color: MID, fontSize: '0.7rem', margin: '0.1rem 0 0' }}>{b.count} transaction{b.count !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        ))
                    }
                  </Card>
                </div>

                {/* Top Customers */}
                <Card style={{ padding: '1.375rem', overflow: 'hidden' }}>
                  <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1.125rem' }}>Top Customers by Visits</h3>
                  {customers.length === 0 ? <p style={{ color: MID, fontSize: '0.875rem' }}>Loading customer data…</p>
                    : customers.sort((a, b) => b.totalVisits - a.totalVisits).slice(0, 8).map((c, i) => (
                        <div key={c.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.625rem 0', borderBottom: i < Math.min(customers.length, 8) - 1 ? `1px solid ${BDR}` : 'none' }}>
                          <span style={{ color: '#9CA3AF', fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', fontWeight: 600, width: 24, flexShrink: 0 }}>#{i+1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{c.name}</p>
                            <p style={{ color: MID, fontSize: '0.75rem', margin: '0.125rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email} · <span style={{ color: '#166534', fontWeight: 600 }}>{c.loyaltyTier}</span></p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: G, fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>{c.totalVisits} visits</p>
                            <p style={{ color: MID, fontSize: '0.75rem', margin: '0.125rem 0 0' }}>₱{c.totalSpent.toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                  }
                </Card>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </main>
    </div>
  );
}
