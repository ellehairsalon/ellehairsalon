// Un emoji por servicio para reconocerlo de un vistazo (cortes, color, tratamientos, peinados…).
const RULES = [
  [/maquillaje|makeup/, '💄'],
  [/trenza/, '🪢'],
  [/diagn[oó]stico/, '🔍'],
  [/mechas|balayage|highlights|rayitos/, '✨'],
  [/tinte|color|ra[ií]z|decolor/, '🎨'],
  [/keratina|alisado|botox|nanoplast/, '💎'],
  [/hidrataci|tratamiento|mascarilla|ampolla|masaje|lavado/, '💆‍♀️'],
  [/evento|recogido|novia|boda|quincea/, '👰'],
  [/peinado|brushing|secado|plancha|ondas|rizos/, '💨'],
  [/ni[ñn][oa]/, '🧒'],
  [/hombre|barba|caballero/, '💈'],
  [/corte|puntas|flequillo/, '✂️'],
];
const BY_CATEGORY = { cortes: '✂️', peinados: '💨', color: '🎨', tratamientos: '💆‍♀️', maquillaje: '💄' };

export function svcEmoji(name = '', category = '') {
  const n = String(name).toLowerCase();
  for (const [re, e] of RULES) if (re.test(n)) return e;
  return BY_CATEGORY[String(category).toLowerCase()] || '💇‍♀️';
}
