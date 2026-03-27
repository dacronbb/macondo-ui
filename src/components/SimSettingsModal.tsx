import { useState } from 'react';
import type { SimSettings } from '../api/types';

const STOPPING_CONDITIONS = [
  { value: 0, label: 'Never' },
  { value: 1, label: '90%' },
  { value: 2, label: '95%' },
  { value: 3, label: '98%' },
  { value: 4, label: '99%' },
  { value: 5, label: '99.9%' },
];

const TILE_DISTRIBUTION: Record<string, number> = {
  A:9, B:2, C:2, D:4, E:12, F:2, G:3, H:2, I:9, J:1, K:1, L:4, M:2,
  N:6, O:8, P:2, Q:1, R:6, S:4, T:6, U:4, V:2, W:2, X:1, Y:2, Z:1, '?':2,
};

function validateInference(raw: string): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/\s/g, '');
  if (upper.length > 7) return 'Impossible inference';
  const counts: Record<string, number> = {};
  for (const ch of upper) {
    const key = ch === '?' ? '?' : ch;
    if (!TILE_DISTRIBUTION[key]) return 'Impossible inference';
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] > TILE_DISTRIBUTION[key]) return 'Impossible inference';
  }
  return null;
}

interface SimSettingsModalProps {
  settings: SimSettings;
  onSave: (settings: SimSettings) => void;
  onCancel: () => void;
}

export function SimSettingsModal({ settings, onSave, onCancel }: SimSettingsModalProps) {
  const [plies, setPlies] = useState(settings.plies);
  const [stoppingCondition, setStoppingCondition] = useState(settings.stoppingCondition);
  const [inference, setInference] = useState(settings.inference || '');

  const inferenceError = validateInference(inference);
  const canSave = !inferenceError;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-raised)', borderRadius: 16,
          boxShadow: 'var(--shadow-neu)', padding: '28px 28px 20px',
          width: 320, display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
          Sim settings
        </h2>

        {/* Plies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Plies <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(look-ahead)</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(p => (
              <button
                key={p}
                onClick={() => setPlies(p)}
                style={{
                  padding: '6px 14px', borderRadius: 10, border: 'none',
                  background: plies === p ? 'var(--cw)' : 'var(--bg)',
                  color: plies === p ? 'var(--bg-raised)' : 'var(--text)',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  boxShadow: plies === p ? 'none' : 'var(--shadow-neu-sm)',
                  fontFamily: "'Lexend', sans-serif",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Stopping condition */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Confidence <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(autostop)</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {STOPPING_CONDITIONS.map(sc => (
              <button
                key={sc.value}
                onClick={() => setStoppingCondition(sc.value)}
                style={{
                  padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: stoppingCondition === sc.value ? 'var(--cw)' : 'var(--bg)',
                  color: stoppingCondition === sc.value ? 'var(--bg-raised)' : 'var(--text)',
                  fontFamily: "'Lexend', sans-serif", fontSize: 13, fontWeight: 600,
                  boxShadow: stoppingCondition === sc.value ? 'none' : 'var(--shadow-neu-sm)',
                }}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inference */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Inference <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opponent tiles)</span>
          </label>
          <input
            type="text"
            value={inference}
            onChange={e => setInference(e.target.value.toUpperCase().replace(/[^A-Z?]/g, ''))}
            placeholder="e.g. AEI?"
            maxLength={7}
            style={{
              background: 'var(--bg)', border: `2px solid ${inferenceError ? 'var(--accent-red)' : 'var(--border)'}`,
              borderRadius: 10, padding: '8px 12px', color: 'var(--text)',
              fontSize: 14, fontFamily: "'Lexend', sans-serif", fontWeight: 600,
              letterSpacing: 2, outline: 'none',
              boxShadow: inferenceError ? 'none' : 'var(--shadow-neu-sm)',
            }}
          />
          {inferenceError && (
            <span style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 500 }}>
              {inferenceError}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="action-btn action-btn-outline" onClick={onCancel}
            style={{ fontSize: 13, padding: '7px 16px' }}>
            Cancel
          </button>
          <button
            className="action-btn action-btn-primary"
            onClick={() => canSave && onSave({ plies, stoppingCondition, inference })}
            disabled={!canSave}
            style={{ fontSize: 13, padding: '7px 16px', opacity: canSave ? 1 : 0.4, cursor: canSave ? 'pointer' : 'not-allowed' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
