import { useState, useRef, useEffect } from 'react';

const CHALLENGE_RULES = [
  { value: 'VOID', label: 'Void', description: 'Invalid words are automatically rejected' },
  { value: 'SINGLE', label: 'Single', description: 'Failed challenge ends your turn' },
  { value: 'DOUBLE', label: 'Double', description: 'Failed challenge loses your turn; successful removes word' },
  { value: 'FIVE_POINT', label: '5-Point', description: '+5 points for unsuccessful challenge' },
  { value: 'TEN_POINT', label: '10-Point', description: '+10 points for unsuccessful challenge' },
  { value: 'TRIPLE', label: 'Triple', description: 'Failed challenge loses the game' },
];

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-raised)',
  color: 'var(--text)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 14,
  cursor: 'pointer',
  outline: 'none',
  boxShadow: 'var(--shadow-neu-inset)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 6,
};

const COLORWAYS = [
  { value: 'green', label: 'Green', color: '#00975B' },
  { value: 'blue', label: 'Blue', color: '#006797' },
  { value: 'orange', label: 'Orange', color: '#e65100' },
  { value: 'pink', label: 'Pink', color: '#970058' },
];

interface SettingsProps {
  currentRule: string;
  currentLexicon: string;
  lexicons: string[];
  theme: string;
  colorway: string;
  onChangeRule: (rule: string) => void;
  onChangeLexicon: (lex: string) => void;
  onChangeTheme: (theme: string) => void;
  onChangeColorway: (colorway: string) => void;
  loading: boolean;
}

export function Settings({ currentRule, currentLexicon, lexicons, theme, colorway, onChangeRule, onChangeLexicon, onChangeTheme, onChangeColorway, loading }: SettingsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = CHALLENGE_RULES.find(r => r.value === currentRule) || CHALLENGE_RULES[0];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'var(--bg-raised)', color: 'var(--cw)',
          border: '2px solid var(--cw)', borderRadius: 10, padding: '10px 16px',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: 'var(--shadow-neu-sm)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Settings
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'var(--modal-bg)', border: 'none', borderRadius: 12,
          padding: 12, zIndex: 100, minWidth: 280,
          boxShadow: '8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light)',
        }}>
          {/* Theme toggle */}
          <label style={labelStyle}>Theme</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['light', 'dark'].map(t => (
              <button key={t} onClick={() => onChangeTheme(t)} style={{
                flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: theme === t ? 'var(--accent)' : 'var(--bg-raised)',
                color: theme === t ? '#fff' : 'var(--text-secondary)',
                boxShadow: theme === t ? 'none' : 'var(--shadow-neu-sm)',
              }}>
                {t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>

          {/* Colorway picker */}
          <label style={labelStyle}>Colorway</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {COLORWAYS.map(cw => (
              <button key={cw.value} onClick={() => onChangeColorway(cw.value)} style={{
                flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: colorway === cw.value ? cw.color : 'var(--bg-raised)',
                color: colorway === cw.value ? '#fff' : 'var(--text-secondary)',
                boxShadow: colorway === cw.value ? 'none' : 'var(--shadow-neu-sm)',
              }}>
                {cw.label}
              </button>
            ))}
          </div>

          <label style={labelStyle}>Lexicon</label>
          <select
            value={currentLexicon}
            onChange={e => onChangeLexicon(e.target.value)}
            disabled={loading}
            style={selectStyle}
          >
            {lexicons.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 4, marginBottom: 12, lineHeight: 1.4 }}>
            Takes effect on next New Game
          </div>

          <label style={labelStyle}>Challenge Rule</label>
          <select
            value={currentRule}
            onChange={e => onChangeRule(e.target.value)}
            disabled={loading}
            style={selectStyle}
          >
            {CHALLENGE_RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 6, lineHeight: 1.4 }}>
            {current.description}
          </div>
        </div>
      )}
    </div>
  );
}
