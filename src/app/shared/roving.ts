/**
 * WAI-ARIA tabs keyboard model: returns the index an arrow / Home / End key
 * moves to, or null if the key is not a navigation key.
 */
export function rovingIndex(event: KeyboardEvent, current: number, count: number): number | null {
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** Handles a keydown on a tablist: updates the selection and moves focus. */
export function handleTablistKey(
  event: KeyboardEvent,
  current: number,
  count: number,
  select: (index: number) => void,
  focusId: (index: number) => string,
): void {
  const next = rovingIndex(event, current, count);
  if (next === null) return;
  event.preventDefault();
  select(next);
  document.getElementById(focusId(next))?.focus();
}
