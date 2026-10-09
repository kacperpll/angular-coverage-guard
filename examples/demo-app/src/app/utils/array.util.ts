export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('size must be greater than zero');
  }

  const result: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }

  return result;
}

export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}
