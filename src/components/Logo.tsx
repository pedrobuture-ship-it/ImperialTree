export function Logo({ size = 28 }: { size?: number }) {
  // Three vertical bars of different heights: a stylised commit stack.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="3" height="18" fill="#dfe4ea" />
      <rect x="10" y="4" width="3" height="26" fill="#dfe4ea" />
      <rect x="16" y="8" width="3" height="18" fill="#dfe4ea" />
      <rect x="22" y="12" width="3" height="10" fill="#36d1e0" />
      <rect x="27.5" y="15" width="1.5" height="4" fill="#ee4b55" />
    </svg>
  );
}
