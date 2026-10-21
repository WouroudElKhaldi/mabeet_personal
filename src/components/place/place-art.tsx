/**
 * A generated "postcard" for places without photos yet: a stone arch framing hills,
 * varied by the place's name so every listing looks distinct.
 */
function hash(seed: string): number {
  let value = 2166136261;
  for (const char of seed) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

export function PlaceArt({ seed, className }: { seed: string; className?: string }) {
  const value = hash(seed);
  const ridge = 40 + (value % 30);
  const sunX = 30 + (value % 40);
  const tilt = (value >> 8) % 20;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <rect width="100" height="100" className="fill-surface-2" />
      <circle cx={sunX} cy={34} r={10} className="fill-glow opacity-70" />
      <path
        d={`M0 ${ridge + 8} Q 30 ${ridge - tilt} 55 ${ridge + 4} T 100 ${ridge - 2} V100 H0Z`}
        className="fill-accent opacity-25"
      />
      <path
        d={`M0 ${ridge + 22} Q 40 ${ridge + 6} 70 ${ridge + 18} T 100 ${ridge + 12} V100 H0Z`}
        className="fill-accent opacity-45"
      />
      <path d="M0 0 H100 V100 H82 V46 A32 32 0 0 0 18 46 V100 H0Z" className="fill-paper opacity-90" />
    </svg>
  );
}
