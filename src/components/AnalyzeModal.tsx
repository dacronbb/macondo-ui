import { useRef, useState } from 'react';

interface Props {
  onWoogles: (id: string) => void;
  onGCG: (file: File) => void;
  onAnnotate: () => void;
  onCancel: () => void;
  loading: boolean;
}

export function AnalyzeModal({ onWoogles, onGCG, onAnnotate, onCancel, loading }: Props) {
  const [wooglesInput, setWooglesInput] = useState('');
  const [gcgFile, setGcgFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasWoogles = wooglesInput.trim().length > 0;
  const hasGcg = gcgFile !== null;
  const canAnalyze = hasWoogles || hasGcg;

  const handleAnalyze = () => {
    if (!canAnalyze || loading) return;
    if (hasGcg && gcgFile) onGCG(gcgFile);
    else onWoogles(wooglesInput.trim());
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'var(--modal-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--modal-bg)', borderRadius: 16,
          padding: 24, minWidth: 360, maxWidth: 440, width: '90vw',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>
          Analyze a game
        </h3>

        {/* Woogles game ID */}
        <input
          className="woogles-input"
          placeholder="Woogles game ID or URL"
          value={wooglesInput}
          onChange={e => setWooglesInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
          disabled={hasGcg}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            opacity: hasGcg ? 0.4 : 1,
            transition: 'opacity 0.15s',
          }}
        />

        {/* "or" divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          margin: '16px 0',
          color: 'var(--text-subtle)', fontSize: 12,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* GCG upload / file chip */}
        <div style={{ opacity: hasWoogles ? 0.4 : 1, transition: 'opacity 0.15s', pointerEvents: hasWoogles ? 'none' : 'auto' }}>
          {gcgFile ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: 'var(--bg-raised)',
              borderRadius: 10,
              border: '2px solid var(--cw)',
            }}>
              {/* File icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 500,
                color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {gcgFile.name}
              </span>
              <button
                onClick={() => setGcgFile(null)}
                style={{
                  background: 'none', border: 'none', padding: '0 2px',
                  cursor: 'pointer', color: 'var(--text-secondary)',
                  fontSize: 16, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                title="Remove file"
              >
                ×
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="action-btn action-btn-outline"
                onClick={() => fileRef.current?.click()}
                style={{ flex: 1 }}
              >
                Upload .GCG file
              </button>
              <button
                className="action-btn action-btn-outline"
                onClick={onAnnotate}
                style={{ flex: 1 }}
              >
                Annotate
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".gcg"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) setGcgFile(f);
            e.target.value = '';
          }}
        />

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 24 }}>
          <button className="action-btn action-btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="action-btn action-btn-primary"
            onClick={handleAnalyze}
            disabled={!canAnalyze || loading}
          >
            Analyze
          </button>
        </div>
      </div>
    </div>
  );
}
