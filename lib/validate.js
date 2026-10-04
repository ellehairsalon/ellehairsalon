// Ecuador: 09XXXXXXXX o 9XXXXXXXX -> +5939XXXXXXXX. Otros países: con código, ej. +1...
export const normPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '593' + d.slice(1);
  else if (d.length === 9 && d.startsWith('9')) d = '593' + d;
  return d.length >= 11 && d.length <= 15 ? '+' + d : null;
};

export const validEmail = (e) => e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

const DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const validBirthday = (m, d) => Number.isInteger(m) && Number.isInteger(d) && m >= 1 && m <= 12 && d >= 1 && d <= DIM[m - 1];

// Cédula ecuatoriana de 10 dígitos, con el dígito verificador del Registro Civil.
export const validCedula = (s) => {
  if (!/^\d{10}$/.test(s)) return false;
  const prov = +s.slice(0, 2);
  if (!((prov >= 1 && prov <= 24) || prov === 30) || +s[2] > 5) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) { let v = +s[i] * (i % 2 === 0 ? 2 : 1); if (v > 9) v -= 9; sum += v; }
  return (10 - (sum % 10)) % 10 === +s[9];
};
