/** Convert 24-hour "HH:mm" → 12-hour "h:mm AM/PM". Safe on any input. */
export function fmt12(time: string): string {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time;
  const m    = (mStr || '00').slice(0, 2);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}
