const TILE_VALUES: Record<string, number> = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,
  R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,
};

interface RackProps {
  rack: string;
}

export function Rack({ rack }: RackProps) {
  const tiles = rack.split('');

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      justifyContent: 'center',
      padding: '12px 0',
    }}>
      {tiles.map((letter, i) => (
        <div
          key={i}
          style={{
            width: 40,
            height: 40,
            background: '#f5e6b8',
            border: '2px solid #9a8a5a',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 'bold',
            fontFamily: "'Lexend', sans-serif",
            color: letter === '?' ? '#888' : '#222',
            boxShadow: '1px 2px 3px rgba(0,0,0,0.2)',
            cursor: 'grab',
            position: 'relative',
          }}
        >
          {letter === '?' ? ' ' : letter}
          {letter !== '?' && TILE_VALUES[letter] && (
            <span style={{
              position: 'absolute',
              bottom: 2,
              right: 3,
              fontSize: 9,
              fontWeight: 'bold',
              color: '#555',
              lineHeight: 1,
            }}>
              {TILE_VALUES[letter]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
