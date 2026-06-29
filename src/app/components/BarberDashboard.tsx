import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { Calendar, Clock, Check, User, ToggleLeft, Scissors, Camera, LogOut, TrendingUp, DollarSign, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../../lib/firebase';
import { listenBarberReservations, updateReservationStatus, completeReservation, updateBarberAvailability, listenBarbers, updateBarber, listenBarberTransactions, computeBarberStats, listenServices } from '../../lib/db';
import type { DBBarber, DBReservation, DBTransaction, DBService, ReservationStatus } from '../../lib/db';
import { WalkInForm } from './WalkInForm';
import { fmt12 } from '../../lib/timeFormat';
import { uploadImage } from '../../lib/cloudinary';
import { Sidebar } from './Sidebar';

interface Props { user: { uid: string; name: string; email: string; barberId?: string }; onLogout: () => void; }
type Nav = 'schedule' | 'walkin' | 'performance' | 'appointments' | 'availability' | 'profile';

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

const STATUS: Record<ReservationStatus, { color: string; bg: string }> = {
  Pending:   { color: '#92400E', bg: '#FEF3C7' },
  Confirmed: { color: '#166534', bg: '#DCFCE7' },
  Completed: { color: '#1E40AF', bg: '#DBEAFE' },
  Cancelled: { color: '#991B1B', bg: '#FEE2E2' },
};

const ALL_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'];

const NAV_ITEMS = [
  { id: 'schedule' as Nav,     label: 'Schedule',       icon: Calendar   },
  { id: 'walkin' as Nav,       label: 'Walk-In',        icon: UserPlus   },
  { id: 'performance' as Nav,  label: 'Performance',    icon: TrendingUp },
  { id: 'appointments' as Nav, label: 'Appointments',   icon: Scissors   },
  { id: 'availability' as Nav, label: 'Availability',   icon: ToggleLeft },
  { id: 'profile' as Nav,      label: 'Profile',        icon: User       },
];

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: WHITE, borderRadius: '0.875rem', border: `1px solid ${BDR}`, boxShadow: SHADOW, ...style }}>{children}</div>;
}

function Badge({ status }: { status: ReservationStatus }) {
  const s = STATUS[status];
  return <span style={{ display: 'inline-flex', padding: '0.175rem 0.5625rem', borderRadius: '999px', background: s.bg, color: s.color, fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>{status}</span>;
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {[80, 64, 64].map((h, i) => <div key={i} style={{ height: h, background: '#F3F4F6', borderRadius: '0.75rem', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}

export function BarberDashboard({ user, onLogout }: Props) {
  const [nav, setNav]               = useState<Nav>('schedule');
  const [barberInfo, setBarberInfo] = useState<DBBarber | null>(null);
  const [reservations, setReservations] = useState<DBReservation[]>([]);
  const [slots, setSlots]           = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]           = useState(false);
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);
  const [services, setServices]         = useState<DBService[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user.barberId) return;
    setUploadingPhoto(true);
    try { const url = await uploadImage(file); await updateBarber(user.barberId, { photo: url }); toast.success('Photo updated.'); }
    catch { toast.error('Upload failed.'); }
    setUploadingPhoto(false); e.target.value = '';
  };

  useEffect(() => {
    if (!user.barberId) { setLoading(false); return; }
    const u: (() => void)[] = [];
    u.push(listenBarbers(bs => { const me = bs.find(b => b.id === user.barberId); if (me) { setBarberInfo(me); setSlots(new Set(me.availableSlots)); } }));
    // Listen to this barber's transactions for performance metrics (matched by name after barberInfo loads)
    // We reload when barberInfo is set — handled below in a secondary effect
    u.push(listenBarberReservations(user.barberId, r => { setReservations(r); setLoading(false); }));
    return () => u.forEach(fn => fn());
  }, [user.barberId]);

  // Load services for WalkInForm
  useEffect(() => { return listenServices(setServices); }, []);

  // Load transactions once barber name is known
  useEffect(() => {
    if (!barberInfo?.name) return;
    return listenBarberTransactions(barberInfo.name, setTransactions);
  }, [barberInfo?.name]);

  const handleLogout = async () => { await signOut(auth); onLogout(); };

  // Performance stats (computed from Firestore data)
  const perf = barberInfo
    ? computeBarberStats(user.barberId ?? '', barberInfo.name, reservations, transactions)
    : null;
  const todayStr   = new Date().toISOString().split('T')[0];
  // Today's appointments (for stats)
  const todayRes   = reservations.filter(r => r.date === todayStr && r.status !== 'Cancelled').sort((a, b) => a.time.localeCompare(b.time));
  // ALL active appointments barber needs to serve (Pending + Confirmed, sorted by date+time)
  const activeRes  = reservations
    .filter(r => r.status === 'Pending' || r.status === 'Confirmed')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  // Recently completed (last 5, for reference)
  const recentDone = reservations
    .filter(r => r.status === 'Completed')
    .sort((a, b) => (b.updatedAt ?? b.date ?? '').localeCompare(a.updatedAt ?? a.date ?? ''))
    .slice(0, 5);

  const markDone = async (id: string) => {
    try {
      // completeReservation atomically: marks Completed + auto-creates transaction + updates customer loyalty
      await completeReservation(id, 'Cash');
      toast.success('Appointment completed. Transaction recorded automatically.');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to complete.');
    }
  };
  const saveSlots = async () => {
    if (!user.barberId) return; setSaving(true);
    await updateBarberAvailability(user.barberId, Array.from(slots));
    toast.success('Availability saved.'); setSaving(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar nav={nav} setNav={setNav} items={NAV_ITEMS} userName={barberInfo?.name ?? user.name} userRole="Barber" userPhoto={barberInfo?.photo} onLogout={handleLogout} />

      <main style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
        <AnimatePresence mode="wait">

          {nav === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <p style={{ color: MID, fontSize: '0.875rem', margin: '0 0 0.25rem' }}>{new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 1.5rem' }}>My Schedule</h1>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem', marginBottom: '1.75rem' }}>
                {[
                  { label: "Today's Appointments", value: todayRes.length },
                  { label: 'Pending / Upcoming',   value: activeRes.length },
                  { label: 'Completed Today',       value: todayRes.filter(r => r.status === 'Completed').length },
                  { label: 'All-Time Completed',    value: (barberInfo?.totalCompleted ?? 0).toLocaleString() },
                ].map(s => (
                  <Card key={s.label} style={{ padding: '1rem 1.125rem' }}>
                    <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.375rem' }}>{s.label}</p>
                    <p style={{ color: G, fontWeight: 700, fontSize: '1.5rem', margin: 0 }}>{s.value}</p>
                  </Card>
                ))}
              </div>

              {loading ? <Skeleton /> : (
                <>
                  {/* ── Active Appointments (Pending / Confirmed) ── */}
                  {activeRes.length > 0 && (
                    <>
                      <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.75rem' }}>
                        Pending &amp; Confirmed — tap Done when service is complete
                      </p>
                      <Card style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
                        {activeRes.map((r, i) => {
                          const isToday = r.date === todayStr;
                          const serviceLabel = (r.services && r.services.length > 1)
                            ? r.services.map(s => s.name).join(' + ')
                            : r.service;
                          return (
                            <div key={r.id} style={{ padding: '0.875rem 1.125rem', borderBottom: i < activeRes.length - 1 ? `1px solid ${BDR}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                  <p style={{ color: DARK, fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>{r.customer}</p>
                                  {isToday
                                    ? <span style={{ padding: '0.125rem 0.5rem', borderRadius: '999px', background: GREEN_BG, color: '#166534', fontSize: '0.625rem', fontWeight: 700, border: `1px solid ${GREEN_BDR}` }}>TODAY</span>
                                    : <span style={{ color: MID, fontSize: '0.75rem' }}>{r.date}</span>
                                  }
                                  <span style={{ padding: '0.125rem 0.5rem', borderRadius: '999px', background: r.status === 'Confirmed' ? GREEN_BG : '#FEF3C7', color: r.status === 'Confirmed' ? '#166534' : '#92400E', fontSize: '0.625rem', fontWeight: 700 }}>{r.status}</span>
                                </div>
                                <p style={{ color: MID, fontSize: '0.8rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {serviceLabel}
                                </p>
                                <p style={{ color: G, fontSize: '0.8rem', fontWeight: 600, margin: '0.25rem 0 0' }}>{fmt12(r.time)}</p>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                                <span style={{ color: DARK, fontWeight: 700 }}>₱{r.amount || 0}</span>
                                {r.status === 'Confirmed' ? (
                                  <button
                                    onClick={() => markDone(r.id)}
                                    style={{ padding: '0.4375rem 0.875rem', borderRadius: '0.5rem', background: G, border: 'none', color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontFamily: 'Inter, sans-serif', boxShadow: `0 2px 6px ${G}40` }}>
                                    <Check size={14} /> Complete
                                  </button>
                                ) : (
                                  <span title="Admin must confirm this reservation before you can complete it." style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: '#FEF3C7', color: '#92400E', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #FDE68A', cursor: 'default', whiteSpace: 'nowrap' }}>
                                    Awaiting Approval
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </Card>
                    </>
                  )}

                  {activeRes.length === 0 && (
                    <Card style={{ padding: '2.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.875rem' }}><Calendar size={20} color={G} /></div>
                      <p style={{ color: DARK, fontWeight: 600, margin: '0 0 0.25rem' }}>No pending appointments</p>
                      <p style={{ color: MID, fontSize: '0.875rem', margin: 0 }}>All caught up!</p>
                    </Card>
                  )}

                  {/* ── Recently Completed ── */}
                  {recentDone.length > 0 && (
                    <>
                      <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.75rem' }}>Recently Completed</p>
                      <Card style={{ overflow: 'hidden', opacity: 0.7 }}>
                        {recentDone.map((r, i) => (
                          <div key={r.id} style={{ padding: '0.75rem 1.125rem', borderBottom: i < recentDone.length - 1 ? `1px solid ${BDR}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ color: DARK, fontWeight: 500, fontSize: '0.9rem', margin: 0 }}>{r.customer}</p>
                              <p style={{ color: MID, fontSize: '0.75rem', margin: '0.125rem 0 0' }}>{r.service} · {r.date} {fmt12(r.time)}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                              <span style={{ color: G, fontWeight: 700 }}>₱{r.amount || 0}</span>
                              <span style={{ padding: '0.175rem 0.5rem', borderRadius: '999px', background: '#DBEAFE', color: '#1E40AF', fontSize: '0.65rem', fontWeight: 700 }}>Done ✓</span>
                            </div>
                          </div>
                        ))}
                      </Card>
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── WALK-IN ── */}
          {nav === 'walkin' && (
            <motion.div key="walkin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 0.375rem' }}>Walk-In Customer</h1>
              <p style={{ color: MID, fontSize: '0.875rem', margin: '0 0 1.75rem' }}>Record services for customers who arrived without a reservation.</p>
              <WalkInForm
                barbers={barberInfo ? [barberInfo] : []}
                services={services}
                lockedBarberId={user.barberId}
                onSuccess={() => toast.success('Walk-in recorded and performance updated.')}
              />
            </motion.div>
          )}

          {/* ── PERFORMANCE ── */}
          {nav === 'performance' && (
            <motion.div key="performance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 0.375rem' }}>My Performance</h1>
              <p style={{ color: MID, fontSize: '0.875rem', margin: '0 0 1.75rem' }}>Live metrics computed from your completed appointments.</p>

              {/* Today's breakdown — reserved vs walk-in */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Reserved Today',  value: perf?.reservedToday ?? 0,  color: G,        icon: Calendar   },
                  { label: 'Walk-Ins Today',  value: perf?.walkinToday ?? 0,    color: '#8B5CF6', icon: UserPlus  },
                  { label: 'Total Today',     value: perf?.todayCount ?? 0,     color: DARK,      icon: User       },
                  { label: "Today's Revenue", value: `₱${(perf?.dailyRevenue ?? 0).toLocaleString()}`, color: G, icon: DollarSign },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <Card key={s.label} style={{ padding: '1.125rem 1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                        <p style={{ color: MID, fontSize: '0.75rem', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                        <div style={{ width: 28, height: 28, borderRadius: '0.5rem', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={13} color={s.color} /></div>
                      </div>
                      <p style={{ color: s.color, fontWeight: 700, fontSize: '1.5rem', margin: 0 }}>{s.value}</p>
                    </Card>
                  );
                })}
              </div>

              {/* Period stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'This Week',  value: perf?.weekCount ?? 0,  icon: TrendingUp, color: BLUE },
                  { label: 'This Month', value: perf?.monthCount ?? 0, icon: User,       color: '#8B5CF6' },
                  { label: 'All-Time',   value: perf?.totalCompleted ?? 0, icon: Check,  color: G },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <Card key={s.label} style={{ padding: '1.125rem 1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                        <p style={{ color: MID, fontSize: '0.75rem', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                        <div style={{ width: 28, height: 28, borderRadius: '0.5rem', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={13} color={s.color} /></div>
                      </div>
                      <p style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', margin: 0 }}>{s.value}</p>
                      <p style={{ color: MID, fontSize: '0.75rem', margin: '0.125rem 0 0' }}>Customers served</p>
                    </Card>
                  );
                })}
              </div>

              {/* Revenue + Total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Card style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                    <p style={{ color: MID, fontSize: '0.75rem', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenue Generated</p>
                    <div style={{ width: 28, height: 28, borderRadius: '0.5rem', background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={13} color="#CA8A04" /></div>
                  </div>
                  <p style={{ color: G, fontWeight: 800, fontSize: '1.5rem', margin: 0 }}>₱{(perf?.totalRevenue ?? 0).toLocaleString()}</p>
                  <p style={{ color: MID, fontSize: '0.75rem', margin: '0.125rem 0 0' }}>From all transactions</p>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                    <p style={{ color: MID, fontSize: '0.75rem', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Completed</p>
                    <div style={{ width: 28, height: 28, borderRadius: '0.5rem', background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={13} color={G} /></div>
                  </div>
                  <p style={{ color: DARK, fontWeight: 700, fontSize: '1.5rem', margin: 0 }}>{perf?.totalCompleted ?? 0}</p>
                  <p style={{ color: MID, fontSize: '0.75rem', margin: '0.125rem 0 0' }}>All-time appointments</p>
                </Card>
              </div>

              {/* Most requested services */}
              <Card style={{ padding: '1.25rem' }}>
                <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1rem' }}>Most Requested Services</h3>
                {!perf || perf.topServices.length === 0
                  ? <p style={{ color: MID, fontSize: '0.875rem' }}>No completed appointments yet.</p>
                  : (() => {
                      const maxCount = perf.topServices[0]?.count || 1;
                      return perf.topServices.map((s, i) => (
                        <div key={s.name} style={{ marginBottom: i < perf.topServices.length - 1 ? '0.875rem' : 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'DM Mono, monospace', width: 20 }}>#{i+1}</span>
                              <span style={{ color: DARK, fontWeight: 500, fontSize: '0.875rem' }}>{s.name}</span>
                            </div>
                            <span style={{ color: G, fontWeight: 700, fontSize: '0.875rem' }}>{s.count}x</span>
                          </div>
                          <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginLeft: 28 }}>
                            <div style={{ height: '100%', width: `${(s.count / maxCount) * 100}%`, background: i === 0 ? G : '#22C55E', borderRadius: 3 }} />
                          </div>
                        </div>
                      ));
                    })()
                }
              </Card>
            </motion.div>
          )}

          {nav === 'appointments' && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 1.75rem' }}>All Appointments</h1>
              {loading ? <Skeleton /> : reservations.length === 0
                ? <Card style={{ padding: '2.5rem', textAlign: 'center' }}><p style={{ color: MID }}>No appointments yet.</p></Card>
                : <Card>
                    {reservations.map((r, i) => (
                      <div key={r.id} style={{ padding: '0.875rem 1.125rem', borderBottom: i < reservations.length - 1 ? `1px solid ${BDR}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: 0 }}>{r.customer}</p>
                          <p style={{ color: MID, fontSize: '0.8rem', marginTop: '0.2rem' }}>{r.service} · {r.date} {fmt12(r.time)}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <span style={{ color: DARK, fontWeight: 700 }}>₱{r.amount}</span>
                          <Badge status={r.status} />
                        </div>
                      </div>
                    ))}
                  </Card>
              }
            </motion.div>
          )}

          {nav === 'availability' && (
            <motion.div key="availability" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 0.375rem' }}>Availability</h1>
              <p style={{ color: MID, fontSize: '0.875rem', margin: '0 0 1.75rem' }}>Toggle slots open or blocked, then save.</p>
              <div style={{ maxWidth: 420 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem', marginBottom: '1.25rem' }}>
                  {ALL_SLOTS.map(slot => {
                    const on = slots.has(slot);
                    return (
                      <button key={slot} onClick={() => setSlots(p => { const n = new Set(p); if (n.has(slot)) n.delete(slot); else n.add(slot); return n; })}
                        style={{ padding: '0.5rem 0.25rem', borderRadius: '0.5rem', border: `1.5px solid ${on ? G : BDR}`, background: on ? GREEN_BG : WHITE, color: on ? '#166534' : MID, fontSize: '0.75rem', fontWeight: on ? 700 : 400, cursor: 'pointer', transition: 'all 0.12s', textAlign: 'center', boxShadow: on ? `0 0 0 1px ${GREEN_BDR}` : 'none' }}>
                        {fmt12(slot)}
                      </button>
                    );
                  })}
                </div>
                <Card style={{ padding: '1rem 1.125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: DARK, fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{slots.size} / {ALL_SLOTS.length} slots open</p>
                    <p style={{ color: MID, fontSize: '0.75rem', marginTop: '0.125rem' }}>Changes sync to Firebase in real-time</p>
                  </div>
                  <button onClick={saveSlots} disabled={saving}
                    style={{ padding: '0.5625rem 1.125rem', borderRadius: '0.5rem', background: saving ? '#86EFAC' : G, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: saving ? 'none' : `0 2px 8px ${G}40` }}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </Card>
              </div>
            </motion.div>
          )}

          {nav === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <h1 style={{ color: DARK, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.02em', margin: '0 0 1.75rem' }}>My Profile</h1>
              <div style={{ maxWidth: 420 }}>
                <Card style={{ padding: '1.375rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '1.125rem', alignItems: 'center', paddingBottom: '1.125rem', marginBottom: '1.125rem', borderBottom: `1px solid ${BDR}` }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${BDR}` }}>
                        {barberInfo?.photo ? <img src={barberInfo.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', background: GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: G, fontWeight: 700, fontSize: '1.5rem' }}>{user.name.charAt(0)}</span></div>}
                      </div>
                      <button onClick={() => photoRef.current?.click()} disabled={uploadingPhoto} style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: G, border: `2px solid ${WHITE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingPhoto ? 'not-allowed' : 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                        {uploadingPhoto ? <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> : <Camera size={11} color="#fff" />}
                      </button>
                      <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                    </div>
                    <div>
                      <p style={{ color: DARK, fontWeight: 700, fontSize: '1.125rem', margin: 0 }}>{barberInfo?.name ?? user.name}</p>
                      <p style={{ color: G, fontSize: '0.875rem', fontWeight: 600, marginTop: '0.125rem' }}>{barberInfo?.speciality ?? 'Barber'}</p>
                      <span style={{ display: 'inline-block', marginTop: '0.375rem', padding: '0.175rem 0.5625rem', borderRadius: '999px', background: barberInfo?.available ? GREEN_BG : '#FEF2F2', color: barberInfo?.available ? '#166534' : '#991B1B', fontSize: '0.6875rem', fontWeight: 600 }}>{barberInfo?.available ? 'Available' : 'Off today'}</span>
                    </div>
                  </div>
                  {[['Email', user.email], ['Phone', barberInfo?.phone || '—'], ['Rating', barberInfo ? `${barberInfo.rating} ★ (${barberInfo.reviews} reviews)` : '—'], ['Total Completed', (barberInfo?.totalCompleted ?? 0).toLocaleString()], ['Joined', barberInfo?.joinDate ?? '—']].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: `1px solid ${BDR}` }}>
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
