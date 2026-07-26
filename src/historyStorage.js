export const readHistoryItems = (storageKey) => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

export const readLatestHistoryValue = (storageKey) => (
  readHistoryItems(storageKey)[0]?.value
);
