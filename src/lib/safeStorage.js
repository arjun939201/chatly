// Guard browser storage access: privacy settings, sandboxed frames, and quota errors
// must never prevent the application from rendering or saving remote data.
export function getStoredValue(key, fallback = null) {
  try {
    return globalThis.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setStoredValue(key, value) {
  try {
    globalThis.localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function getStoredJSON(key, fallback) {
  const raw = getStoredValue(key, null);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setStoredJSON(key, value) {
  try {
    return setStoredValue(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
