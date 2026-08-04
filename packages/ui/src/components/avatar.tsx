/**
 * Identity mark — Airbnb trust / Cal booking avatar language.
 * Initials fallback when no image. Requires @cmc/ui/premium.css (.ck-av*).
 */
export interface AvatarProps {
  name: string;
  /** Optional image URL. */
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Soft ring (trust signal). */
  ring?: boolean;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function Avatar({ name, src, size = 'md', ring = false }: AvatarProps) {
  const initials = initialsFrom(name);
  const cls = [
    'ck-av',
    `ck-av--${size}`,
    ring ? 'is-ring' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (src) {
    return (
      <span className={cls} title={name}>
        <img src={src} alt="" className="ck-av-img" />
      </span>
    );
  }
  return (
    <span className={cls} title={name} aria-label={name}>
      <span className="ck-av-initials" aria-hidden>
        {initials}
      </span>
    </span>
  );
}
