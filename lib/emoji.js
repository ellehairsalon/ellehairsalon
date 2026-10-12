// Un emoji distinto por servicio para reconocerlo de un vistazo.
const RULES = [
  [/maquillaje|makeup/, '💄'],
  [/trenza/, '🎀'],
  [/recogido|mo[ñn]o|evento|novia|boda|quincea/, '💇‍♀️'],
  [/ondas|rizos/, '🌀'],
  [/mechas|balayage|highlights|rayitos|rayos|iluminaci/, '✨'],
  [/tinte|color|ra[ií]z|decolor/, '🎨'],
  [/keratina|alisado|botox|nanoplast/, '💎'],
  [/hidrataci|mascarilla|ampolla/, '💧'],
  [/tratamiento|masaje|lavado/, '💆‍♀️'],
  [/peinado|brushing|cepillado|secado|plancha/, '💨'],
  [/ni[ñn][oa]/, '🧒'],
  [/hombre|barba|caballero/, '💈'],
  [/corte|puntas|flequillo/, '✂️'],
];
const BY_CATEGORY = { corte: '✂️', cortes: '✂️', peinados: '💨', color: '🎨', tratamientos: '💆‍♀️', maquillaje: '💄' };

export function svcEmoji(name = '', category = '') {
  const n = String(name).toLowerCase();
  for (const [re, e] of RULES) if (re.test(n)) return e;
  return BY_CATEGORY[String(category).toLowerCase()] || '💇‍♀️';
}
