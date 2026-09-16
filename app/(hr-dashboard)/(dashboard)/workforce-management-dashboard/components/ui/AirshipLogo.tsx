import React from 'react';

interface AirshipLogoProps {
  /** Width in px; height auto-scales to preserve the aspect ratio. */
  size?: number;
  className?: string;
  /** Render the "A" in white instead of near-black (for dark/pink backgrounds). */
  invert?: boolean;
}

/**
 * Airship Express "AX" monogram: a bold "A" beside three magenta chevrons.
 * Recreated as inline SVG so it stays crisp at any size and needs no asset.
 */
export function AirshipLogo({ size = 44, className = '', invert = false }: AirshipLogoProps) {
  const aFill = invert ? '#ffffff' : '#1f1f1f';
  const chevrons = [104, 150, 196]; // apex x of each left-pointing chevron
  return (
    <svg
      viewBox="0 0 232 100"
      width={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Airship Express"
    >
      {/* Bold "A" with a triangular counter punched out (evenodd). */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill={aFill}
        d="M 48 8 L 92 92 L 68 92 L 60 74 L 36 74 L 28 92 L 4 92 Z
           M 48 40 L 40 58 L 56 58 Z"
      />
      {/* Three left-pointing brand-magenta chevrons. */}
      {chevrons.map((ax) => (
        <polyline
          key={ax}
          points={`${ax + 30},14 ${ax},50 ${ax + 30},86`}
          fill="none"
          stroke="#E6007A"
          strokeWidth={16}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
    </svg>
  );
}
