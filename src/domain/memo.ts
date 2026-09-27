/**
 * Caches `fn(key)` per key object for as long as the key is alive: analyses and
 * rows are immutable, so anything derived from one is computed once.
 */
export function memoize<K extends object, V>(fn: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, V>();
  return (key) => {
    let value = cache.get(key);
    if (value === undefined && !cache.has(key)) cache.set(key, (value = fn(key)));
    return value as V;
  };
}
