import { useState } from 'react';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import logoImg from '../../imports/logo.png';

const G    = '#16A34A';
const DARK = '#111827';
const MID  = '#6B7280';
const BDR  = '#E5E7EB';
const LITE = '#F9FAFB';

interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: React.FC<{ size: number; color: string; strokeWidth: number }>;
  badge?: number;
}

interface Props<T extends string> {
  nav: T;
  setNav: (n: T) => void;
  items: NavItem<T>[];
  userName: string;
  userRole: string;
  userPhoto?: string;
  onLogout: () => void;
  bottomSlot?: React.ReactNode;
}

export function Sidebar<T extends string>({ nav, setNav, items, userName, userRole, userPhoto, onLogout, bottomSlot }: Props<T>) {
  const [collapsed, setCollapsed] = useState(false);

  const W = collapsed ? 64 : 220;

  return (
    <aside style={{
      width: W, flexShrink: 0,
      background: '#FFFFFF',
      borderRight: `1px solid ${BDR}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>
      {/* Brand */}
      <div style={{
        padding: collapsed ? '1rem 0' : '1.125rem 1.125rem 1rem',
        borderBottom: `1px solid ${BDR}`,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '0.625rem',
        transition: 'padding 0.2s',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: '0.625rem', background: '#F0FDF4', border: `1px solid #BBF7D0`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          <img src={logoImg} alt="" style={{ width: 36, height: 36, objectFit: 'contain', mixBlendMode: 'multiply' }} />
        </div>
        {!collapsed && (
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <p style={{ color: DARK, fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.2, fontFamily: 'Inter, sans-serif', margin: 0, whiteSpace: 'nowrap' }}>SmartCut</p>
            <p style={{ color: G, fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', margin: 0 }}>Barbershop</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? '0.75rem 0.5rem' : '0.75rem 0.625rem', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', overflowX: 'hidden' }}>
        {items.map(item => {
          const Icon = item.icon;
          const active = nav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setNav(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : '0.625rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '0.625rem' : '0.5625rem 0.75rem',
                borderRadius: '0.625rem',
                background: active ? '#F0FDF4' : 'transparent',
                border: 'none', cursor: 'pointer',
                width: '100%',
                color: active ? G : MID,
                fontWeight: active ? 600 : 400,
                fontSize: '0.875rem',
                transition: 'all 0.12s',
                fontFamily: 'Inter, sans-serif',
                position: 'relative',
              }}
            >
              <Icon size={16} color={active ? G : '#9CA3AF'} strokeWidth={active ? 2.5 : 2} />
              {!collapsed && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
              {(item.badge ?? 0) > 0 && !collapsed && (
                <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: '999px', fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.4rem', lineHeight: 1.5 }}>{item.badge}</span>
              )}
              {/* Collapsed badge dot */}
              {(item.badge ?? 0) > 0 && collapsed && (
                <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: G }} />
              )}
            </button>
          );
        })}
      </nav>

      {bottomSlot && !collapsed && <div style={{ padding: '0 0.625rem 0.5rem' }}>{bottomSlot}</div>}

      {/* Collapse toggle */}
      <div style={{ padding: '0.5rem', borderTop: `1px solid ${BDR}` }}>
        <button
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%', padding: '0.4375rem',
            borderRadius: '0.5rem',
            background: LITE, border: `1px solid ${BDR}`,
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: MID, gap: collapsed ? 0 : '0.375rem',
            fontSize: '0.75rem', fontFamily: 'Inter, sans-serif',
            transition: 'background 0.12s',
          }}
        >
          {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Collapse</span></>}
        </button>
      </div>

      {/* User — only when expanded */}
      {!collapsed && (
        <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${BDR}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            {userPhoto
              ? <img src={userPhoto} alt={userName} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F0FDF4', border: `1.5px solid #BBF7D0`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: G, fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{userName.charAt(0)}</span>
                </div>
            }
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ color: DARK, fontWeight: 600, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif', margin: 0 }}>{userName}</p>
              <p style={{ color: MID, fontSize: '0.6875rem', fontFamily: 'Inter, sans-serif', margin: 0 }}>{userRole}</p>
            </div>
          </div>
          <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4375rem 0.625rem', borderRadius: '0.5rem', background: 'transparent', border: `1px solid ${BDR}`, cursor: 'pointer', color: MID, fontSize: '0.8125rem', fontWeight: 500, width: '100%', fontFamily: 'Inter, sans-serif', transition: 'background 0.12s' }}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      )}

      {/* Collapsed user avatar + logout */}
      {collapsed && (
        <div style={{ padding: '0.5rem', borderTop: `1px solid ${BDR}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
          {userPhoto
            ? <img src={userPhoto} alt={userName} title={userName} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${BDR}` }} />
            : <div title={userName} style={{ width: 30, height: 30, borderRadius: '50%', background: '#F0FDF4', border: `1.5px solid #BBF7D0`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: G, fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{userName.charAt(0)}</span>
              </div>
          }
          <button onClick={onLogout} title="Sign Out" style={{ width: 30, height: 30, borderRadius: '0.5rem', background: LITE, border: `1px solid ${BDR}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MID }}>
            <LogOut size={13} />
          </button>
        </div>
      )}
    </aside>
  );
}
