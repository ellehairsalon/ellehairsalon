// Agrupa los servicios de una categoría: subtítulo (Mujer / Hombre…) → tarjetas (un servicio con varias opciones = una tarjeta).
export function sections(list) {
  const out = [];
  list.forEach((s) => {
    const sub = s.subgroup || '';
    let sec = out.find((x) => x.sub === sub);
    if (!sec) { sec = { sub, cards: [] }; out.push(sec); }
    const key = s.group_name || s.name;
    let card = sec.cards.find((c) => c.key === key);
    if (!card) { card = { key, items: [] }; sec.cards.push(card); }
    card.items.push(s);
  });
  return out;
}
