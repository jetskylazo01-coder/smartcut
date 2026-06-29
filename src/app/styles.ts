// Shared design tokens — import in every dashboard component
export const G       = '#1b8032';
export const FG      = '#e6efe6';
export const DIM     = '#637565';
export const MUTED   = '#3a4a3c';
export const BG      = '#07090a';
export const SURFACE = '#0f1512';
export const SURFACE2 = '#141d16';
export const FIELD   = '#1a2219';
export const BORDER  = 'rgba(255,255,255,0.055)';
export const SHADOW  = '0 1px 4px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)';

export const STATUS_COLOR = {
  Pending:   '#c8941a',
  Confirmed: G,
  Completed: '#3878b8',
  Cancelled: '#bf3030',
} as const;

// Shared component styles
export const card: React.CSSProperties = {
  background: SURFACE,
  borderRadius: '0.875rem',
  padding: '1.375rem',
  boxShadow: SHADOW,
};

export const inlineRow: React.CSSProperties = {
  background: SURFACE,
  padding: '1rem 1.25rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

export function pill(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    padding: '0.2rem 0.625rem',
    borderRadius: '2rem',
    background: `${color}18`,
    color,
    fontSize: '0.7rem',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
  };
}

export function primaryBtn(disabled?: boolean): React.CSSProperties {
  return {
    padding: '0.75rem 1.5rem',
    borderRadius: '0.625rem',
    background: disabled ? '#155e26' : G,
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.875rem',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontFamily: 'Inter, sans-serif',
    opacity: disabled ? 0.55 : 1,
    transition: 'opacity 0.15s',
  };
}

export function ghostBtn(): React.CSSProperties {
  return {
    padding: '0.75rem 1.5rem',
    borderRadius: '0.625rem',
    background: FIELD,
    color: DIM,
    fontWeight: 500,
    fontSize: '0.875rem',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontFamily: 'Inter, sans-serif',
  };
}

export function inputStyle(): React.CSSProperties {
  return {
    padding: '0.625rem 0.875rem',
    borderRadius: '0.5rem',
    border: `1px solid ${BORDER}`,
    background: FIELD,
    color: FG,
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
  };
}

// Section heading
export function sectionLabel(color = DIM): React.CSSProperties {
  return {
    color,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: '0.75rem',
  };
}
