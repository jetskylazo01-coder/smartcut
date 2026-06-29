import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check, CheckCheck, Info, Calendar, AlertTriangle, Gift, Settings } from 'lucide-react';
import { notifications as allNotifications } from '../data/mockData';
import type { Notification, NotifType } from '../data/mockData';

const G = '#1b8032';
const CARD = '#0e1410';
const FG = '#eef4ee';
const MUTED = '#75897a';
const SEC = '#172018';
const BORDER = 'rgba(255,255,255,0.07)';

interface Props {
  customerId?: number;
  showAll?: boolean;
}

const typeConfig: Record<NotifType, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  confirmation: { icon: Check,         color: G,         bg: `${G}18`,         label: 'Confirmed' },
  reminder:     { icon: Calendar,      color: '#3a7dc0', bg: 'rgba(58,125,192,0.12)', label: 'Reminder' },
  cancellation: { icon: AlertTriangle, color: '#cc3333', bg: 'rgba(204,51,51,0.12)',  label: 'Cancelled' },
  promo:        { icon: Gift,          color: '#d4a020', bg: 'rgba(212,160,32,0.12)', label: 'Promo' },
  system:       { icon: Settings,      color: MUTED,     bg: 'rgba(255,255,255,0.05)', label: 'System' },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationCenter({ customerId, showAll = false }: Props) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>(
    showAll
      ? [...allNotifications]
      : allNotifications.filter(n => !customerId || n.customerId === customerId || !n.customerId)
  );
  const [filterType, setFilterType] = useState<NotifType | 'all'>('all');

  const unread = notifs.filter(n => !n.read).length;

  const markRead = (id: string) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  const dismiss = (id: string) => setNotifs(prev => prev.filter(n => n.id !== id));

  const filtered = notifs.filter(n => filterType === 'all' || n.type === filterType);

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative', width: 38, height: 38, borderRadius: '0.625rem', background: open ? 'rgba(27,128,50,0.15)' : SEC, border: open ? `1px solid ${G}44` : `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
      >
        <Bell size={16} color={open ? G : MUTED} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#cc3333', border: '1.5px solid #07090a' }} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: 'absolute', top: '110%', right: 0, width: 360, maxHeight: 480, background: '#0a0f0b', border: `1px solid ${G}33`, borderRadius: '1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              {/* Header */}
              <div style={{ padding: '1rem 1.125rem 0.75rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <Bell size={16} color={G} />
                  <span style={{ color: FG, fontWeight: 700, fontSize: '0.9375rem' }}>Notifications</span>
                  {unread > 0 && (
                    <span style={{ padding: '0.1rem 0.5rem', borderRadius: '2rem', background: '#cc3333', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{unread}</span>
                  )}
                </div>
                <button onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: G, fontSize: '0.75rem', fontWeight: 600 }}>
                  <CheckCheck size={13} /> Mark all read
                </button>
              </div>

              {/* Filter chips */}
              <div style={{ display: 'flex', gap: '0.375rem', padding: '0.75rem 1rem', overflowX: 'auto', flexShrink: 0, borderBottom: `1px solid ${BORDER}` }}>
                {(['all', 'confirmation', 'reminder', 'promo', 'cancellation', 'system'] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    style={{ padding: '0.25rem 0.75rem', borderRadius: '2rem', border: filterType === t ? `1px solid ${G}` : `1px solid ${BORDER}`, background: filterType === t ? `${G}18` : 'transparent', color: filterType === t ? G : MUTED, fontSize: '0.75rem', fontWeight: filterType === t ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                    {t === 'all' ? 'All' : typeConfig[t].label}
                  </button>
                ))}
              </div>

              {/* Notifications list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <Bell size={28} color="#2b3d2d" style={{ margin: '0 auto 0.75rem' }} />
                    <p style={{ color: MUTED, fontSize: '0.875rem' }}>No notifications</p>
                  </div>
                ) : (
                  filtered.map(n => {
                    const cfg = typeConfig[n.type];
                    const Icon = cfg.icon;
                    return (
                      <div key={n.id}
                        style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 1.125rem', background: n.read ? 'transparent' : 'rgba(27,128,50,0.04)', borderLeft: n.read ? '3px solid transparent' : `3px solid ${G}`, transition: 'background 0.15s', cursor: 'pointer' }}
                        onClick={() => markRead(n.id)}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.125rem' }}>
                          <Icon size={16} color={cfg.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <p style={{ color: n.read ? MUTED : FG, fontWeight: n.read ? 400 : 600, fontSize: '0.875rem', lineHeight: 1.3 }}>{n.title}</p>
                            <button onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2b3d2d', display: 'flex', flexShrink: 0, marginLeft: '0.5rem', padding: '0.125rem' }}>
                              <X size={12} />
                            </button>
                          </div>
                          <p style={{ color: MUTED, fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: 1.4 }}>{n.message}</p>
                          <p style={{ color: '#2b3d2d', fontSize: '0.7rem', marginTop: '0.375rem', fontFamily: 'DM Mono, monospace' }}>{timeAgo(n.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
