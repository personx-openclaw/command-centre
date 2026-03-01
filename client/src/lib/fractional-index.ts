/**
 * Fractional indexing for drag-and-drop ordering
 * Generates positions between any two positions
 */

const BASE = 62;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function getChar(index: number): string {
  return CHARS[index];
}

function getIndex(char: string): number {
  return CHARS.indexOf(char);
}

export function generateKeyBetween(a: string | null, b: string | null): string {
  if (a === null && b === null) {
    return getChar(BASE / 2);
  }

  if (a === null) {
    const bIndex = getIndex(b![0]);
    if (bIndex === 0) {
      return getChar(0) + generateKeyBetween(null, b!.slice(1) || null);
    }
    return getChar(bIndex / 2);
  }

  if (b === null) {
    const aIndex = getIndex(a[0]);
    if (aIndex === BASE - 1) {
      return a + getChar(BASE / 2);
    }
    return getChar((aIndex + BASE) / 2);
  }

  // Both exist
  const aIndex = getIndex(a[0]);
  const bIndex = getIndex(b[0]);

  if (aIndex + 1 < bIndex) {
    return getChar(Math.floor((aIndex + bIndex) / 2));
  }

  if (a.length === 1 && b.length === 1) {
    return a + getChar(BASE / 2);
  }

  return a[0] + generateKeyBetween(a.slice(1) || null, b.slice(1) || null);
}

export function generateNKeys(n: number, start: string | null = null): string[] {
  const keys: string[] = [];
  let prev = start;

  for (let i = 0; i < n; i++) {
    const next = generateKeyBetween(prev, null);
    keys.push(next);
    prev = next;
  }

  return keys;
}
