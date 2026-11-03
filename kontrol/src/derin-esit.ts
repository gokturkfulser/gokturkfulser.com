// Worker'da `node:util` yok (nodejs_compat açık değil): ayrıştırılmış YAML nesneleri için küçük derin eşitlik (anahtar sırası önemsiz, undefined = yok).
export function derinEsit(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => derinEsit(x, b[i]));
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const anahtarlar = (o: Record<string, unknown>) => Object.keys(o).filter((k) => o[k] !== undefined);
  const ka = anahtarlar(ao);
  const kb = anahtarlar(bo);
  return ka.length === kb.length && ka.every((k) => k in bo && derinEsit(ao[k], bo[k]));
}
