import { useState, useRef, useEffect } from 'react';

const CHALLENGE_RULES = [
  { value: 'VOID', label: 'Void', description: 'Invalid words are automatically rejected' },
  { value: 'SINGLE', label: 'Single', description: 'Failed challenge ends your turn' },
  { value: 'DOUBLE', label: 'Double', description: 'Failed challenge loses your turn; successful removes word' },
  { value: 'FIVE_POINT', label: '5-Point', description: '+5 points for unsuccessful challenge' },
  { value: 'TEN_POINT', label: '10-Point', description: '+10 points for unsuccessful challenge' },
  { value: 'TRIPLE', label: 'Triple', description: 'Failed challenge loses the game' },
];

const selectStyle = {
  width: '100%',
  background: '#2a2a2a',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: 14,
  cursor: 'pointer',
  outline: 'none',
};

const labelStyle = {
  display: 'block' as const,
  fontSize: 11,
  color: '#888',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginBottom: 6,
};

interface SettingsProps {
  currentRule: string;
  currentLexicon: string;
  lexicons: string[];
  onChangeRule: (rule: string) => void;
  onChangeLexicon: (lex: string) => void;
  loading: boolean;
}

export function Settings({ currentRule, currentLexicon, lexicons, onChangeRule, onChangeLexicon, loading }: SettingsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
          background: '#333',
          color: '#fff',
          border: '1px solid #555',
          borderRadius: 4,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        Settings {open ? '\u25B2' : '\u25BC'}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: '#1e1e1e',
          border: '1px solid #444',
          borderRadius: 6,
          padding: 12,
          zIndex: 100,
          minWidth: 280,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          <label style={labelStyle}>Lexicon</label>
          <select
            value={currentLexicon}
            onChange={e => onChangeLexicon(e.target.value)}
            disabled={loading}
            style={selectStyle}
          >
            {lexicons.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4, marginBottom: 12, lineHeight: 1.4 }}>
            Takes effect on next New Game
          </div>

          <label style={labelStyle}>Challenge Rule</label>
          <select
            value={currentRule}
            onChange={e => onChangeRule(e.target.value)}
            disabled={loading}
            style={selectStyle}
          >
            {CHALLENGE_RULES.map(r => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 6, lineHeight: 1.4 }}>
            {current.description}
          </div>
        </div>
      )}
    </div>
  );
}
