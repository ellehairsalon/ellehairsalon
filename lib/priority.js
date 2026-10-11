// Turno prioritario = horario temprano con recargo. Siempre se presenta con su extra incluido.
export const PRIORITY_NAME = 'Turno prioritario';
export const DEFAULT_BONUS = 'Lavado con masaje de cuero cabelludo';
export const money = (n) => `$${(+n).toFixed(2).replace(/\.00$/, '')}`;
// "+$5" o "+20%" según como lo configuró Elena
export const feeTag = (info) => (info?.type === 'percent' ? `+${+info.value}%` : `+${money(info?.value ?? 0)}`);

// Precio de lista: vacío si no tiene precio definido (Elena lo define en el salón).
export const priceLabel = (price, from) => (+price > 0 ? `${from ? 'desde ' : ''}${money(price)}` : '');
