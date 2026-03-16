import { useState } from 'react';
import type { SimSettings } from '../api/types';

const STOPPING_CONDITIONS = [
  { value: 0, label: 'Never (manual stop)' },
  { value: 1, label: '90% confidence' },
  { value: 2, label: '95% confidence' },
  { value: 3, label: '98% confidence' },
  { value: 4, label: '99% confidence' },
  { value: 5, label: '99.9% confidence' },
];

interface SimSettingsModalProps {
  settings: SimSettings;
  onSave: (settings: SimSettings) => void;
  onCancel: () => void;
}

export function SimSettingsModal({ settings, onSave, onCancel }: SimSettingsModalProps) {
  const [plies, setPlies] = useState(settings.plies);
  const [stoppingCondition, setStoppingCondition] = useState(settings.stoppingCondition);

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
            Plies
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {[1, 2, 3, 4, 5].map(p => (
              <button
                key={p}
                onClick={() => setPlies(p)}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: 'none',
                  background: plies === p ? 'var(--cw)' : 'var(--bg)',
                  color: plies === p ? 'var(--bg-raised)' : 'var(--text)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  boxShadow: plies === p ? 'none' : 'var(--shadow-neu-sm)',
                  fontFamily: "'Lexend', sans-serif",
                }}
              >
                {p}
              </button>
            ))}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
              look-ahead
            </span>
          </div>
        </div>

        {/* Stopping condition */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Auto-stop
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STOPPING_CONDITIONS.map(sc => (
              <button
                key={sc.value}
                onClick={() => setStoppingCondition(sc.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: stoppingCondition === sc.value ? 'var(--cw)' : 'var(--bg)',
                  color: stoppingCondition === sc.value ? 'var(--bg-raised)' : 'var(--text)',
                  fontFamily: "'Lexend', sans-serif", fontSize: 13, fontWeight: 500,
                  boxShadow: stoppingCondition === sc.value ? 'none' : 'var(--shadow-neu-sm)',
                  textAlign: 'left',
                }}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="action-btn action-btn-outline" onClick={onCancel}
            style={{ fontSize: 13, padding: '7px 16px' }}>
            Cancel
          </button>
          <button className="action-btn action-btn-primary"
            onClick={() => onSave({ plies, stoppingCondition })}
            style={{ fontSize: 13, padding: '7px 16px' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
