import { useMemo, useState } from 'react';
import { Trophy, TrendingUp, Clock, Zap, Star, Users, ChevronLeft, ChevronRight, X, Calendar, DollarSign, Check, Filter } from 'lucide-react';
import type { DBBarber, DBReservation, DBTransaction, DBCustomer } from '../../lib/db';

// No recharts — all charts are pure CSS to avoid SVG duplicate-key warnings.

const G      = '#16A34A';
const FG     = '#111827';
const DIM    = '#6B7280';
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

const CHART_COLORS = [G, '#22C55E', '#3B82F6', '#F59E0B', '#EF4444'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface Props {
  barbers: DBBarber[];
  reservations: DBReservation[];
  transactions: DBTransaction[];
  customers: DBCustomer[];
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: WHITE, borderRadius: '0.875rem', border: `1px solid ${BDR}`, boxShadow: SHADOW, ...style }}>{children}</div>;
}

// ── CSS bar chart ─────────────────────────────────────────────────────────────

function BarChartCSS({ data, labelKey, valueKey, color = G, formatValue }: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...data.map(d => d[valueKey] as number), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.375rem', height: 120 }}>
      {data.map((d, i) => {
        const val = d[valueKey] as number;
        const pct = (val / max) * 95;
        return (
          <div key={`${d[labelKey]}-${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: '100%', justifyContent: 'flex-end' }}>
            {val > 0 && <span style={{ color: DIM, fontSize: '0.55rem', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{formatValue ? formatValue(val) : val}</span>}
            <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: val > 0 ? color : '#F3F4F6', height: `${Math.max(val > 0 ? pct : 0, val > 0 ? 3 : 0)}px` }} />
            <span style={{ color: DIM, fontSize: '0.6rem', fontWeight: 500 }}>{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsDashboard({ barbers, reservations, transactions, customers }: Props) {
  // Calendar state
  const [calYear, setCalYear]     = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]   = useState(new Date().getMonth());
  const [selDate, setSelDate]     = useState<string | null>(null);

  // Filter state
  const [filterBarber, setFilterBarber]   = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [showFilters, setShowFilters]     = useState(false);

  // All unique services from transactions
  const allServices = useMemo(() => [...new Set(transactions.map(t => t.service))].sort(), [transactions]);

  // Apply filters
  const filteredTxns = useMemo(() =>
    transactions.filter(t =>
      (filterBarber === 'all' || t.barber === filterBarber) &&
      (filterService === 'all' || t.service === filterService)
    ), [transactions, filterBarber, filterService]);

  const filteredRes = useMemo(() =>
    reservations.filter(r =>
      (filterBarber === 'all' || r.barber === filterBarber) &&
      (filterService === 'all' || r.service.includes(filterService))
    ), [reservations, filterBarber, filterService]);

  // Daily aggregates for calendar
  const dailyMap = useMemo(() => {
    const map: Record<string, { revenue: number; txnCount: number; resCount: number }> = {};
    filteredTxns.forEach(t => {
      if (!map[t.date]) map[t.date] = { revenue: 0, txnCount: 0, resCount: 0 };
      map[t.date].revenue += t.amount;
      map[t.date].txnCount++;
    });
    filteredRes.forEach(r => {
      if (!map[r.date]) map[r.date] = { revenue: 0, txnCount: 0, resCount: 0 };
      map[r.date].resCount++;
    });
    return map;
  }, [filteredTxns, filteredRes]);

  // Selected date analytics
  const selectedData = useMemo(() => {
    if (!selDate) return null;

    // All recorded transactions on this date
    const dayTxns = filteredTxns.filter(t => t.date === selDate);
    // All reservations on this date
    const dayRes  = filteredRes.filter(r => r.date === selDate);

    // Completed reservations (source of truth for "reserved" count regardless of transaction)
    const completedRes = dayRes.filter(r => r.status === 'Completed');
    // Walk-in transactions only
    const walkinTxns   = dayTxns.filter(t => t.type === 'walkin');

    // Revenue = recorded transactions + completed reservations that have no transaction yet
    const txnResIds    = new Set(dayTxns.map(t => t.reservationId).filter(id => id && id !== ''));
    const resWithoutTxn = completedRes.filter(r => !txnResIds.has(r.id));
    const txnRevenue   = dayTxns.reduce((s, t) => s + (t.amount ?? 0), 0);
    const resRevenue   = resWithoutTxn.reduce((s, r) => s + (r.amount ?? 0), 0);
    const revenue      = txnRevenue + resRevenue;

    // Top barber — from transactions + untransacted completed reservations
    const barberMap: Record<string, number> = {};
    dayTxns.forEach(t => { barberMap[t.barber] = (barberMap[t.barber] || 0) + t.amount; });
    resWithoutTxn.forEach(r => { barberMap[r.barber] = (barberMap[r.barber] || 0) + r.amount; });
    const topBarber = Object.entries(barberMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    // Most requested services — from transactions + untransacted completed reservations
    const svcMap: Record<string, number> = {};
    dayTxns.forEach(t => {
      if (t.services && t.services.length > 0) {
        t.services.forEach(s => { svcMap[s.name] = (svcMap[s.name] || 0) + 1; });
      } else if (t.service) {
        svcMap[t.service] = (svcMap[t.service] || 0) + 1;
      }
    });
    resWithoutTxn.forEach(r => {
      if (r.services && r.services.length > 0) {
        r.services.forEach(s => { svcMap[s.name] = (svcMap[s.name] || 0) + 1; });
      } else if (r.service) {
        svcMap[r.service] = (svcMap[r.service] || 0) + 1;
      }
    });
    const topServices = Object.entries(svcMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

    // KEY FIX: reservedCount = actual completed reservations (not transaction type)
    //          walkinCount   = walk-in type transactions
    //          totalServed   = both combined (avoids double-counting)
    const reservedCount = completedRes.length;
    const walkinCount   = walkinTxns.length;
    const totalServed   = reservedCount + walkinCount;

    // All transactions to display in the panel (walk-ins + reservation transactions)
    const allDisplayTxns = [
      ...dayTxns,
      // Append completed reservations that have no transaction as virtual entries
      ...resWithoutTxn.map(r => ({
        id: `res-${r.id}`,
        type: 'reservation' as const,
        reservationId: r.id,
        customer: r.customer,
        barber: r.barber,
        service: r.service,
        services: r.services ?? [],
        amount: r.amount,
        date: r.date,
        time: r.time,
        paymentMethod: 'Pending',
        barberId: r.barberId,
        customerPhone: '',
        notes: '',
      })),
    ];

    return {
      revenue,
      transactions: allDisplayTxns,
      completedRes,
      reservations: dayRes,
      walkinCount,
      reservedCount,
      totalServed,
      completed: completedRes.length,
      cancelled: dayRes.filter(r => r.status === 'Cancelled').length,
      pending:   dayRes.filter(r => r.status === 'Pending').length,
      confirmed: dayRes.filter(r => r.status === 'Confirmed').length,
      topBarber,
      topServices,
    };
  }, [selDate, filteredTxns, filteredRes]);

  // Calendar grid
  const calDays    = new Date(calYear, calMonth + 1, 0).getDate();
  const calFirst   = new Date(calYear, calMonth, 1).getDay();
  const calFirstMon = calFirst === 0 ? 6 : calFirst - 1; // start week on Monday
  const today      = new Date().toISOString().split('T')[0];

  // Summary metrics
  // Set of reservation IDs that already have a recorded transaction (used to avoid double-counting)
  const txnReservationIds = useMemo(
    () => new Set(filteredTxns.map(t => t.reservationId).filter(id => id && id !== '')),
    [filteredTxns],
  );
  // Completed reservations with no matching transaction (legacy data before auto-create fix)
  const completedWithoutTxn = useMemo(
    () => filteredRes.filter(r => r.status === 'Completed' && !txnReservationIds.has(r.id)),
    [filteredRes, txnReservationIds],
  );
  // Total revenue = recorded transactions + legacy completed reservations without transactions
  const txnRevenue    = filteredTxns.reduce((s, t) => s + (t.amount ?? 0), 0);
  const legacyRev     = completedWithoutTxn.reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalRevenue  = txnRevenue + legacyRev;
  const walkinTxns    = filteredTxns.filter(t => t.type === 'walkin');
  const walkinRev     = walkinTxns.reduce((s, t) => s + (t.amount ?? 0), 0);
  const reservedRev   = totalRevenue - walkinRev;
  const totalTxns    = filteredTxns.length;
  const totalResAll  = filteredRes.length;
  const completedRes = filteredRes.filter(r => r.status === 'Completed').length;

  const salesByDay = useMemo(() => {
    const map: Record<string, number> = {};
    DAYS.forEach(d => { map[d] = 0; });
    // Include recorded transactions
    filteredTxns.forEach(t => {
      const d = new Date(t.date);
      const k = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
      map[k] += t.amount;
    });
    // Include completed reservations without a transaction (legacy data)
    completedWithoutTxn.forEach(r => {
      const d = new Date(r.date);
      const k = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
      map[k] += r.amount;
    });
    return DAYS.map(day => ({ label: day, revenue: map[day] }));
  }, [filteredTxns, completedWithoutTxn]);

  const barberRevMap = useMemo(() => {
    const map: Record<string, number> = {};
    // From recorded transactions
    filteredTxns.forEach(t => { map[t.barber] = (map[t.barber] || 0) + t.amount; });
    // From legacy completed reservations (no transaction yet)
    completedWithoutTxn.forEach(r => { map[r.barber] = (map[r.barber] || 0) + r.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredTxns, completedWithoutTxn]);

  const svcCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    // From recorded transactions
    filteredTxns.forEach(t => {
      if (t.services && t.services.length > 0) {
        t.services.forEach(s => { map[s.name] = (map[s.name] || 0) + 1; });
      } else {
        map[t.service] = (map[t.service] || 0) + 1;
      }
    });
    // From legacy completed reservations
    completedWithoutTxn.forEach(r => {
      if (r.services && r.services.length > 0) {
        r.services.forEach(s => { map[s.name] = (map[s.name] || 0) + 1; });
      } else {
        map[r.service] = (map[r.service] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredTxns, completedWithoutTxn]);

  const maxRevDay = Math.max(...salesByDay.map(d => d.revenue), 1);
  const maxBarberRev = barberRevMap[0]?.[1] || 1;
  const maxSvcCount  = svcCountMap[0]?.[1] || 1;

  if (reservations.length === 0 && transactions.length === 0) {
    return (
      <Card style={{ padding: '3rem', textAlign: 'center' }}>
        <TrendingUp size={36} color="#D1D5DB" style={{ margin: '0 auto 0.875rem' }} />
        <p style={{ color: FG, fontWeight: 600, fontSize: '1.125rem', margin: '0 0 0.375rem' }}>No data yet</p>
        <p style={{ color: DIM, fontSize: '0.875rem', margin: 0 }}>Analytics will populate as reservations and sales are recorded.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── KPI Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total Revenue',       value: `₱${totalRevenue.toLocaleString()}`,  color: G,         icon: DollarSign },
          { label: 'Reservation Revenue', value: `₱${reservedRev.toLocaleString()}`,   color: BLUE,      icon: Calendar   },
          { label: 'Walk-In Revenue',     value: `₱${walkinRev.toLocaleString()}`,      color: '#8B5CF6', icon: Users      },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} style={{ padding: '1.125rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <p style={{ color: DIM, fontSize: '0.75rem', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                <div style={{ width: 28, height: 28, borderRadius: '0.5rem', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={13} color={s.color} /></div>
              </div>
              <p style={{ color: FG, fontWeight: 700, fontSize: '1.5rem', margin: 0 }}>{s.value}</p>
            </Card>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total Transactions',  value: totalTxns,                          color: G,         icon: DollarSign },
          { label: 'Walk-In Customers',   value: walkinTxns.length,                  color: '#8B5CF6', icon: Users      },
          { label: 'Total Reservations',  value: totalResAll,                        color: BLUE,      icon: Calendar   },
          { label: 'Completed',           value: completedRes,                       color: G,         icon: Check      },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} style={{ padding: '1.125rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <p style={{ color: DIM, fontSize: '0.75rem', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                <div style={{ width: 28, height: 28, borderRadius: '0.5rem', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={13} color={s.color} /></div>
              </div>
              <p style={{ color: FG, fontWeight: 700, fontSize: '1.5rem', margin: 0 }}>{s.value}</p>
            </Card>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setShowFilters(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', background: showFilters ? GREEN_BG : WHITE, border: `1px solid ${showFilters ? G : BDR}`, color: showFilters ? '#166534' : DIM, fontWeight: 500, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <Filter size={13} /> Filters {(filterBarber !== 'all' || filterService !== 'all') && <span style={{ background: G, color: '#fff', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.375rem' }}>On</span>}
        </button>
        {showFilters && (
          <>
            <select value={filterBarber} onChange={e => setFilterBarber(e.target.value)} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: `1px solid ${BDR}`, background: WHITE, color: FG, fontSize: '0.8125rem', outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <option value="all">All Barbers</option>
              {barbers.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            <select value={filterService} onChange={e => setFilterService(e.target.value)} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: `1px solid ${BDR}`, background: WHITE, color: FG, fontSize: '0.8125rem', outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <option value="all">All Services</option>
              {allServices.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(filterBarber !== 'all' || filterService !== 'all') && (
              <button onClick={() => { setFilterBarber('all'); setFilterService('all'); }} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <X size={12} /> Clear
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Interactive Analytics Calendar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selDate ? '1fr 340px' : '1fr', gap: '1rem', alignItems: 'start' }}>
        <Card style={{ padding: '1.375rem' }}>
          {/* Calendar header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ color: FG, fontWeight: 700, fontSize: '1.0625rem', margin: 0 }}>{MONTHS[calMonth]} {calYear}</h3>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); setSelDate(null); }}
                style={{ width: 32, height: 32, borderRadius: '0.5rem', background: LITE, border: `1px solid ${BDR}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={15} color={DIM} /></button>
              <button onClick={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); setSelDate(null); }}
                style={{ padding: '0 0.75rem', height: 32, borderRadius: '0.5rem', background: LITE, border: `1px solid ${BDR}`, cursor: 'pointer', color: DIM, fontSize: '0.75rem', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>Today</button>
              <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); setSelDate(null); }}
                style={{ width: 32, height: 32, borderRadius: '0.5rem', background: LITE, border: `1px solid ${BDR}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={15} color={DIM} /></button>
            </div>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '0.5rem' }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} style={{ textAlign: 'center', padding: '0.375rem 0', color: DIM, fontSize: '0.6875rem', fontWeight: 600 }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
            {Array.from({ length: calFirstMon }).map((_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: calDays }).map((_, i) => {
              const day  = i + 1;
              const ds   = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const data = dailyMap[ds];
              const isSel   = selDate === ds;
              const isToday = ds === today;
              const hasData = !!data && (data.revenue > 0 || data.resCount > 0);

              return (
                <button key={day} onClick={() => setSelDate(isSel ? null : ds)}
                  style={{
                    borderRadius: '0.5rem', padding: '0.5rem 0.25rem',
                    border: isSel ? `1.5px solid ${G}` : `1px solid ${hasData ? GREEN_BDR : 'transparent'}`,
                    background: isSel ? G : hasData ? GREEN_BG : isToday ? LITE : 'transparent',
                    cursor: 'pointer', textAlign: 'center', minHeight: 52,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                    transition: 'all 0.1s',
                  }}>
                  <span style={{ color: isSel ? '#fff' : isToday ? G : FG, fontWeight: isSel || isToday ? 700 : 400, fontSize: '0.875rem' }}>{day}</span>
                  {hasData && (
                    <>
                      {data.revenue > 0 && <span style={{ color: isSel ? 'rgba(255,255,255,0.85)' : '#166534', fontSize: '0.55rem', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>₱{data.revenue >= 1000 ? `${(data.revenue/1000).toFixed(1)}k` : data.revenue}</span>}
                      {data.resCount > 0 && <span style={{ color: isSel ? 'rgba(255,255,255,0.7)' : G, fontSize: '0.5rem', fontWeight: 500 }}>{data.resCount} appt{data.resCount > 1 ? 's' : ''}</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${BDR}` }}>
            {[
              { color: G, label: 'Selected' },
              { color: GREEN_BG, border: GREEN_BDR, label: 'Has activity' },
              { color: LITE, label: 'Today' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <div style={{ width: 14, height: 14, borderRadius: '0.25rem', background: l.color, border: l.border ? `1px solid ${l.border}` : 'none' }} />
                <span style={{ color: DIM, fontSize: '0.6875rem' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Daily Details Panel ── */}
        {selDate && selectedData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Card style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <p style={{ color: DIM, fontSize: '0.75rem', fontWeight: 500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Daily Report</p>
                  <h3 style={{ color: FG, fontWeight: 700, fontSize: '1.0625rem', margin: '0.125rem 0 0' }}>{selDate}</h3>
                </div>
                <button onClick={() => setSelDate(null)} style={{ width: 28, height: 28, borderRadius: '50%', background: LITE, border: `1px solid ${BDR}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} color={DIM} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Revenue',       value: `₱${selectedData.revenue.toLocaleString()}`, color: G },
                  { label: 'Total Served',  value: selectedData.totalServed,                     color: BLUE },
                  { label: 'Reserved',      value: selectedData.reservedCount,                   color: BLUE },
                  { label: 'Walk-Ins',      value: selectedData.walkinCount,                     color: '#8B5CF6' },
                  { label: 'Completed',     value: selectedData.completed,                       color: G },
                  { label: 'Cancelled',     value: selectedData.cancelled,                       color: ERR },
                ].map(s => (
                  <div key={s.label} style={{ padding: '0.625rem 0.75rem', background: LITE, borderRadius: '0.5rem', border: `1px solid ${BDR}` }}>
                    <p style={{ color: DIM, fontSize: '0.6875rem', fontWeight: 500, margin: '0 0 0.2rem' }}>{s.label}</p>
                    <p style={{ color: s.color, fontWeight: 700, fontSize: '1rem', margin: 0 }}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ padding: '0.625rem 0.75rem', background: LITE, borderRadius: '0.5rem', border: `1px solid ${BDR}`, marginBottom: '1rem' }}>
                <p style={{ color: DIM, fontSize: '0.6875rem', margin: '0 0 0.2rem' }}>Top Barber</p>
                <p style={{ color: FG, fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{selectedData.topBarber}</p>
              </div>

              {selectedData.topServices.length > 0 && (
                <div>
                  <p style={{ color: DIM, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>Services</p>
                  {selectedData.topServices.map(s => (
                    <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: `1px solid ${BDR}` }}>
                      <span style={{ color: FG, fontSize: '0.8125rem' }}>{s.name}</span>
                      <span style={{ color: G, fontWeight: 600, fontSize: '0.8125rem' }}>{s.count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Transaction list */}
            {selectedData.transactions.length > 0 && (
              <Card style={{ padding: '1.125rem' }}>
                <p style={{ color: DIM, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.625rem' }}>Transactions</p>
                {selectedData.transactions.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: i < selectedData.transactions.length - 1 ? `1px solid ${BDR}` : 'none' }}>
                    <div>
                      <p style={{ color: FG, fontWeight: 500, fontSize: '0.8125rem', margin: 0 }}>{t.customer}</p>
                      <p style={{ color: DIM, fontSize: '0.75rem', margin: '0.1rem 0 0' }}>{t.service} · {t.barber}</p>
                    </div>
                    <span style={{ color: G, fontWeight: 700, fontSize: '0.9rem' }}>₱{t.amount}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ── Analytics Widgets ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Revenue by day of week */}
        <Card style={{ padding: '1.25rem' }}>
          <h3 style={{ color: FG, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1.25rem' }}>Revenue by Day of Week</h3>
          {totalRevenue === 0 ? <p style={{ color: DIM, fontSize: '0.875rem' }}>No sales yet</p> : <BarChartCSS data={salesByDay} labelKey="label" valueKey="revenue" color={G} formatValue={v => v >= 1000 ? `₱${(v/1000).toFixed(1)}k` : `₱${v}`} />}
        </Card>

        {/* Barber performance ranking */}
        <Card style={{ padding: '1.25rem' }}>
          <h3 style={{ color: FG, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1.25rem' }}>Barber Revenue Ranking</h3>
          {barberRevMap.length === 0 ? <p style={{ color: DIM, fontSize: '0.875rem' }}>No data yet</p>
            : barberRevMap.map(([name, rev], i) => {
                const barberInfo = barbers.find(b => b.name === name);
                return (
                  <div key={name} style={{ marginBottom: i < barberRevMap.length - 1 ? '0.875rem' : 0 }}>
                    <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#9CA3AF', fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', fontWeight: 700, width: 20 }}>#{i+1}</span>
                      {barberInfo && <img src={barberInfo.photo} alt={name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />}
                      <span style={{ color: FG, fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{name.split(' ')[0]}</span>
                      <span style={{ color: G, fontWeight: 700, fontSize: '0.875rem' }}>₱{rev.toLocaleString()}</span>
                    </div>
                    <div style={{ marginLeft: 44, height: 4, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(rev / maxBarberRev) * 100}%`, background: i === 0 ? '#F59E0B' : G, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })
          }
        </Card>
      </div>

      {/* Service popularity */}
      <Card style={{ padding: '1.25rem' }}>
        <h3 style={{ color: FG, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1.25rem' }}>Service Popularity Ranking</h3>
        {svcCountMap.length === 0 ? <p style={{ color: DIM, fontSize: '0.875rem' }}>No data yet</p>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.875rem' }}>
              {svcCountMap.map(([name, count], i) => (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: '#9CA3AF', fontFamily: 'DM Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, width: 18 }}>#{i+1}</span>
                      <span style={{ color: FG, fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    </div>
                    <span style={{ color: G, fontWeight: 700, fontSize: '0.875rem', marginLeft: '0.5rem', flexShrink: 0 }}>{count}x</span>
                  </div>
                  <div style={{ marginLeft: 26, height: 4, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / maxSvcCount) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
        }
      </Card>

      {/* Customer growth */}
      <Card style={{ padding: '1.25rem' }}>
        <h3 style={{ color: FG, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1rem' }}>Customer Metrics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Total Customers',       value: customers.length,                                                          color: BLUE },
            { label: 'Repeat Customers',       value: customers.filter(c => c.totalVisits > 1).length,                          color: G },
            { label: 'Avg Visits / Customer',  value: customers.length ? (customers.reduce((s, c) => s + c.totalVisits, 0) / customers.length).toFixed(1) : '0', color: '#8B5CF6' },
          ].map(m => (
            <div key={m.label} style={{ padding: '1rem', borderRadius: '0.625rem', background: LITE, border: `1px solid ${BDR}`, textAlign: 'center' }}>
              <p style={{ color: m.color, fontWeight: 800, fontSize: '1.5rem', margin: '0 0 0.25rem' }}>{m.value}</p>
              <p style={{ color: DIM, fontSize: '0.75rem', margin: 0 }}>{m.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
