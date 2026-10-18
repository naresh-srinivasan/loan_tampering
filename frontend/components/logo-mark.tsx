export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-sm ring-1 ring-indigo-900/10"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5l7.5 3.3v5.1c0 4.8-3.1 8.9-7.5 10.1-4.4-1.2-7.5-5.3-7.5-10.1V5.8L12 2.5z" />
        <path d="M9 12l2 2 4-4.2" />
      </svg>
    </span>
  );
}
