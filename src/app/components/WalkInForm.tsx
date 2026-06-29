import { useState } from 'react';
import { Check, Clock, X, User, Phone, Scissors, Calendar, CreditCard, FileText, Plus, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { recordWalkIn } from '../../lib/db';
import { fmt12 } from '../../lib/timeFormat';
import type { DBBarber, DBService, DBServiceItem } from '../../lib/db';

interface Props {
  barbers: DBBarber[];
  services: DBService[];
  /** If provided, locks the barber field to this barber (used in Barber Dashboard) */
  lockedBarberId?: string;
  onSuccess?: () => void;
}

const TIME_SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30',
  '17:00','17:30','18:00',
];

// Design tokens
const G         = '#16A34A';
const DARK      = '#111827';
const MID       = '#6B7280';
const WHITE     = '#FFFFFF';
const BDR       = '#E5E7EB';
const LITE      = '#F9FAFB';
const GREEN_BG  = '#F0FDF4';
const GREEN_BDR = '#BBF7D0';
const ERR       = '#EF4444';
const SHADOW    = '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)';

const inp: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem',
  borderRadius: '0.5rem', border: `1px solid ${BDR}`,
  background: WHITE, color: DARK,
  fontSize: '0.875rem', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

function FieldLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
      <Icon size={13} color={MID} />
      <label style={{ color: DARK, fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>{label}</label>
    </div>
  );
}

export function WalkInForm({ barbers, services, lockedBarberId, onSuccess }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [barberId, setBarberId]           = useState(lockedBarberId ?? barbers[0]?.id ?? '');
  const [selSvcs, setSelSvcs]             = useState<DBService[]>([]);
  const [date, setDate]                   = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime]                   = useState(() => {
    // Round to nearest 30-min slot
    const now = new Date();
    const mins = now.getMinutes() < 30 ? 30 : 0;
    const hrs  = mins === 0 ? now.getHours() + 1 : now.getHours();
    const slot = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
    return TIME_SLOTS.includes(slot) ? slot : TIME_SLOTS[0];
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);

  const selectedBarber = barbers.find(b => b.id === barberId);
  const totalPrice    = selSvcs.reduce((s, x) => s + x.price, 0);
  const totalDuration = selSvcs.reduce((s, x) => s + x.duration, 0);

  const toggleSvc = (svc: DBService) => {
    setSelSvcs(prev =>
      prev.find(s => s.id === svc.id)
        ? prev.filter(s => s.id !== svc.id)
        : [...prev, svc]
    );
  };

  const handleSave = async () => {
    if (!customerName.trim()) { toast.error('Customer name is required.'); return; }
    if (!barberId) { toast.error('Please select a barber.'); return; }
    if (selSvcs.length === 0) { toast.error('Please select at least one service.'); return; }
    setSaving(true);
    try {
      const serviceItems: DBServiceItem[] = selSvcs.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration }));
      await recordWalkIn({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        barberId,
        barber: selectedBarber?.name ?? '',
        services: serviceItems,
        date, time, paymentMethod,
        notes: notes.trim(),
      });
      toast.success(`Walk-in recorded — ₱${totalPrice.toLocaleString()}`);
      // Reset form
      setCustomerName(''); setCustomerPhone(''); setSelSvcs([]);
      setDate(new Date().toISOString().split('T')[0]);
      setTime(new Date().toTimeString().slice(0, 5));
      setNotes(''); setPaymentMethod('Cash');
      if (!lockedBarberId) setBarberId(barbers[0]?.id ?? '');
      onSuccess?.();
    } catch (e: any) { toast.error(e.message ?? 'Failed to record walk-in.'); }
    setSaving(false);
  };

  const daily  = services.filter(s => s.isActive && s.category !== 'Other');
  const others = services.filter(s => s.isActive && s.category === 'Other');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>

      {/* ── Left: Form ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Customer info */}
        <div style={{ background: WHITE, borderRadius: '0.875rem', border: `1px solid ${BDR}`, boxShadow: SHADOW, padding: '1.25rem' }}>
          <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1rem' }}>Customer Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <FieldLabel icon={User} label="Customer Name *" />
              <input style={inp} value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Juan dela Cruz"
                onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}18`; }}
                onBlur={e => { e.target.style.borderColor = BDR; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div>
              <FieldLabel icon={Phone} label="Phone Number (optional)" />
              <input style={inp} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                placeholder="09XXXXXXXXX"
                onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}18`; }}
                onBlur={e => { e.target.style.borderColor = BDR; e.target.style.boxShadow = 'none'; }} />
            </div>
          </div>
        </div>

        {/* Barber + Date/Time */}
        <div style={{ background: WHITE, borderRadius: '0.875rem', border: `1px solid ${BDR}`, boxShadow: SHADOW, padding: '1.25rem' }}>
          <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 1rem' }}>Appointment Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <FieldLabel icon={Scissors} label="Barber *" />
              {lockedBarberId ? (
                <div style={{ ...inp, background: LITE, color: MID, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedBarber?.photo && <img src={selectedBarber.photo} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />}
                  {selectedBarber?.name ?? '—'}
                </div>
              ) : (
                <select value={barberId} onChange={e => setBarberId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <FieldLabel icon={Calendar} label="Date *" />
              <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)}
                onFocus={e => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G}18`; }}
                onBlur={e => { e.target.style.borderColor = BDR; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ position: 'relative' }}>
              <FieldLabel icon={Clock} label="Time *" />
              {/* Time slot picker — click to open dropdown */}
              <button type="button" onClick={() => setShowTimePicker(v => !v)}
                style={{ ...inp, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderColor: showTimePicker ? G : BDR, boxShadow: showTimePicker ? `0 0 0 3px ${G}18` : 'none', userSelect: 'none' }}>
                <span style={{ color: DARK, fontWeight: 500 }}>{fmt12(time)}</span>
                <ChevronDown size={15} color={MID} style={{ transform: showTimePicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {showTimePicker && (
                <>
                  <div onClick={() => setShowTimePicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.25rem', background: WHITE, border: `1px solid ${BDR}`, borderRadius: '0.625rem', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, padding: '0.5rem', maxHeight: 240, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem' }}>
                    {TIME_SLOTS.map(t => (
                      <button key={t} type="button"
                        onClick={() => { setTime(t); setShowTimePicker(false); }}
                        style={{ padding: '0.4375rem', borderRadius: '0.375rem', border: `1px solid ${t === time ? G : BDR}`, background: t === time ? '#F0FDF4' : WHITE, color: t === time ? '#166534' : DARK, fontWeight: t === time ? 700 : 400, fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 0.1s' }}>
                        {fmt12(t)}
                      </button>
                    ))}
                  </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <FieldLabel icon={CreditCard} label="Payment Method" />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['Cash', 'GCash', 'Maya', 'Card'].map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  style={{ padding: '0.4375rem 0.875rem', borderRadius: '0.375rem', border: `1px solid ${paymentMethod === m ? G : BDR}`, background: paymentMethod === m ? GREEN_BG : WHITE, color: paymentMethod === m ? '#166534' : MID, fontWeight: paymentMethod === m ? 600 : 400, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.12s' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Services */}
        <div style={{ background: WHITE, borderRadius: '0.875rem', border: `1px solid ${BDR}`, boxShadow: SHADOW, padding: '1.25rem' }}>
          <h3 style={{ color: DARK, fontWeight: 600, fontSize: '0.9375rem', margin: '0 0 0.25rem' }}>Services *</h3>
          <p style={{ color: MID, fontSize: '0.8125rem', margin: '0 0 1rem' }}>Select one or more services</p>

          {daily.length > 0 && (
            <>
              <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>Daily Services</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
                {daily.map(s => {
                  const sel = !!selSvcs.find(x => x.id === s.id);
                  return (
                    <button key={s.id} onClick={() => toggleSvc(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.875rem', borderRadius: '0.625rem', border: `1px solid ${sel ? G : BDR}`, background: sel ? GREEN_BG : WHITE, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '0.25rem', border: `2px solid ${sel ? G : BDR}`, background: sel ? G : WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {sel && <Check size={10} color="#fff" />}
                      </div>
                      <span style={{ color: sel ? '#166534' : DARK, fontWeight: sel ? 600 : 400, fontSize: '0.875rem', flex: 1, fontFamily: 'Inter, sans-serif' }}>{s.name}</span>
                      <span style={{ color: G, fontWeight: 700, fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>₱{s.price}</span>
                      <span style={{ color: MID, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}><Clock size={11} />{s.duration}m</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {others.length > 0 && (
            <>
              <p style={{ color: MID, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>Other Services</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {others.map(s => {
                  const sel = !!selSvcs.find(x => x.id === s.id);
                  return (
                    <button key={s.id} onClick={() => toggleSvc(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.875rem', borderRadius: '0.625rem', border: `1px solid ${sel ? G : BDR}`, background: sel ? GREEN_BG : WHITE, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '0.25rem', border: `2px solid ${sel ? G : BDR}`, background: sel ? G : WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {sel && <Check size={10} color="#fff" />}
                      </div>
                      <span style={{ color: sel ? '#166534' : DARK, fontWeight: sel ? 600 : 400, fontSize: '0.875rem', flex: 1, fontFamily: 'Inter, sans-serif' }}>{s.name}</span>
                      <span style={{ color: G, fontWeight: 700, fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>₱{s.price}</span>
                      <span style={{ color: MID, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}><Clock size={11} />{s.duration}m</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Notes */}
        <div style={{ background: WHITE, borderRadius: '0.875rem', border: `1px solid ${BDR}`, boxShadow: SHADOW, padding: '1.25rem' }}>
          <FieldLabel icon={FileText} label="Notes (optional)" />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requests or notes…" rows={3}
            style={{ ...inp, resize: 'vertical', minHeight: 72 }}
            onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = G; (e.target as HTMLTextAreaElement).style.boxShadow = `0 0 0 3px ${G}18`; }}
            onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BDR; (e.target as HTMLTextAreaElement).style.boxShadow = 'none'; }} />
        </div>
      </div>

      {/* ── Right: Sticky Summary ── */}
      <div style={{ position: 'sticky', top: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Summary card */}
        <div style={{ background: WHITE, borderRadius: '0.875rem', border: `1px solid ${BDR}`, boxShadow: SHADOW, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: selSvcs.length > 0 ? G : BDR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: '0.6875rem', fontWeight: 700 }}>{selSvcs.length}</span>
            </div>
            <h3 style={{ color: DARK, fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>Transaction Summary</h3>
          </div>

          {/* Customer preview */}
          {customerName && (
            <div style={{ padding: '0.625rem 0.75rem', background: LITE, borderRadius: '0.5rem', border: `1px solid ${BDR}`, marginBottom: '0.875rem' }}>
              <p style={{ color: MID, fontSize: '0.6875rem', margin: '0 0 0.125rem' }}>Walk-In Customer</p>
              <p style={{ color: DARK, fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{customerName}</p>
              {customerPhone && <p style={{ color: MID, fontSize: '0.75rem', margin: '0.125rem 0 0' }}>{customerPhone}</p>}
            </div>
          )}

          {/* Barber preview */}
          {selectedBarber && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', borderBottom: `1px solid ${BDR}`, marginBottom: '0.625rem' }}>
              <img src={selectedBarber.photo} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
              <span style={{ color: DARK, fontSize: '0.8125rem', fontWeight: 500 }}>{selectedBarber.name}</span>
              <span style={{ color: MID, fontSize: '0.75rem', marginLeft: 'auto' }}>{date} {fmt12(time)}</span>
            </div>
          )}

          {selSvcs.length === 0 ? (
            <p style={{ color: MID, fontSize: '0.8125rem', textAlign: 'center', padding: '0.875rem 0' }}>No services selected yet</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.875rem' }}>
                {selSvcs.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1, minWidth: 0 }}>
                      <button onClick={() => toggleSvc(s)} style={{ width: 14, height: 14, borderRadius: '50%', background: '#FEE2E2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={8} color="#991B1B" /></button>
                      <span style={{ color: DARK, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    </div>
                    <span style={{ color: G, fontWeight: 600, fontSize: '0.8125rem', marginLeft: '0.5rem', flexShrink: 0 }}>₱{s.price}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${BDR}`, paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: MID, fontSize: '0.8125rem' }}>Duration</span>
                  <span style={{ color: DARK, fontWeight: 600, fontSize: '0.8125rem' }}>{totalDuration} min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: MID, fontSize: '0.8125rem' }}>Payment</span>
                  <span style={{ color: DARK, fontWeight: 600, fontSize: '0.8125rem' }}>{paymentMethod}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span style={{ color: DARK, fontWeight: 700, fontSize: '1rem' }}>Total</span>
                  <span style={{ color: G, fontWeight: 800, fontSize: '1.25rem' }}>₱{totalPrice.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action button */}
        <button onClick={handleSave} disabled={saving || !customerName.trim() || selSvcs.length === 0 || !barberId}
          style={{
            width: '100%', padding: '0.875rem',
            borderRadius: '0.625rem',
            background: saving || !customerName.trim() || selSvcs.length === 0 ? '#86EFAC' : G,
            color: '#fff', fontWeight: 700, fontSize: '0.9375rem',
            border: 'none',
            cursor: saving || !customerName.trim() || selSvcs.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            fontFamily: 'Inter, sans-serif',
            boxShadow: saving || !customerName.trim() || selSvcs.length === 0 ? 'none' : `0 4px 16px ${G}40`,
          }}>
          {saving
            ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Recording…</>
            : <><Check size={16} /> Complete &amp; Record Walk-In</>}
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
