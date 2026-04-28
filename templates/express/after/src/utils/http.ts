export function ok<T>(value: T) {
  return {
    ok: true,
    value,
  };
}
