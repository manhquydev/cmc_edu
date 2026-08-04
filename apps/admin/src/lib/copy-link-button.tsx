// Copy a shareable deep link. Prefer navigator.clipboard in secure contexts;
// fall back to a hidden textarea + execCommand on HTTP LAN (prod-sim).

import { useEffect, useState } from 'react';
import { Button } from '@cmc/ui';
import { goPath, type LinkEntity } from '@cmc/links';

export type CopyLinkButtonProps =
  | { mode: 'go'; entity: LinkEntity; id: string; label?: string }
  | { mode: 'current'; label?: string };

async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand fallback
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function resolveHref(props: CopyLinkButtonProps): string {
  if (props.mode === 'current') {
    return `${window.location.origin}${window.location.pathname}${window.location.search}`;
  }
  return `${window.location.origin}${goPath(props.entity, props.id)}`;
}

export function CopyLinkButton(props: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const label = props.label ?? (copied ? 'Đã copy' : 'Copy link');

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <Button
      label={label}
      size="sm"
      variant="secondary"
      onClick={() => {
        void copyText(resolveHref(props)).then((ok) => {
          if (ok) setCopied(true);
        });
      }}
    />
  );
}
