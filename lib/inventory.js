export const CATEGORIES = ['Tintes', 'Peróxidos', 'Cuidado del color', 'Rizos', 'Styling', 'Tratamientos', 'Herramientas', 'Otros'];
export const CAT_EMOJI = { Tintes: '🎨', 'Peróxidos': '🧴', 'Cuidado del color': '💜', Rizos: '🌀', Styling: '💨', Tratamientos: '💧', Herramientas: '✂️', Otros: '📦' };
export const BRANDS = ['Yellow', 'Alfaparf', 'Salon In'];
export const SIZE_UNITS = ['gr', 'ml'];
export const UNITS = ['tubos', 'botellas', 'unidades', 'frascos', 'paquetes'];

// 'out' = agotado, 'low' = se está acabando (llegó al mínimo), 'ok' = suficiente
export const stockState = (i) => (+i.qty <= 0 ? 'out' : +i.min_qty > 0 && +i.qty <= +i.min_qty ? 'low' : 'ok');
export const fmtQty = (n) => String(Math.round(+n * 100) / 100).replace('.', ',');
export const fmtSize = (i) => (i.size_amt ? `${fmtQty(i.size_amt)} ${i.size_unit || ''}`.trim() : '');

// Nivel de un código de tinte: "6.66" → 6, "10.21" → 10. Los que no siguen ese formato (Magenta, 410…) van a "Especiales".
export const levelOf = (code) => {
  const m = /^(\d{1,2})(\.\d+)?$/.exec(String(code || '').trim());
  return m ? +m[1] : null;
};
// Orden dentro de un nivel: por el tono (6.1 antes que 6.66; "6" y "6.00" primero)
export const toneOf = (code) => {
  const t = String(code || '').split('.')[1];
  return t === undefined ? -1 : parseFloat('0.' + t);
};

// Color aproximado del círculo según el nivel (1 = negro … 10 = rubio muy claro)
const LEVEL_COLORS = ['#1c1714', '#241c17', '#33261d', '#4a3426', '#6b4a33', '#8a6240', '#a9805a', '#c7a272', '#dcc08d', '#ead7a8', '#f3e8c4', '#f7efd8'];
export const levelColor = (lvl) => LEVEL_COLORS[Math.max(0, Math.min(11, lvl ?? 6))];

export const brandOf = (i) => i.brand || 'Sin marca';
export const itemLabel = (i) => {
  if (i.category === 'Tintes') return `${i.brand ? i.brand + ' · ' : ''}${i.code || i.name}${fmtSize(i) ? ' · ' + fmtSize(i) : ''}`;
  return i.name + (fmtSize(i) ? ` · ${fmtSize(i)}` : '');
};
