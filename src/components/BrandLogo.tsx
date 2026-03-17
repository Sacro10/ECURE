interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

export const BrandLogo = ({ compact = false, className = '' }: BrandLogoProps) => {
  const widthClass = compact ? 'h-9 w-9' : 'h-10 w-auto';

  if (compact) {
    return (
      <img
        src="/vibesec-mark.svg"
        alt="Vibesec logo"
        className={`${widthClass} select-none ${className}`.trim()}
        draggable={false}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 512 128"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Vibesec logo"
      className={`${widthClass} select-none ${className}`.trim()}
    >
      <defs>
        <linearGradient id="shieldStrokeInline" x1="16" y1="16" x2="112" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="wordmarkInline" x1="160" y1="26" x2="390" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
        <filter id="glowInline" x="0" y="0" width="150" height="128" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="8" y="8" width="112" height="112" rx="26" fill="#030712" />
      <rect x="8" y="8" width="112" height="112" rx="26" stroke="#1f2937" />

      <g filter="url(#glowInline)">
        <path
          d="M64 24L98 37V64C98 85 84 103 64 110C44 103 30 85 30 64V37L64 24Z"
          fill="#04111f"
          stroke="url(#shieldStrokeInline)"
          strokeWidth="3"
        />
        <path d="M44 58L64 90L84 58" stroke="#10b981" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M37 48H91" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      </g>

      <text
        x="146"
        y="69"
        fill="url(#wordmarkInline)"
        fontFamily="'Audiowide', 'Tektur', 'Orbitron', ui-sans-serif, system-ui"
        fontSize="55"
        fontWeight="700"
        letterSpacing="0.14em"
        textRendering="geometricPrecision"
      >
        VIBESEC
      </text>
      <text
        x="149"
        y="98"
        fill="#67d8df"
        fontFamily="'Oxanium', 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace"
        fontSize="15.5"
        fontWeight="600"
        letterSpacing="0.16em"
        textRendering="geometricPrecision"
      >
        AUTONOMOUS APP SECURITY
      </text>
    </svg>
  );
};
