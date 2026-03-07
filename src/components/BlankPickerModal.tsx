interface BlankPickerModalProps {
  onPick: (letter: string) => void;
  onCancel: () => void;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function BlankPickerModal({ onPick, onCancel }: BlankPickerModalProps) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--modal-overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--modal-bg)', borderRadius: 16,
        padding: 24, maxWidth: 420,
        maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>Choose a letter</h3>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6, marginBottom: 16,
        }}>
          {LETTERS.map(letter => (
            <button
              key={letter}
              onClick={() => onPick(letter)}
              style={{
                width: 40, height: 40,
                background: 'var(--tile-bg)',
                border: '2px solid transparent',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 600, fontFamily: "'Lexend', sans-serif",
                color: 'var(--cw)',
                cursor: 'pointer',
                paddingBottom: 2,
              }}
            >
              {letter}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={onCancel} style={{
            background: 'var(--bg-raised)', color: 'var(--cw)',
            border: '2px solid var(--cw)', borderRadius: 10, padding: '10px 24px',
            fontSize: 14, fontWeight: 600, fontFamily: "'Lexend', sans-serif",
            cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
