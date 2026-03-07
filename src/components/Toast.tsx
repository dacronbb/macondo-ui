import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  version: number;
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: number) => void;
}

const TOAST_DURATION = 20000;

export function Toast({ messages, onDismiss }: ToastProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {messages.map(msg => (
        <ToastItem key={msg.id} message={msg} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ message, onDismiss }: { message: ToastMessage; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Re-animate: briefly hide then show
    setVisible(false);
    const show = requestAnimationFrame(() =>
      requestAnimationFrame(() => setVisible(true))
    );
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(message.id), 300);
    }, TOAST_DURATION);
    return () => { cancelAnimationFrame(show); clearTimeout(timer); };
  }, [message.id, message.version, onDismiss]);

  const dismiss = () => { setVisible(false); setTimeout(() => onDismiss(message.id), 300); };

  return (
    <div
      style={{
        background: 'var(--bg-raised)',
        color: 'var(--text)',
        border: '1px solid var(--cw)',
        borderRadius: 10,
        padding: '10px 14px 10px 16px',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "'Lexend', sans-serif",
        boxShadow: 'var(--shadow-neu)',
        pointerEvents: 'auto',
        maxWidth: 320,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(16px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <span style={{ flex: 1 }}>{message.text}</span>
      <button
        onClick={dismiss}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--cw)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
