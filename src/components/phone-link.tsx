type PhoneLinkProps = {
  /** Display phone number, e.g. "+48 504 133 182". */
  phone: string;
  /** Optional class override; defaults to the teal link style. */
  className?: string;
};

/**
 * Render a phone number as a `tel:` link so it can be tapped to call on mobile
 * (and opens the configured calling app on desktop). Spaces are stripped from
 * the dial target while the human-readable formatting is preserved in the text.
 * When the phone is empty (e.g. an anonymized patient), an em dash is shown
 * instead of an unusable link.
 */
export function PhoneLink({ phone, className }: PhoneLinkProps) {
  const trimmed = phone.trim();
  if (!trimmed) {
    return <>—</>;
  }

  return (
    <a
      href={`tel:${trimmed.replace(/\s+/g, "")}`}
      className={className ?? "text-teal-700 hover:underline"}
    >
      {phone}
    </a>
  );
}
