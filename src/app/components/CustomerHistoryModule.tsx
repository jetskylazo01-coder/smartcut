import { Star, Scissors, Trophy, TrendingUp, User, Repeat } from 'lucide-react';
import type { DBCustomer, DBReservation, DBBarber } from '../../lib/db';

const G = '#16A34A';
const CARD = '#FFFFFF';
const FG = '#111827';
const MUTED = '#6B7280';
const SEC = '#F3F4F6';
const BORDER = '#E5E7EB';
const SHADOW = '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)';

const LOYALTY_CONFIG: Record<string, { color: string; next?: string; min: number; max: number }> = {
  Bronze:   { color: '#cd7f32', min: 0,  max: 9,   next: 'Silver' },
  Silver:   { color: '#a8a9ad', min: 10, max: 19,  next: 'Gold' },
  Gold:     { color: '#d4a020', min: 20, max: 29,  next: 'Platinum' },
  Platinum: { color: '#1b8032', min: 30, max: 999 },
};

const SERVICE_ICON: Record<string, string> = {
  'Regular Haircut': '✂️', 'Ordinary Cut': '✂️', 'Kapogi Package': '💎',
  'Daily Blendz Premium': '⭐', 'Quick Shave': '🪒', 'Full Beard Shave': '🪒',
  'Regular Hair Color': '🎨', 'Fashion Hair Color': '🎨', 'Braids': '🪢',
  'Perm / Curl': '🌀', 'Ear Cleaning': '👂', 'Facial Cleansing': '✨', 'Scalp Treatment': '💆',
};

interface Props {
  customer: DBCustomer;
  reservations: DBReservation[];
  barbers: DBBarber[];
}

export function CustomerHistoryModule({ customer, reservations, barbers }: Props) {
  const tier = customer.loyaltyTier || 'Bronze';
  const tierInfo = LOYALTY_CONFIG[tier] ?? LOYALTY_CONFIG.Bronze;
  const nextTier = tierInfo.next ? LOYALTY_CONFIG[tierInfo.next] : null;
  const progress = nextTier
    ? Math.min(((customer.totalVisits - tierInfo.min) / (tierInfo.max - tierInfo.min + 1)) * 100, 100)
    : 100;

  // Compute preferred barber from reservations
  const barberCount: Record<string, number> = {};
  reservations.forEach(r => { if (r.status === 'Completed') barberCount[r.barberId] = (barberCount[r.barberId] || 0) + 1; });
  const preferredBarberId = Object.entries(barberCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const preferredBarber = barbers.find(b => b.id === preferredBarberId);

  // Compute frequent services
  const svcCount: Record<string, number> = {};
  reservations.forEach(r => { if (r.status === 'Completed') svcCount[r.service] = (svcCount[r.service] || 0) + 1; });
  const frequentServices = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([service, count]) => ({ service, count }));
  const maxCount = frequentServices[0]?.count || 1;

  // History timeline — completed reservations only
  const history = reservations.filter(r => r.status === 'Completed').slice(0, 10);

  const TierBadge = ({ t }: { t: string }) => {
    const c = LOYALTY_CONFIG[t]?.color ?? G;
    const emoji = t === 'Platinum' ? '💎' : t === 'Gold' ? '🥇' : t === 'Silver' ? '🥈' : '🥉';
    return (
      <span style={{ padding: '0.2rem 0.75rem', borderRadius: '2rem', background: `${c}22`, color: c, fontWeight: 700, fontSize: '0.8rem', border: `1px solid ${c}44` }}>
        {emoji} {t}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Loyalty Card */}
      <div style={{ background: CARD, border: `1px solid ${tierInfo.color}44`, borderRadius: '1.25rem', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `${tierInfo.color}08` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <p style={{ color: MUTED, fontSize: '0.8125rem', fontWeight: 500 }}>Loyalty Status</p>
            <div style={{ marginTop: '0.375rem' }}><TierBadge t={tier} /></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: MUTED, fontSize: '0.75rem' }}>Points Balance</p>
            <p style={{ color: tierInfo.color, fontWeight: 700, fontSize: '1.5rem' }}>{customer.loyaltyPoints}</p>
          </div>
        </div>

        {nextTier && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: MUTED, fontSize: '0.75rem' }}>{customer.totalVisits} visits</span>
              <span style={{ color: MUTED, fontSize: '0.75rem' }}>{tierInfo.max + 1} for {tierInfo.next}</span>
            </div>
            <div style={{ height: 6, background: SEC, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: tierInfo.color, borderRadius: 6, transition: 'width 0.6s ease' }} />
            </div>
            <p style={{ color: MUTED, fontSize: '0.75rem', marginTop: '0.375rem' }}>
              {(tierInfo.max + 1) - customer.totalVisits} more visits to reach <span style={{ color: nextTier.color, fontWeight: 600 }}>{tierInfo.next}</span>
            </p>
          </div>
        )}
        {!nextTier && <p style={{ color: tierInfo.color, fontSize: '0.8125rem', fontWeight: 600, marginTop: '0.5rem' }}>🎉 Maximum tier — you enjoy all benefits!</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: `1px solid ${BORDER}` }}>
          {[
            { icon: Trophy,    label: 'Total Visits',  value: customer.totalVisits,                      color: tierInfo.color },
            { icon: Repeat,    label: 'Visit Streak',  value: `${customer.visitStreak} wks`,             color: G },
            { icon: TrendingUp,label: 'Total Spent',   value: `₱${customer.totalSpent.toLocaleString()}`, color: '#3a7dc0' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem' }}>
                  <Icon size={16} color={s.color} />
                </div>
                <p style={{ color: s.color, fontWeight: 700, fontSize: '1rem' }}>{s.value}</p>
                <p style={{ color: MUTED, fontSize: '0.7rem', marginTop: '0.125rem' }}>{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Preferred Barber */}
        <div style={{ background: CARD, borderRadius: '1rem', padding: '1.25rem', boxShadow: SHADOW }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <User size={16} color={G} />
            <p style={{ color: FG, fontWeight: 600, fontSize: '0.9375rem' }}>Preferred Barber</p>
          </div>
          {preferredBarber ? (
            <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
              <img src={preferredBarber.photo} alt={preferredBarber.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${G}44` }} />
              <div>
                <p style={{ color: FG, fontWeight: 600 }}>{preferredBarber.name}</p>
                <p style={{ color: MUTED, fontSize: '0.75rem', marginTop: '0.125rem' }}>{preferredBarber.speciality}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.375rem' }}>
                  <Star size={11} fill={G} color={G} />
                  <span style={{ color: G, fontSize: '0.75rem', fontWeight: 600 }}>{preferredBarber.rating}</span>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: MUTED, fontSize: '0.875rem' }}>Complete a booking to set your preference.</p>
          )}
        </div>

        {/* Top Services */}
        <div style={{ background: CARD, borderRadius: '1rem', padding: '1.25rem', boxShadow: SHADOW }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Scissors size={16} color={G} />
            <p style={{ color: FG, fontWeight: 600, fontSize: '0.9375rem' }}>Top Services</p>
          </div>
          {frequentServices.length === 0
            ? <p style={{ color: MUTED, fontSize: '0.875rem' }}>No completed bookings yet.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {frequentServices.map((s, i) => (
                  <div key={s.service}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ color: FG, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {SERVICE_ICON[s.service] ?? '✂️'} {s.service}
                      </span>
                      <span style={{ color: G, fontWeight: 600, fontSize: '0.8125rem' }}>{s.count}x</span>
                    </div>
                    <div style={{ height: 4, background: SEC, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(s.count / maxCount) * 100}%`, background: i === 0 ? G : '#56b86e', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Service History Timeline */}
      <div style={{ background: CARD, borderRadius: '1rem', padding: '1.25rem', boxShadow: SHADOW }}>
        <p style={{ color: FG, fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1.25rem' }}>Service History</p>
        {history.length === 0
          ? <p style={{ color: MUTED, fontSize: '0.875rem' }}>Your completed appointments will appear here.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', paddingBottom: i < history.length - 1 ? '1rem' : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: G, border: `2px solid ${G}44`, marginTop: '0.375rem' }} />
                    {i < history.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 24, background: `${G}22`, marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: i < history.length - 1 ? '0.5rem' : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ color: FG, fontWeight: 600, fontSize: '0.9rem' }}>
                          {SERVICE_ICON[r.service] ?? '✂️'} {r.service}
                        </p>
                        <p style={{ color: MUTED, fontSize: '0.8125rem', marginTop: '0.125rem' }}>with {r.barber}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: G, fontWeight: 700 }}>₱{r.amount}</p>
                        <p style={{ color: MUTED, fontSize: '0.75rem' }}>{r.date}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
