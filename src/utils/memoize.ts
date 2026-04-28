type CacheKey = string | number | symbol;

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

interface MemoizeOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
}

/**
 * Creates a memoized version of a function with optional TTL and cache size limits
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: MemoizeOptions = {},
): T {
  const { ttl = 0, maxSize = 100 } = options;
  const cache = new Map<CacheKey, CacheEntry<ReturnType<T>>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const cached = cache.get(key);

    // Check if cache entry exists and is still valid
    if (cached) {
      if (ttl === 0 || now - cached.timestamp < ttl) {
        return cached.value;
      }
      cache.delete(key);
    }

    // Execute function and cache result
    const result = fn(...args) as ReturnType<T>;

    // Enforce max cache size by removing oldest entries
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, {
      value: result,
      timestamp: now,
    });

    return result;
  }) as T;
}

/**
 * Clears all memoized caches (useful for testing)
 */
export function clearMemoization(): void {
  // This is a placeholder - in a real implementation,
  // you might want to track all memoized functions
}

/**
 * Creates a memoized version of an async function
 */
export function memoizeAsync<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, options: MemoizeOptions = {}): T {
  const { ttl = 0, maxSize = 100 } = options;
  const cache = new Map<CacheKey, CacheEntry<ReturnType<T>>>();
  const pending = new Map<CacheKey, Promise<ReturnType<T>>>();

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const cached = cache.get(key);

    // Check if cache entry exists and is still valid
    if (cached) {
      if (ttl === 0 || now - cached.timestamp < ttl) {
        return cached.value;
      }
      cache.delete(key);
    }

    // Check if there's already a pending request for this key
    const existingPromise = pending.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    // Execute function and cache result
    const promise = fn(...args) as Promise<ReturnType<T>>;
    pending.set(key, promise);

    try {
      const result = await promise;

      // Enforce max cache size by removing oldest entries
      if (cache.size >= maxSize) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }

      cache.set(key, {
        value: result,
        timestamp: now,
      });

      return result;
    } finally {
      pending.delete(key);
    }
  }) as T;
}
