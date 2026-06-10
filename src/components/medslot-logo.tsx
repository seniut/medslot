type MedSlotLogoProps = {
  /** Tailwind sizing/utility classes; control the rendered size here. */
  className?: string;
  /** Accessible label; pass an empty string when the logo is decorative. */
  title?: string;
};

/**
 * MedSlot brand mark: a teal calendar (card + binder rings) with a medical
 * cross, representing medical appointment slots. Shares its artwork with the
 * favicon at `src/app/icon.svg`. Size it via `className` (e.g. `h-5 w-5`).
 */
export function MedSlotLogo({
  className,
  title = "MedSlot",
}: MedSlotLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="medslot-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#medslot-logo-bg)" />
      <rect x="170" y="96" width="30" height="72" rx="15" fill="#ffffff" />
      <rect x="312" y="96" width="30" height="72" rx="15" fill="#ffffff" />
      <rect x="108" y="140" width="296" height="272" rx="44" fill="#ffffff" />
      <path
        d="M152 140 H360 A44 44 0 0 1 404 184 V200 H108 V184 A44 44 0 0 1 152 140 Z"
        fill="#0f766e"
      />
      <rect x="228" y="231" width="56" height="150" rx="20" fill="#0f766e" />
      <rect x="181" y="278" width="150" height="56" rx="20" fill="#0f766e" />
    </svg>
  );
}
