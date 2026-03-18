export function BackgroundTexture() {
  return (
    <div style={{ pointerEvents: 'none' }}>
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 680 410"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}
      >
        <defs>
          <pattern id="dot" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#161616"/>
            <circle cx="10" cy="10" r="0.8" fill="#D4A847" opacity="0.18"/>
          </pattern>
          <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="none"/>
            <line x1="40" y1="0" x2="0" y2="40" stroke="#D4A847" strokeWidth="0.4" opacity="0.07"/>
            <line x1="0" y1="0" x2="40" y2="40" stroke="#D4A847" strokeWidth="0.4" opacity="0.04"/>
          </pattern>
          <pattern id="hgrid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect width="80" height="80" fill="none"/>
            <line x1="0" y1="0" x2="80" y2="0" stroke="#D4A847" strokeWidth="0.5" opacity="0.06"/>
            <line x1="0" y1="0" x2="0" y2="80" stroke="#D4A847" strokeWidth="0.5" opacity="0.06"/>
          </pattern>
        </defs>

        <rect width="680" height="400" fill="#161616"/>
        <rect width="680" height="400" fill="url(#dot)"/>
        <rect width="680" height="400" fill="url(#grid)"/>
        <rect width="680" height="400" fill="url(#hgrid)"/>

        <rect x="0" y="0" width="680" height="1" fill="#D4A847" opacity="0.12"/>
        <rect x="0" y="399" width="680" height="1" fill="#D4A847" opacity="0.08"/>
      </svg>
    </div>
  );
}
