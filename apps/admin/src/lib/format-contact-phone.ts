// Display helper for CRM contact phones. Since phase-08, Contact.phone is
// stored in the canonical `84xxxxxxxxx` form; render it back in the familiar
// local `0xxxxxxxxx` form. Any value that is not a well-formed 84-number
// (pre-normalization rows during transition, or non-VN input) passes through
// unchanged.
export function formatContactPhone(stored: string): string {
  if (/^84\d{9}$/.test(stored)) return `0${stored.slice(2)}`;
  return stored;
}
