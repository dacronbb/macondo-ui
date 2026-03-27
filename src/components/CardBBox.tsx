import { useState, useRef, useEffect } from 'react';
import { GameSwitcher } from './GameSwitcher';
import { Settings } from './Settings';

// ── Word cell spacing constants ──────────────────────────────────────────────
// All hook/symbol spacing derives from these two values so it stays consistent.
const HOOK_GAP = 2;          // px gap between dot and adjacent word/symbol
const FRONT_DOT_WIDTH = 16;  // px reserved for the inner-front-hook dot column

type Tab = 'search' | 'study' | 'judge';

const TABS: Tab[] = ['search', 'study', 'judge'];

const PLACEHOLDERS: Record<Tab, string> = {
  search: 'Enter a rack, e.g. AEILNR?',
  study: 'Enter a word to study',
  judge: 'Enter a word to judge',
};

const ACTION_LABELS: Record<Tab, string> = {
  search: 'Search',
  study: 'Study',
  judge: 'Judge',
};

// ── Types ───────────────────────────────────────────────────────────────────

interface WordResult {
  word: string;
  alphagram: string;
  definition: string;
  frontHooks: string;
  backHooks: string;
  lexiconSymbols: string;
  innerFrontHook: boolean;
  innerBackHook: boolean;
  probability: number;
}

type SortCol = 'probability' | 'word';

const COLUMNS: { key: string; label: string; title?: string; sortable?: SortCol }[] = [
  { key: 'probability', label: 'Prob.',     title: 'Probability order', sortable: 'probability' },
  { key: 'frontHook',   label: 'Front',     title: 'Front hooks' },
  { key: 'word',        label: 'Word',      sortable: 'word' },
  { key: 'backHook',    label: 'Back',      title: 'Back hooks' },
  { key: 'definition',  label: 'Definition' },
];

function sortWords(words: WordResult[], col: SortCol, dir: 'asc' | 'desc'): WordResult[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...words].sort((a, b) => {
    if (col === 'probability') return sign * (a.probability - b.probability);
    return sign * (a.word < b.word ? -1 : a.word > b.word ? 1 : 0);
  });
}

// ── Search API ──────────────────────────────────────────────────────────────

// These criteria are applied client-side after the server returns results.
const CLIENT_SIDE_TYPES = new Set(['Includes Letters', 'Consists of', 'Number of Unique Letters']);

function rowToParam(row: CriteriaRow): object | null {
  const min = row.value !== '' ? parseInt(row.value, 10) : undefined;
  const max = row.value2 !== '' ? parseInt(row.value2, 10) : min;

  switch (row.type) {
    case 'Anagram Match':
      return row.value ? { condition: 9, stringvalue: { value: row.value } } : null;
    case 'Length':
      return min !== undefined ? { condition: 1, minmax: { min, max } } : null;
    case 'Number of Vowels':
      return min !== undefined ? { condition: 6, minmax: { min, max } } : null;
    case 'Point Value':
      return min !== undefined ? { condition: 8, minmax: { min, max } } : null;
    case 'Number of Anagrams':
      return min !== undefined ? { condition: 5, minmax: { min, max } } : null;
    case 'Probability Order':
      return min !== undefined ? { condition: 2, minmax: { min, max } } : null;
    case 'Limit by Probability Order':
      return min !== undefined ? { condition: 4, numbervalue: { value: min } } : null;
    case 'Playability Order':
      return min !== undefined ? { condition: 18, minmax: { min, max } } : null;
    case 'Limit by Playability Order':
      return min !== undefined ? { condition: 4, numbervalue: { value: min } } : null;
    case 'Definition':
      return row.value ? { condition: 21, stringvalue: { value: row.value } } : null;
    case 'Takes Prefix':
      return row.value ? { condition: 20, hooksparam: { hook_type: 0, hooks: row.value, not_condition: row.not } } : null;
    case 'Takes Suffix':
      return row.value ? { condition: 20, hooksparam: { hook_type: 1, hooks: row.value, not_condition: row.not } } : null;
    default:
      return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWord(w: any, probability: number): WordResult {
  return {
    word: w.word ?? '',
    alphagram: w.alphagram ?? '',
    definition: w.definition ?? '',
    frontHooks: w.frontHooks ?? '',
    backHooks: w.backHooks ?? '',
    lexiconSymbols: w.lexiconSymbols ?? '',
    innerFrontHook: w.innerFrontHook ?? false,
    innerBackHook: w.innerBackHook ?? false,
    probability,
  };
}

function applyClientFilters(words: WordResult[], rows: CriteriaRow[]): WordResult[] {
  let result = words;
  for (const row of rows) {
    if (!row.value.trim()) continue;
    if (row.type === 'Includes Letters') {
      // Word must contain each specified letter (each occurrence counts once).
      const required = row.value.toUpperCase().replace(/[^A-Z]/g, '').split('');
      result = result.filter(w => {
        const chars = w.word.toUpperCase().split('');
        let ok = true;
        for (const ch of required) {
          const idx = chars.indexOf(ch);
          if (idx === -1) { ok = false; break; }
          chars.splice(idx, 1);
        }
        return row.not ? !ok : ok;
      });
    } else if (row.type === 'Consists of') {
      const allowed = new Set(row.value.toUpperCase().replace(/[^A-Z]/g, '').split(''));
      result = result.filter(w => {
        const allAllowed = w.word.toUpperCase().split('').every(ch => allowed.has(ch));
        return row.not ? !allAllowed : allAllowed;
      });
    } else if (row.type === 'Number of Unique Letters') {
      const min = row.value !== '' ? parseInt(row.value, 10) : undefined;
      const max = row.value2 !== '' ? parseInt(row.value2, 10) : min;
      if (min !== undefined) {
        result = result.filter(w => {
          const unique = new Set(w.word.toUpperCase().split('')).size;
          const inRange = unique >= min && (max === undefined || unique <= max);
          return row.not ? !inRange : inRange;
        });
      }
    }
  }
  return result;
}

async function fetchSubanagramResults(lexicon: string, letters: string): Promise<WordResult[]> {
  const res = await fetch('/wordsearcher/wordsearcher.Anagrammer/Anagram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lexicon, letters, mode: 1, expand: true }),
  });
  const data = await res.json();
  if (data.code) throw new Error(data.message ?? 'Subanagram search failed');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.words ?? []).map((w: any) => mapWord(w, 0));
}

async function fetchSearchResults(lexicon: string, rows: CriteriaRow[]): Promise<WordResult[]> {
  const clientRows = rows.filter(r => CLIENT_SIDE_TYPES.has(r.type));
  const subanagramRow = rows.find(r => r.type === 'Subanagram Match' && r.value.trim());
  const serverRows = rows.filter(r => !CLIENT_SIDE_TYPES.has(r.type) && r.type !== 'Subanagram Match');

  let results: WordResult[];

  if (subanagramRow) {
    results = await fetchSubanagramResults(lexicon, subanagramRow.value);
  } else {
    const searchparams: object[] = [{ condition: 0, stringvalue: { value: lexicon } }];
    for (const row of serverRows) {
      const p = rowToParam(row);
      if (p) searchparams.push(p);
    }
    const res = await fetch('/wordsearcher/wordsearcher.QuestionSearcher/Search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchparams, expand: true }),
    });
    const data = await res.json();
    if (data.code) throw new Error(data.message ?? 'Search failed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results = (data.alphagrams ?? []).flatMap((a: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a.words ?? []).map((w: any) => mapWord(w, a.probability ?? 0))
    );
  }

  return applyClientFilters(results, clientRows);
}

// ── Search pane ─────────────────────────────────────────────────────────────

type CriteriaInputKind = 'letters' | 'pattern' | 'number' | 'range' | 'text';

interface CriteriaDef {
  label: string;
  kind: CriteriaInputKind;
  placeholder?: string;
}

const CRITERIA_DEFS: CriteriaDef[] = [
  { label: 'Anagram Match',               kind: 'letters',  placeholder: 'e.g. AEILNR?' },
  { label: 'Pattern Match',               kind: 'pattern',  placeholder: 'e.g. ?E?T' },
  { label: 'Subanagram Match',            kind: 'letters',  placeholder: 'e.g. SATINE' },
  { label: 'Includes Letters',            kind: 'letters',  placeholder: 'e.g. QU' },
  { label: 'Consists of',                 kind: 'letters',  placeholder: 'e.g. AEIOU' },
  { label: 'Takes Prefix',                kind: 'letters',  placeholder: 'e.g. UN' },
  { label: 'Takes Suffix',                kind: 'letters',  placeholder: 'e.g. ING' },
  { label: 'Length',                      kind: 'range',    placeholder: 'min' },
  { label: 'Number of Vowels',            kind: 'range',    placeholder: 'min' },
  { label: 'Number of Unique Letters',    kind: 'range',    placeholder: 'min' },
  { label: 'Point Value',                 kind: 'range',    placeholder: 'min' },
  { label: 'Number of Anagrams',          kind: 'range',    placeholder: 'min' },
  { label: 'Probability Order',           kind: 'range',    placeholder: 'min' },
  { label: 'Limit by Probability Order',  kind: 'number',   placeholder: 'top N' },
  { label: 'Playability Order',           kind: 'range',    placeholder: 'min' },
  { label: 'Limit by Playability Order',  kind: 'number',   placeholder: 'top N' },
  { label: 'In Word List',                kind: 'text',     placeholder: 'list name' },
  { label: 'Part of Speech',              kind: 'text',     placeholder: 'e.g. noun' },
  { label: 'Definition',                  kind: 'text',     placeholder: 'search text' },
];

const CRITERIA_TYPES = CRITERIA_DEFS.map(d => d.label);
const CRITERIA_BY_LABEL = Object.fromEntries(CRITERIA_DEFS.map(d => [d.label, d]));

interface CriteriaRow {
  id: number;
  not: boolean;
  type: string;
  value: string;
  value2: string;
}

const ROW_H = 32;

const rowIconBtn: React.CSSProperties = {
  flexShrink: 0,
  background: 'var(--bg-raised)', border: 'none',
  height: ROW_H, width: ROW_H,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
  justifyContent: 'center', borderRadius: '50%', lineHeight: 0,
  boxShadow: 'var(--shadow-neu-sm)', color: 'var(--cw)',
};

const valueInputStyle: React.CSSProperties = {
  flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border-strong)',
  borderRadius: 8, height: ROW_H, padding: '0 10px', color: 'var(--text)',
  fontSize: 13, fontFamily: "'Lexend', sans-serif", fontWeight: 400,
  outline: 'none', boxShadow: 'var(--shadow-neu-inset)',
  minWidth: 0,
};

function CustomSelect({ value, options, onChange, style }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const longest = options.reduce((a, b) => a.length >= b.length ? a : b, '');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    background: 'var(--bg-raised)', color: 'var(--text)',
    border: '1px solid var(--border-strong)', borderRadius: 8,
    height: ROW_H, padding: '0 8px', fontSize: 13, cursor: 'pointer',
    outline: 'none', boxShadow: 'var(--shadow-neu-inset)',
    fontFamily: "'Lexend', sans-serif", fontWeight: 500,
    whiteSpace: 'nowrap',
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, ...style }}>
      <div aria-hidden style={{ ...btnStyle, visibility: 'hidden', pointerEvents: 'none' }}>
        <span>{longest}</span>
        <svg width="10" height="10" viewBox="0 0 12 12"><polygon points="2,3 10,3 6,9" /></svg>
      </div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ ...btnStyle, position: 'absolute', inset: 0, width: '100%' }}
      >
        <span>{value}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0, fill: 'var(--cw)' }}>
          <polygon points="2,3 10,3 6,9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: 'var(--modal-bg)', borderRadius: 10, padding: '4px 0',
          minWidth: '100%', zIndex: 300,
          boxShadow: '8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light)',
        }}>
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                display: 'block', width: '100%', padding: '7px 14px',
                background: opt === value ? 'var(--bg-raised)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontFamily: "'Lexend', sans-serif", fontSize: 13, fontWeight: opt === value ? 600 : 400,
                color: opt === value ? 'var(--cw)' : 'var(--text)',
                whiteSpace: 'nowrap',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function NumberStepper({
  value, onChange, placeholder, style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const num = value === '' ? null : parseInt(value, 10);
  const canDown = num !== null && num > 1;
  const canUp = true;

  const arrowBtn: React.CSSProperties = {
    background: 'none', border: 'none', padding: '0 4px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: 'var(--bg-raised)', border: '1px solid var(--border-strong)',
      borderRadius: 8, height: ROW_H,
      boxShadow: 'var(--shadow-neu-inset)',
      overflow: 'hidden', minWidth: 0,
      ...style,
    }}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        placeholder={placeholder ?? '—'}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          padding: '0 8px', color: 'var(--text)', fontSize: 13,
          fontFamily: "'Lexend', sans-serif", fontWeight: 400, minWidth: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 4, gap: 3 }}>
        <button
          style={{ ...arrowBtn, color: canUp ? 'var(--cw)' : 'var(--text-disabled)' }}
          onClick={() => onChange(String(num === null ? 1 : num + 1))}
        >
          <svg width="8" height="6" viewBox="0 0 10 6" fill="currentColor">
            <polygon points="0,6 10,6 5,0" />
          </svg>
        </button>
        <button
          style={{ ...arrowBtn, color: canDown ? 'var(--cw)' : 'var(--text-disabled)' }}
          onClick={() => { if (canDown) onChange(String(num! - 1)); }}
        >
          <svg width="8" height="6" viewBox="0 0 10 6" fill="currentColor">
            <polygon points="0,0 10,0 5,6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function CriteriaValueInput({ row, updateRow }: { row: CriteriaRow; updateRow: (id: number, patch: Partial<CriteriaRow>) => void }) {
  const def = CRITERIA_BY_LABEL[row.type] ?? { kind: 'letters' as CriteriaInputKind, placeholder: '' };

  if (def.kind === 'letters') {
    return (
      <input
        type="text"
        value={row.value}
        onChange={e => updateRow(row.id, { value: e.target.value.toUpperCase().replace(/[^A-Z?*]/g, '') })}
        placeholder={def.placeholder ?? 'e.g. ABC'}
        style={valueInputStyle}
      />
    );
  }

  if (def.kind === 'pattern') {
    return (
      <input
        type="text"
        value={row.value}
        onChange={e => updateRow(row.id, { value: e.target.value.toUpperCase().replace(/[^A-Z?.]/g, '') })}
        placeholder={def.placeholder ?? 'e.g. ?E?T'}
        style={valueInputStyle}
      />
    );
  }

  if (def.kind === 'number') {
    return (
      <NumberStepper
        value={row.value}
        onChange={v => updateRow(row.id, { value: v })}
        placeholder={def.placeholder ?? '—'}
        style={{ flex: 1 }}
      />
    );
  }

  if (def.kind === 'range') {
    return (
      <>
        <NumberStepper
          value={row.value}
          onChange={v => updateRow(row.id, { value: v })}
          placeholder="min"
          style={{ flex: 1 }}
        />
        <NumberStepper
          value={row.value2}
          onChange={v => updateRow(row.id, { value2: v })}
          placeholder="max"
          style={{ flex: 1 }}
        />
      </>
    );
  }

  return (
    <input
      type="text"
      value={row.value}
      onChange={e => updateRow(row.id, { value: e.target.value })}
      placeholder={def.placeholder ?? ''}
      style={valueInputStyle}
    />
  );
}

// ── Results table ────────────────────────────────────────────────────────────

const MAX_DISPLAY = 5000;

function ResultsTable({ words, sortCol, sortDir, onSort }: {
  words: WordResult[];
  sortCol: SortCol;
  sortDir: 'asc' | 'desc';
  onSort: (col: SortCol) => void;
}) {
  const displayed = words.slice(0, MAX_DISPLAY);

  const thStyle = (key: string): React.CSSProperties => ({
    padding: key === 'frontHook' ? '6px 2px 6px 8px' : key === 'backHook' ? '6px 8px 6px 2px' : key === 'word' ? `6px 2px 6px ${FRONT_DOT_WIDTH + 2}px` : '6px 8px',
    textAlign: key === 'frontHook' ? 'right' : 'left',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--text-secondary)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--bg-raised)',
    zIndex: 1,
  });

  const SortIcon = ({ col }: { col: SortCol }) => {
    const active = col === sortCol;
    const color = active ? 'var(--cw)' : 'var(--text-subtle)';
    if (!active) return (
      <svg width="8" height="11" viewBox="0 0 8 11" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }}>
        <polygon points="0,4 8,4 4,0" fill={color} />
        <polygon points="0,7 8,7 4,11" fill={color} />
      </svg>
    );
    return (
      <svg width="8" height="6" viewBox="0 0 8 6" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }}>
        {sortDir === 'asc'
          ? <polygon points="0,6 8,6 4,0" fill="var(--cw)" />
          : <polygon points="0,0 8,0 4,6" fill="var(--cw)" />}
      </svg>
    );
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {words.length > MAX_DISPLAY
          ? `Showing first ${MAX_DISPLAY.toLocaleString()} of ${words.length.toLocaleString()} words`
          : `${words.length.toLocaleString()} word${words.length !== 1 ? 's' : ''}`}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Lexend', sans-serif" }}>
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                style={{ ...thStyle(col.key), cursor: col.sortable ? 'pointer' : 'default' }}
                title={col.title}
                onClick={() => col.sortable && onSort(col.sortable)}
              >
                {col.label}{col.sortable && <SortIcon col={col.sortable} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayed.map((w, i) => (
            <tr key={w.word} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.04)' }}>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                {w.probability || '—'}
              </td>
              <td style={{ padding: '4px 2px 4px 8px', textAlign: 'right', color: 'var(--cw)', fontWeight: 600, letterSpacing: 1, fontSize: 12 }}>
                {w.frontHooks}
              </td>
              <td style={{ padding: '4px 2px', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-block', width: FRONT_DOT_WIDTH, textAlign: 'right', paddingRight: HOOK_GAP, verticalAlign: 'middle' }}>
                  {w.innerFrontHook && <span style={{ fontSize: 22, lineHeight: 1, color: 'var(--cw)' }}>·</span>}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text)', verticalAlign: 'middle' }}>{w.word}</span>
                {w.innerBackHook && <span style={{ fontSize: 22, lineHeight: 1, color: 'var(--cw)', verticalAlign: 'middle', marginLeft: HOOK_GAP }}>·</span>}
                {w.lexiconSymbols && <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 400, verticalAlign: 'middle', marginLeft: HOOK_GAP, lineHeight: 1 }}>{w.lexiconSymbols}</span>}
              </td>
              <td style={{ padding: '4px 8px 4px 2px', color: 'var(--cw)', fontWeight: 600, letterSpacing: 1, fontSize: 12 }}>
                {w.backHooks}
              </td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontSize: 12 }}>
                {w.definition}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── SearchPane ───────────────────────────────────────────────────────────────

interface PaneProps {
  lexicon: string;
  lexicons: string[];
  onChangeLexicon: (lex: string) => void;
}

function SearchPane({ lexicon, lexicons, onChangeLexicon }: PaneProps) {
  const [rows, setRows] = useState<CriteriaRow[]>([
    { id: 1, not: false, type: 'Anagram Match', value: '', value2: '' },
  ]);
  const nextId = useRef(2);

  const [results, setResults] = useState<WordResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>('probability');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const addRow = (afterId: number) => {
    const newRow: CriteriaRow = { id: nextId.current++, not: false, type: 'Anagram Match', value: '', value2: '' };
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  const removeRow = (id: number) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  };

  const updateRow = (id: number, patch: Partial<CriteriaRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const hasValues = rows.some(r => r.value.trim() !== '' || r.value2.trim() !== '');

  const handleSearch = async () => {
    if (!hasValues || loading) return;
    setLoading(true);
    setSearchError(null);
    try {
      const words = await fetchSearchResults(lexicon, rows);
      setResults(words);
      setSortCol('probability');
      setSortDir('asc');
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedResults = results ? sortWords(results, sortCol, sortDir) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}>

      {/* Sticky criteria header */}
      <div style={{ flexShrink: 0, padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <CustomSelect value={lexicon} options={lexicons} onChange={onChangeLexicon} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="action-btn" disabled={!hasValues} style={{ flex: 'none', padding: '6px 14px', fontSize: 12 }}>
              Save search
            </button>
            <button className="action-btn" style={{ flex: 'none', padding: '6px 14px', fontSize: 12 }}>
              Load search
            </button>
            <button className="action-btn action-btn-primary" onClick={handleSearch} disabled={!hasValues || loading} style={{ flex: 'none', padding: '6px 18px', fontSize: 12 }}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>

        {/* Criteria rows */}
        {rows.map(row => (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => addRow(row.id)} style={rowIconBtn} title="Add criteria below">
              <PlusIcon />
            </button>
            <button
              onClick={() => removeRow(row.id)}
              style={{ ...rowIconBtn, color: rows.length === 1 ? 'var(--text-disabled)' : 'var(--cw)', boxShadow: rows.length === 1 ? 'none' : 'var(--shadow-neu-sm)', cursor: rows.length === 1 ? 'default' : 'pointer', background: 'var(--bg-raised)' }}
              disabled={rows.length === 1}
              title="Remove criteria"
            >
              <MinusIcon />
            </button>
            <button
              onClick={() => updateRow(row.id, { not: !row.not })}
              style={{
                flexShrink: 0, border: 'none', cursor: 'pointer',
                height: ROW_H, padding: '0 10px', borderRadius: 8,
                fontFamily: "'Lexend', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                background: row.not ? 'var(--cw)' : 'var(--bg-raised)',
                color: row.not ? 'var(--bg-raised)' : 'var(--cw)',
                boxShadow: row.not ? 'none' : 'var(--shadow-neu-sm)',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              }}
            >
              NOT
            </button>
            <CustomSelect
              value={row.type}
              options={CRITERIA_TYPES}
              onChange={v => updateRow(row.id, { type: v, value: '', value2: '' })}
            />
            <CriteriaValueInput row={row} updateRow={updateRow} />
          </div>
        ))}

        {/* Error */}
        {searchError && (
          <div style={{ fontSize: 12, color: 'var(--error-text)', padding: '6px 10px', background: 'var(--error-bg)', borderRadius: 8 }}>
            {searchError}
          </div>
        )}
      </div>

      {/* Scrollable results */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        {sortedResults && (
          <ResultsTable
            words={sortedResults}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}
      </div>
    </div>
  );
}

// ── Placeholder panes ────────────────────────────────────────────────────────

function StudyPane() {
  return (
    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
      Study mode coming soon.
    </div>
  );
}

function JudgePane() {
  return (
    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
      Judge mode coming soon.
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface CardBBoxProps {
  onSwitch: (game: 'scrabble' | 'boggle' | 'cardbbox') => void;
  lexicon: string;
  lexicons: string[];
  theme: string;
  colorway: string;
  onChangeLexicon: (lex: string) => void;
  onChangeTheme: (theme: string) => void;
  onChangeColorway: (colorway: string) => void;
}

export function CardBBox({
  onSwitch, lexicon, lexicons, theme, colorway,
  onChangeLexicon, onChangeTheme, onChangeColorway,
}: CardBBoxProps) {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [inputs, setInputs] = useState<Record<Tab, string>>({ search: '', study: '', judge: '' });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeTab]);

  const setInput = (tab: Tab, value: string) =>
    setInputs(prev => ({ ...prev, [tab]: value }));

  const handleSubmit = () => {
    if (!inputs[activeTab].trim()) return;
    // TODO: wire up study/judge actions
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-app)', overflow: 'hidden' }}>

      {/* Title row */}
      <div className="app-title-row">
        <GameSwitcher current="cardbbox" onChange={onSwitch} />
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 8 }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: activeTab === tab ? 'var(--cw)' : 'var(--bg)',
                color: activeTab === tab ? 'var(--bg-raised)' : 'var(--text-secondary)',
                fontFamily: "'Lexend', sans-serif", fontWeight: 600, fontSize: 13,
                boxShadow: activeTab === tab ? 'none' : 'var(--shadow-neu-sm)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <Settings
          currentLexicon={lexicon} lexicons={lexicons}
          theme={theme} colorway={colorway}
          onChangeLexicon={onChangeLexicon}
          onChangeTheme={onChangeTheme}
          onChangeColorway={onChangeColorway}
          loading={false}
        />
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: '16px 32px 32px', gap: 32 }}>

        {/* Main module */}
        <div className="panel-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: activeTab === 'search' ? 'flex' : 'none', flexDirection: 'column', minHeight: 0 }}>
            <SearchPane lexicon={lexicon} lexicons={lexicons} onChangeLexicon={onChangeLexicon} />
          </div>
          <div style={{ display: activeTab === 'study' ? 'block' : 'none', flex: 1, overflowY: 'auto', padding: 16 }}><StudyPane /></div>
          <div style={{ display: activeTab === 'judge' ? 'block' : 'none', flex: 1, overflowY: 'auto', padding: 16 }}><JudgePane /></div>

          {activeTab !== 'search' && (
            <div style={{
              flexShrink: 0, borderTop: '1px solid var(--border)',
              padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <input
                ref={inputRef}
                value={inputs[activeTab]}
                onChange={e => setInput(activeTab, e.target.value.toUpperCase().replace(/[^A-Z?]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder={PLACEHOLDERS[activeTab]}
                style={{
                  flex: 1, background: 'var(--bg)', border: '2px solid var(--border)',
                  borderRadius: 10, padding: '9px 14px', color: 'var(--text)',
                  fontSize: 14, fontFamily: "'Lexend', sans-serif", fontWeight: 600,
                  letterSpacing: 2, outline: 'none', boxShadow: 'var(--shadow-neu-sm)',
                }}
              />
              <button
                className="action-btn action-btn-primary"
                onClick={handleSubmit}
                disabled={!inputs[activeTab].trim()}
                style={{ fontSize: 13, padding: '9px 20px', whiteSpace: 'nowrap' }}
              >
                {ACTION_LABELS[activeTab]}
              </button>
            </div>
          )}
        </div>

        {/* Right panel — History */}
        <div style={{ flexShrink: 0, width: 320, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ color: 'var(--text)' }}>History</h3>
            <div style={{ flex: 1, padding: 12, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
              Past searches will appear here.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
