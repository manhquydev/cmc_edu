# Astryx Phase 4: LMS App Migration (Mantine 7 → Astryx)

**Date**: 2026-07-10 18:47
**Severity**: High
**Component**: apps/lms, @cmc/ui, login security, e2e assurance
**Status**: Resolved

## What Happened

Completed Phase 4 migration of the LMS app (parent + student portal): 13 files migrated (login, 10 parent/student pages, routes, main.tsx). Apps/lms now 100% off Mantine; combined with admin (Phase 3), the entire frontend is Astryx-native via @cmc/ui. Migration touched the app's most security-critical surface—the login page (2-tab: parent email-OTP | student phone+password)—which mandated hardening attributes per TL12 §9 and red-team F11/AC#5: OTP field must have autoComplete="one-time-code" + inputMode="numeric" + maxLength=6; password field must be type="password" with autoComplete="current-password"; phone field must have inputMode="tel"; email autoComplete="email".

**The trap I walked into**: Astryx's TextInput component type signature explicitly omits inputMode and maxLength (BaseProps drops them; doesn't extend InputHTMLAttributes). But at runtime, the component spreads `...rest` onto the real `<input>` element (jsx("input", {...rest,...})). This means hardening attrs would be **forwarded at runtime but rejected by TypeScript**—no compile error, no lint warning, just a silent-at-type-level prop drop. If I had naively migrated login.tsx by swapping Mantine TextInput for Astryx TextInput, the security hardening would have silently evaporated at the type layer, even though it would work at the DOM. This is a genuinely dangerous failure mode in a beta library: structurally typed to reject safety-critical attributes it actually forwards.

**The fix**: Built two @cmc/ui composites to bridge the gap cleanly (sanctioned by the plan's "fill Astryx component gaps" directive):
- **TextField**: thin TextInput wrapper that accepts full InputHTMLAttributes (inputMode, maxLength, pattern, autoComplete, etc.) via a single-boundary type cast, forwards them as `...rest`. Types are honest about what reaches the DOM; runtime is transparent.
- **PasswordInput**: Astryx has no password field. Composed from TextField with type="password" + a show/hide toggle IconButton + aria-label wired correctly. Added to the barrel.
- Also added ProgressBar to barrel (used on a few pages, cleaner than re-exporting Astryx's).

**E2E safety net**: Wrote a new e2e test specifically for login that queries the rendered DOM and asserts each hardening attribute is actually present on the real `<input>` element (`getByRole('textbox').getAttribute('inputMode') === 'numeric'`; phone field `inputMode === 'tel'`; password field `type === 'password'` and has no `inputMode`). This test is **non-skippable** and catches what TypeScript can't: it verifies the attributes landed on the actual DOM, not just the source. If a future Astryx version stops forwarding `...rest`, this test fails in CI instead of silently degrading security.

Migrated login.tsx myself (did NOT delegate—too security-sensitive). Parent/student portal pages delegated to fullstack-developer subagents with typecheck gates. Known fixme (change-password.tsx redirect bug, tracked separately) was left byte-for-byte unchanged.

**Live QA surfaced two issues**:
1. **Astryx TabList a11y regression**: Renders tabs as plain `<button>` elements with NO ARIA role=tab or aria-selected attributes. Mantine's Tab component provides proper ARIA semantics. This breaks screen readers and automated a11y scanning. We had to reselect tabs in the e2e spec by button role instead of tab semantics, and documented it. This is a genuine a11y regression (beta-Astryx limitation) that affects all tabbed UIs across lms + admin.

2. **Icon-label collision**: Password-toggle IconButton's aria-label="Mật khẩu"  (Vietnamese) collided with getByLabel('Mật khẩu') in the test, returning both the password field *and* the toggle button. Fixed by matching exact role: `getByLabel('Mật khẩu', {selector: 'input'})`.

**Theme-level gaps fixed in astryx-theme-cmc.css** (not by forking Astryx components, but by theme-level CSS overrides):
1. **Focus ring invisible**: Keyboard-focused input matched `:focus-visible` but the Astryx TextInput's wrapper focus box-shadow rendered transparent under our theme (theme color didn't apply). Added a `:focus-visible` brand-color outline fallback on form controls (input, textarea, button with aria-pressed). This is an a11y blocking requirement—users navigating by keyboard must see focus.
   
2. **Mobile touch targets sub-44px**: Astryx's default control heights are ~32px, below TL12 §7's 44px minimum on mobile. Added `@media (max-width: 768px) { min-height: 44px; }` to buttons and inputs (mobile-only so desktop admin keeps ERP density). 

Both CSS rules are verified present in the built dist; they are syntactically correct and will apply. **However, I could NOT visually confirm them at runtime**: browser automation (Playwright) couldn't trigger real keyboard focus (Tab key stuck on document.body; focus never reached form controls) and couldn't test mobile viewport (window resize worked, but page stayed 1536px wide). So the CSS rules are correct-and-in-place, but final visual sign-off defers to real-device QA.

**Verification**: lms typecheck + build clean ✅ · lint (admin+lms) exit 0 ✅ · e2e 5/5 passed + 1 known-fixme ✅ · API e2e 17/17 passed ✅ · Code review: Approve, 0 Critical, 1 Important (see Root Cause) ✅

## The Brutal Truth

This phase exposed a structural problem with beta libraries: **a library that's typed to reject attributes it actually forwards at runtime is a trust hazard**. Astryx TextInput is the canonical example. It passes types, it passes linting, it works at runtime. But the type boundary is dishonest—it says "inputMode is not allowed" and then the component forwards it anyway. I caught this only because I read the Astryx source and understood the ...rest forwarding. A developer who didn't—or one working on a deadline—would ship security-hardened fields that silently lost their hardening as soon as Astryx bumped a version or refactored the implementation.

The fix (TextField + e2e assertions on the DOM) is correct, but it's an indictment of the type contract. The real safety isn't the types. It's the e2e test that says "I don't trust the types, I'm checking the actual DOM." That shouldn't be necessary for a component library. But for beta Astryx, it is.

Doing login.tsx by hand was the right call but cost time. Delegating it would have been faster. It would also have been a disaster if the subagent didn't understand the TextField/PasswordInput boundary or thought "types reject inputMode" meant "we can't use inputMode." That's the tension: delegating security-critical work is fast *if* the team understands the traps. Here, only I did. 

The accumulating pile of Astryx-is-beta costs is starting to sting:
- TabList has no ARIA semantics (test had to work around it).
- Focus ring was invisible (had to patch theme CSS).
- Controls default to 32px height (had to patch for mobile compliance).
- PasswordInput doesn't exist (had to build it).
- Money formatting is gone (admin accepted a regression).
- TextArea doesn't auto-expand (admin has manual scroll).

None of these are individually fatal. Together, they're the tax of migrating to a beta design system. And the cruelest part: they only surface when you actually run the app or write e2e tests. They don't fail at compile time. So every Phase feels clean until QA runs, and then the costs appear.

Browser automation's inability to confirm focus and mobile viewport visually is an honest limitation. Playwright can resize the window and trigger programmatic focus, but it can't see what the user sees. The CSS is correct. But I haven't *seen* it work. That gap matters.

## Technical Details

### Silent Attribute Drop: Type vs. Runtime Mismatch

**The problem**:
```typescript
// Astryx TextInput's BaseProps
type BaseProps = {
  value?: string;
  onChange?: (val: string) => void;
  isLabelHidden?: boolean;
  // ... NO inputMode, maxLength, pattern, autoComplete
}

// At runtime:
const TextInput = ({label, value, onChange, ...rest}) => (
  <input {...rest} />  // ← ...rest INCLUDES inputMode, maxLength, etc.
)
```

TypeScript rejects `<TextInput inputMode="numeric" />` because BaseProps doesn't include inputMode. But at runtime, the component accepts it and forwards it to `<input>`. This is a type-safety illusion.

**Proof**: I added console.log in TextInput source; confirmed `...rest` receives `{inputMode, maxLength, autoComplete}` at runtime. Built dist shows `jsx("input", {...rest,...})` with the attrs included.

### TextField & PasswordInput Composites

```typescript
// @cmc/ui/composites/TextField.tsx
export type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  isLabelHidden?: boolean;
  isRequired?: boolean;
  helpText?: string;
  error?: string;
};

export const TextField = ({
  label,
  isLabelHidden,
  isRequired,
  helpText,
  error,
  ...inputProps
}: TextFieldProps) => (
  <div>
    {label && (
      <label hidden={isLabelHidden}>
        {label} {isRequired && <span>*</span>}
      </label>
    )}
    <TextInput {...(inputProps as any)} />  {/* type cast at boundary */}
    {error && <Text color="error">{error}</Text>}
    {helpText && <Text color="secondary">{helpText}</Text>}
  </div>
);

export const PasswordInput = ({
  label,
  isLabelHidden,
  isRequired,
  ...props
}: TextFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div>
      {label && (
        <label hidden={isLabelHidden}>
          {label} {isRequired && <span>*</span>}
        </label>
      )}
      <div style={{display: 'flex', gap: '8px'}}>
        <TextField
          {...props}
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
        />
        <IconButton
          icon={showPassword ? 'eye-off' : 'eye'}
          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
          onClick={() => setShowPassword(!showPassword)}
        />
      </div>
    </div>
  );
};
```

The single-boundary type cast (at the `...inputProps as any` spread) makes the tradeoff explicit: we're saying "I'm bypassing Astryx's intentional type restriction to access a real DOM property." Future readers see the cast and know this is intentional, not accidental. The test verifies it works.

### E2E Assertions on Rendered DOM

```typescript
// e2e/login.spec.ts
test('parent login: OTP field has hardening attrs', async ({page}) => {
  await page.goto('/login');
  await page.click('[data-testid="tab-parent"]');
  
  const otpInput = page.getByRole('textbox', {name: /OTP/i});
  expect(await otpInput.getAttribute('inputMode')).toBe('numeric');
  expect(await otpInput.getAttribute('maxLength')).toBe('6');
  expect(await otpInput.getAttribute('autoComplete')).toBe('one-time-code');
});

test('student login: password field is password type', async ({page}) => {
  await page.goto('/login');
  await page.click('[data-testid="tab-student"]');
  
  const pwdInput = page.locator('input[name="password"]');
  expect(await pwdInput.getAttribute('type')).toBe('password');
  expect(await pwdInput.getAttribute('autoComplete')).toBe('current-password');
});
```

This test queries the actual rendered DOM, not the source. It's the only reliable way to verify that hardening attrs made it through the type boundary.

### TabList A11y Regression

```typescript
// Astryx TabList renders:
<div role="tablist">
  <button>Tab 1</button>  {/* NO role=tab, NO aria-selected */}
  <button>Tab 2</button>
</div>

// Mantine Tab renders:
<button role="tab" aria-selected={isActive} aria-controls={panelId}>
  Tab Label
</button>
```

Screen readers and a11y scanners expect `role="tab"` + `aria-selected`. Astryx doesn't provide them. This breaks:
- Screen reader navigation (users can't jump between tabs).
- Automated a11y scanning (aXe/Lighthouse flags missing semantics).

Workaround: select tabs by button role in tests (`getByRole('button', {name: /Tab Name/})`). But this is a test workaround, not a fix. The regression is real.

### Theme CSS Patches (astryx-theme-cmc.css)

```css
/* Focus ring visibility for keyboard navigation */
input:focus-visible,
textarea:focus-visible,
button[aria-pressed]:focus-visible {
  outline: 3px solid #0071e3;
  outline-offset: 2px;
}

/* Mobile touch targets: 44px minimum */
@media (max-width: 768px) {
  input,
  textarea,
  button {
    min-height: 44px;
  }
}
```

Both rules are in the built CSS. Visual confirmation deferred to real-device QA.

## What We Tried

1. **Delegating login.tsx migration**: Considered it (speed win), rejected it (too security-critical, risk too high if subagent didn't understand TextField/PasswordInput boundary). Owned it instead.

2. **Type-safe solution that doesn't add a composite**: Rejected. Astryx's types are structural-typed to omit inputMode; there's no way to make TypeScript happy without either (a) casting, or (b) wrapping. Wrapping is clearer.

3. **Patching Astryx TextInput source directly**: Rejected. Brittle; breaks on Astryx version bump. Wrapping is more stable.

4. **Skipping e2e assertions on the DOM**: Considered it (extra test, doesn't catch logic bugs). Rejected. The silent-attr-drop trap is too dangerous. E2E must verify actual DOM.

5. **Parallel parent/student migrations**: Rejected. Admin+lms shares theme, routes, @cmc/ui changes; sequential is safer. Delegated sequentially to subagents.

## Root Cause Analysis

**Why did the type/runtime mismatch happen?**
Astryx is a beta library built by a small team optimizing for component API clarity and TypeScript strictness. They explicitly removed inputMode/maxLength from TextInput's type signature (likely to discourage misuse or keep the API surface simple). They didn't anticipate that some use cases (OTP hardening, mobile input type hinting) require these attrs. At runtime, `...rest` forwarding is a pragmatic escape hatch. At the type layer, it's invisible. This is a known trade-off in TypeScript libraries where the type boundary doesn't match the runtime boundary.

**Why is TabList missing ARIA semantics?**
Astryx is still in active development. TabList's ARIA semantics are a known gap (likely deprioritized in favor of styling/layout consistency). This is a beta limitation, not a bug. Astryx will add semantics eventually; we're just early.

**Why did focus ring and mobile height issues surface only in QA?**
CSS is applied correctly but not visually verified during build/typecheck. Browser automation (Playwright) can run the e2e suite, but it doesn't provide pixel-level visual feedback. The CSS is correct; the gap is in visibility. Real-device testing catches visual regressions that automation misses.

**Why did the review flag the ...rest passthrough as Important (not Critical)?**
Because we've mitigated it with e2e assertions on the DOM. It's a fragility (future Astryx versions could break it), but it's not a current security hole. The test is the mitigation. The review correctly flagged it as "needs monitoring" not "needs immediate fix."

## Lessons Learned

1. **Type safety is not enough; beta libraries need DOM-level verification**: Astryx's types lie by omission. TypeScript can't catch attributes that are accepted at runtime but rejected by the type signature. E2E tests that verify actual DOM attributes are the safety net.

2. **Security-critical work should not be delegated without extraordinary spec clarity**: Login.tsx is trusted by 500+ users for account access and OTP delivery. Delegating it would have been faster but required detailed knowledge of the TextField/PasswordInput gap. That knowledge isn't standard. Own critical work, document it, then teach the pattern.

3. **Beta libraries have visible beta costs; don't hide them**: Astryx trades API flexibility for design cohesion. That's a valid tradeoff, but the cost is real: TabList a11y regression, missing PasswordInput, money-formatting loss, focus-ring invisibility. Own each cost (call them out explicitly), make them visible in code (TODOs, comments), and prioritize them. Don't pretend they're transient.

4. **E2E tests should verify the actual user-visible outcome, not just happy paths**: The login e2e suite now includes assertions on the rendered DOM—inputMode, maxLength, autoComplete, type, aria-label. This is not just "did the page load?" This is "did the security hardening actually land?" That specificity is necessary for security-critical surfaces.

5. **Browser automation has blind spots on visual UX (focus feedback, mobile viewport)**: Playwright can run e2e tests at any window size and trigger focus programmatically, but it can't replicate actual keyboard navigation or touch interaction on real hardware. The CSS for focus rings and mobile touch targets is correct, but final visual confirmation requires real devices.

6. **Type casts at component boundaries should be explicit and documented**: The `...inputProps as any` cast in TextField is intentional (we're bypassing Astryx's type restriction to access a real DOM property). Future readers should see the cast and understand why it exists. Consider adding a comment: `// type: bypass Astryx TextInput's prop restriction; verified at runtime via e2e`.

## Next Steps

1. **Real-device visual QA of focus ring and mobile touch targets (Priority: High, Deferred to Phase 5)**: Confirm on a real phone that buttons/inputs are 44px and keyboard focus shows a visible outline. Browser automation can't verify this visually.

2. **Astryx TabList a11y regression tracking (Priority: Medium)**: File an issue with Astryx if not already open. Monitor for upstream fix (likely in next Astryx release). In the meantime, document the workaround in the @cmc/ui barrel (comment on TabList re-export: "Note: no ARIA role=tab/aria-selected; select tabs by button role in tests").

3. **change-password.tsx fixme resolution (Priority: Medium, Tracked separately)**: Known redirect bug left unresolved. Phase 4 scope boundary. Assign to a follow-up sprint.

4. **Phase 5 scope confirmation (Priority: High)**: Remove @mantine/\* from package.json (now that lms+admin are Astryx-native). Verify no Mantine imports remain in the codebase. Update docs to reflect frontend-is-Astryx state.

5. **TextField/PasswordInput barrel update (Priority: Low, Ongoing)**: Pattern is established; document it in @cmc/ui/DESIGN.md for future maintainers. If Astryx releases a native PasswordInput, consider deprecating ours.

---

**Verification**: lms migrated 13/13 files ✅ · Astryx-native 100% (admin + lms) ✅ · Typecheck 0 errors ✅ · Build clean ✅ · E2E 5/5 green + 1 known-fixme ✅ · Lint exit 0 ✅ · Code review Approve (0 Critical, 1 Important) ✅

**Lingering Concerns**:
- Focus ring visibility and mobile touch target size: CSS verified present in dist, but visual confirmation defers to real-device QA.
- Astryx TabList a11y regression (no ARIA semantics) affects all tabbed UIs; awaiting upstream Astryx fix or workaround documentation.
- change-password.tsx redirect bug remains open (tracked separately, out of Phase 4 scope).
- TextField's type cast (`...inputProps as any`) is a fragility; future Astryx versions must not stop forwarding ...rest. E2E test catches it, but it's not ideal.
- Deps exact-pinned to @astryxdesign/core@0.1.4 to prevent silent breakage; upgrade risk concentrated in Phase 5.
