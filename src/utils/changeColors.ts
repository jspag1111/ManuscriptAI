const PALETTE = [
  '#2563eb', // blue
  '#7c3aed', // violet
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#0d9488', // teal
  '#4f46e5', // indigo
  '#db2777', // pink
];

const hashString = (value: string) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const int = parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const rgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const colorForChangeActorKey = (actorKey: string) => {
  const idx = hashString(actorKey || 'unknown') % PALETTE.length;
  const base = PALETTE[idx];

  return {
    base,
    bg: rgba(base, 0.16),
    bgSoft: rgba(base, 0.08),
    border: rgba(base, 0.55),
    text: '#0f172a',
  };
};

