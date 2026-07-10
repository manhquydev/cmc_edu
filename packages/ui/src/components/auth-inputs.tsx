// Auth-form input composites (@cmc/ui) — fill two Astryx gaps that the LMS
// login form's spec + security hardening (TL12 §9, red-team F11 / AC#5) need:
//
//  1. Astryx TextInput's typed props omit standard <input> attributes the auth
//     fields require — `inputMode` (BaseProps explicitly drops it), `maxLength`
//     and `autoComplete` (BaseProps extends HTMLAttributes, not
//     InputHTMLAttributes). Astryx DOES forward `...rest` onto the real <input>
//     at runtime (verified in dist/TextInput/TextInput.js: `jsx("input", {
//     ...rest, ... })`), so the attributes reach the DOM — only the type blocks
//     them. `TextField` re-adds them to the prop type and forwards them.
//
//  2. Astryx has no PasswordInput (spike finding). `PasswordInput` composes a
//     type=password TextField with a show/hide toggle, preserving
//     autoComplete="current-password".
import { TextInput } from '@astryxdesign/core/TextInput';
import { IconButton } from '@astryxdesign/core/IconButton';
import { useState } from 'react';
import type { ComponentProps } from 'react';

type AstryxTextInputProps = ComponentProps<typeof TextInput>;

/** Standard <input> attributes Astryx TextInput forwards at runtime but does
 * not declare in its typed props. Needed for auth-field parity. */
interface AuthInputExtras {
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  maxLength?: number;
  autoComplete?: string;
  pattern?: string;
}

export type TextFieldProps = AstryxTextInputProps & AuthInputExtras;

/** Astryx TextInput + the standard input attributes its type omits. Use for
 * fields that need inputMode/maxLength/autoComplete/pattern (auth, coded
 * inputs). Plain fields can keep the barrel's TextInput. */
export function TextField(props: TextFieldProps) {
  // One contained boundary cast: the extra attrs are runtime-forwarded by
  // Astryx TextInput's ...rest passthrough but absent from its declared type.
  return <TextInput {...(props as AstryxTextInputProps)} />;
}

export type PasswordInputProps = Omit<TextFieldProps, 'type'>;

/** Password field with a show/hide toggle (Astryx has no PasswordInput).
 * Forwards autoComplete (pass "current-password"/"new-password"). */
export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <TextField {...props} type={visible ? 'text' : 'password'} />
      <div style={{ position: 'absolute', right: 6, bottom: 4 }}>
        <IconButton
          label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          icon={<span aria-hidden="true">{visible ? '🙈' : '👁'}</span>}
          variant="ghost"
          size="sm"
          onClick={() => setVisible((v) => !v)}
        />
      </div>
    </div>
  );
}
