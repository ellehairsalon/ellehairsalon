export const CATEGORIES = ['Color', 'Tratamientos', 'Styling', 'Herramientas', 'Otros'];
export const CAT_EMOJI = { Color: '🎨', Tratamientos: '💧', Styling: '💨', Herramientas: '✂️', Otros: '📦' };
// 'out' = agotado, 'low' = se está acabando (llegó al mínimo), 'ok' = suficiente
export const stockState = (i) => (+i.qty <= 0 ? 'out' : +i.min_qty > 0 && +i.qty <= +i.min_qty ? 'low' : 'ok');
export const fmtQty = (n) => String(Math.round(+n * 100) / 100).replace('.', ',');
