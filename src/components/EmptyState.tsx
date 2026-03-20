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
        <rect width="680" height="340" fill="var(--cv-bg-surface)" rx="0" style={{ stroke: 'none' }} />

        <rect x="240" y="52" width="200" height="256" rx="0" fill="var(--cv-bg-base)" stroke="var(--cv-border)" strokeWidth="0.6" opacity="0.9" />
        <rect x="240" y="52" width="200" height="256" rx="0" fill="none" stroke="var(--cv-accent)" strokeWidth="0.4" opacity="0.3" />

        <polygon points="400,52 440,52 440,92 400,52" fill="var(--cv-bg-surface)" />
        <polygon points="400,52 440,92 400,92" fill="var(--cv-border)" />

        <line x1="268" y1="130" x2="412" y2="130" stroke="var(--cv-accent)" strokeWidth="0.5" opacity="0.2" />
        <line x1="268" y1="148" x2="390" y2="148" stroke="var(--cv-border)" strokeWidth="0.5" opacity="0.3" />
        <line x1="268" y1="166" x2="400" y2="166" stroke="var(--cv-border)" strokeWidth="0.5" opacity="0.3" />

        <line x1="268" y1="196" x2="412" y2="196" stroke="var(--cv-accent)" strokeWidth="0.5" opacity="0.2" />
        <line x1="268" y1="214" x2="370" y2="214" stroke="var(--cv-border)" strokeWidth="0.5" opacity="0.3" />
        <line x1="268" y1="232" x2="395" y2="232" stroke="var(--cv-border)" strokeWidth="0.5" opacity="0.3" />

        <line x1="268" y1="262" x2="412" y2="262" stroke="var(--cv-accent)" strokeWidth="0.5" opacity="0.2" />
        <line x1="268" y1="280" x2="358" y2="280" stroke="var(--cv-border)" strokeWidth="0.5" opacity="0.3" />

        <rect x="268" y="88" width="112" height="8" rx="0" fill="var(--cv-accent)" opacity="0.12" />
        <rect x="268" y="104" width="80" height="5" rx="0" fill="var(--cv-accent)" opacity="0.07" />
      </svg>
      <p className="text-text-muted font-mono text-xs mt-4">
        {message}
      </p>
    </div>
  );
}
