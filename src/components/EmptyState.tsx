interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = "No applications found." }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <svg
        width="320"
        viewBox="0 0 680 350"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="680" height="340" fill="#1C1C1C" rx="10" style={{ stroke: 'none' }} />

        <rect x="240" y="52" width="200" height="256" rx="6" fill="#252525" stroke="#D4A847" strokeWidth="0.6" opacity="0.9" />
        <rect x="240" y="52" width="200" height="256" rx="6" fill="none" stroke="#D4A847" strokeWidth="0.6" />

        <polygon points="400,52 440,52 440,92 400,52" fill="#1C1C1C" />
        <polygon points="400,52 440,92 400,92" fill="#2E2A1E" />
        <line x1="400" y1="52" x2="440" y2="92" stroke="#D4A847" strokeWidth="0.6" opacity="0.7" />
        <rect x="400" y="52" width="40" height="40" fill="none" stroke="#D4A847" strokeWidth="0.6" opacity="0.5" />

        <line x1="268" y1="130" x2="412" y2="130" stroke="#D4A847" strokeWidth="0.5" opacity="0.25" />
        <line x1="268" y1="148" x2="390" y2="148" stroke="#D4A847" strokeWidth="0.5" opacity="0.15" />
        <line x1="268" y1="166" x2="400" y2="166" stroke="#D4A847" strokeWidth="0.5" opacity="0.15" />

        <line x1="268" y1="196" x2="412" y2="196" stroke="#D4A847" strokeWidth="0.5" opacity="0.25" />
        <line x1="268" y1="214" x2="370" y2="214" stroke="#D4A847" strokeWidth="0.5" opacity="0.15" />
        <line x1="268" y1="232" x2="395" y2="232" stroke="#D4A847" strokeWidth="0.5" opacity="0.15" />

        <line x1="268" y1="262" x2="412" y2="262" stroke="#D4A847" strokeWidth="0.5" opacity="0.25" />
        <line x1="268" y1="280" x2="358" y2="280" stroke="#D4A847" strokeWidth="0.5" opacity="0.15" />

        <rect x="268" y="88" width="112" height="8" rx="2" fill="#D4A847" opacity="0.18" />
        <rect x="268" y="104" width="80" height="5" rx="2" fill="#D4A847" opacity="0.1" />
      
      </svg>
      <p style={{ color: '#D4A847', opacity: 0.5, fontSize: '13px', marginTop: '16px' }}>
        {message}
      </p>
    </div>
  );
}
