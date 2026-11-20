// Shared builders for the cart specs. No test case lives in this file.
export function buildCart(items: number[] = []) {
  return { items, total: items.reduce((sum, n) => sum + n, 0) };
}
