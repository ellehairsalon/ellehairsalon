'use client';
import { useState, useMemo, useRef } from 'react';
import { CATEGORIES, CAT_EMOJI, BRANDS, SIZE_UNITS, UNITS, stockState, fmtQty, fmtSize, levelOf, toneOf, levelColor, brandOf, itemLabel } from '@/lib/inventory';

const WITH_BRAND = ['Tintes', 'Peróxidos', 'Cuidado del color'];
const DEFAULTS = {
  Tintes: { unit: 'tubos', size_amt: '60', size_unit: 'gr' },
  'Peróxidos': { unit: 'botellas', size_amt: '1000', size_unit: 'ml' },
};
const blank = (category = 'Tintes', brand = '') => ({
  name: '', category, brand, code: '', qty: '1', min_qty: '1', unit: 'unidades', size_amt: '', size_unit: 'ml', note: '', ...(DEFAULTS[category] || {}),
});
const toForm = (it) => ({ ...it, brand: it.brand || '', code: it.code || '', qty: String(it.qty), min_qty: String(it.min_qty), size_amt: it.size_amt ? String(it.size_amt) : '', size_unit: it.size_unit || 'ml', note: it.note || '' });

export default function Inventory({ initial }) {
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState('Tintes'); // 'Tintes' | 'low' | categoría
  const [brand, setBrand] = useState(null);
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(null); // id del producto abierto con − / ＋ grandes
  const [edit, setEdit] = useState(null);
  const [shop, setShop] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [undo, setUndo] = useState(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  const call = async (body) => {
    const r = await fetch('/api/admin/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || 'No se pudo guardar. Revisa tu internet.'); return null; }
    setErr(''); return j;
  };
  const flash = (t) => { setMsg(t); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(''), 2500); };

  async function step(it, delta) {
    const qty = Math.max(0, Math.round((+it.qty + delta) * 100) / 100);
    if (qty === +it.qty) return;
    const before = it.qty;
    setItems((L) => L.map((x) => (x.id === it.id ? { ...x, qty } : x)));
    const j = await call({ action: 'set', id: it.id, qty });
    if (!j) setItems((L) => L.map((x) => (x.id === it.id ? { ...x, qty: before } : x)));
  }

  const low = useMemo(() => items.filter((i) => stockState(i) !== 'ok'), [items]);
  const tints = useMemo(() => items.filter((i) => i.category === 'Tintes'), [items]);
  const brandsShown = useMemo(() => {
    const b = [...BRANDS];
    for (const t of tints) if (t.brand && !b.includes(t.brand)) b.push(t.brand);
    if (tints.some((t) => !t.brand)) b.push('Sin marca');
    return b;
  }, [tints]);
  const activeBrand = brand && brandsShown.includes(brand) ? brand : brandsShown[0];
  const sheetItem = items.find((i) => i.id === sheet) || null;

  // Carta de colores: nivel → códigos, más los especiales (fantasía)
  const chart = useMemo(() => {
    const mine = tints.filter((t) => brandOf(t) === activeBrand);
    const levels = new Map(); const special = [];
    for (const t of mine) {
      const lv = levelOf(t.code);
      if (lv === null) special.push(t); else levels.set(lv, [...(levels.get(lv) || []), t]);
    }
    const rows = [...levels.entries()].sort((a, b) => a[0] - b[0])
      .map(([lv, list]) => [lv, list.sort((a, b) => toneOf(a.code) - toneOf(b.code) || String(a.code).localeCompare(String(b.code), 'es', { numeric: true }))]);
    special.sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name), 'es'));
    return { rows, special, total: mine.length, lowN: mine.filter((t) => stockState(t) !== 'ok').length };
  }, [tints, activeBrand]);

  const searching = q.trim().length > 0;
  const listed = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => (searching ? `${i.name} ${i.code || ''} ${i.brand || ''}`.toLowerCase().includes(t) : tab === 'low' ? stockState(i) !== 'ok' : i.category === tab))
      .sort((a, b) => (stockState(a) === 'ok') - (stockState(b) === 'ok') || a.name.localeCompare(b.name, 'es', { numeric: true }));
  }, [items, tab, q, searching]);

  async function save() {
    const f = { ...edit };
    if (f.category === 'Tintes' && !f.name.trim() && f.code.trim()) f.name = `Tinte ${f.code.trim()}`;
    if (f.name.trim().length < 2) { setErr(f.category === 'Tintes' ? 'Escribe el código del color.' : 'Escribe el nombre del producto.'); return; }
    const payload = { ...f, brand: WITH_BRAND.includes(f.category) ? f.brand : '' };
    const j = await call(f.id ? { action: 'update', ...payload } : { action: 'create', ...payload });
    if (!j) return;
    const patch = {
      name: f.name.trim(), category: f.category, brand: payload.brand || null, code: f.code.trim() || null,
      qty: +f.qty, min_qty: +f.min_qty, unit: f.unit || 'unidades', note: f.note || null,
      size_amt: +f.size_amt > 0 ? +f.size_amt : null, size_unit: +f.size_amt > 0 ? f.size_unit : null,
    };
    if (f.id) setItems((L) => L.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
    else setItems((L) => [...L, j.item]);
    flash(f.id ? 'Guardado ✓' : 'Agregado ✓'); setEdit(null);
  }
  async function remove(it) {
    if (!confirm(`¿Quitar "${it.name}" del inventario?`)) return;
    if (!(await call({ action: 'delete', id: it.id }))) return;
    setItems((L) => L.filter((x) => x.id !== it.id)); setEdit(null); setSheet(null);
    clearTimeout(timer.current); setUndo(it); timer.current = setTimeout(() => setUndo(null), 8000);
  }
  async function restore() {
    const it = undo; setUndo(null);
    if (it && (await call({ action: 'restore', id: it.id }))) setItems((L) => [...L, it]);
  }

  // Lista de compras agrupada por categoría y marca
  const shopGroups = useMemo(() => {
    const g = new Map();
    for (const i of low) {
      const key = i.category === 'Tintes' || i.category === 'Peróxidos' ? `${i.category} · ${brandOf(i)}` : i.category;
      g.set(key, [...(g.get(key) || []), i]);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [low]);
  const lineOf = (i) => `${i.category === 'Tintes' ? i.code || i.name : i.category === 'Peróxidos' ? `${i.code ? i.code + ' vol' : i.name}` : i.name}${fmtSize(i) ? ' (' + fmtSize(i) + ')' : ''} — ${stockState(i) === 'out' ? 'agotado' : `quedan ${fmtQty(i.qty)}`}`;
  const shopText = `Compras · Elle Hair Salon\n` + shopGroups.map(([k, L]) => `\n*${k}*\n` + L.map((i) => `• ${lineOf(i)}`).join('\n')).join('\n');
  async function copy() {
    try { await navigator.clipboard.writeText(shopText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr('No se pudo copiar. Usa el botón de WhatsApp.'); }
  }

  const F = (k) => (e) => setEdit((x) => ({ ...x, [k]: e.target.value }));
  const pickCat = (c) => setEdit((x) => (x.id ? { ...x, category: c } : { ...x, category: c, brand: WITH_BRAND.includes(c) ? x.brand : '', ...(DEFAULTS[c] || { unit: 'unidades', size_amt: '' }) }));
  const openNew = () => { setErr(''); setEdit(blank(tab !== 'low' && CATEGORIES.includes(tab) ? tab : 'Tintes', tab === 'Tintes' && activeBrand !== 'Sin marca' ? activeBrand : '')); };

  const catTabs = CATEGORIES.filter((c) => c === 'Tintes' || items.some((i) => i.category === c));

  const Stepper = ({ it, big }) => (
    <div className={'inv-step' + (big ? ' big' : '')} role="group" aria-label={`Cantidad de ${it.name}`}>
      <button onClick={() => step(it, -1)} disabled={+it.qty <= 0} aria-label="Quitar uno">−</button>
      <span><b>{fmtQty(it.qty)}</b><small>{it.unit}</small></span>
      <button onClick={() => step(it, 1)} aria-label="Agregar uno">＋</button>
    </div>
  );

  return (
    <>
      <div className="inv-head">
        <h1>Inventario</h1>
        <p className="lead">{items.length === 0 ? 'Agrega tus productos para llevar la cuenta.' : low.length ? <b className="inv-warn">{low.length} {low.length === 1 ? 'producto por reponer' : 'productos por reponer'}</b> : 'Todo en orden ✓'}</p>
      </div>

      {low.length > 0 && <button className="btn primary full inv-shop" onClick={() => setShop(true)}>🛒 Ver lista de compras ({low.length})</button>}

      <form className="search" onSubmit={(e) => e.preventDefault()}><span>🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar color o producto (ej. 6.66)" /></form>

      {!searching && (
        <div className="pills" role="tablist" aria-label="Categorías">
          {catTabs.map((c) => (
            <button key={c} role="tab" aria-selected={tab === c} className={'pill' + (tab === c ? ' on' : '')} onClick={() => setTab(c)}>{CAT_EMOJI[c]} {c}</button>
          ))}
          {low.length > 0 && <button role="tab" aria-selected={tab === 'low'} className={'pill alert' + (tab === 'low' ? ' on' : '')} onClick={() => setTab('low')}>Por reponer · {low.length}</button>}
        </div>
      )}

      {err && !edit && <p className="error">{err}</p>}

      {/* ===== Carta de tintes ===== */}
      {!searching && tab === 'Tintes' && (
        <section className="inv-chart">
          <div className="pills inv-brands" role="tablist" aria-label="Marcas">
            {brandsShown.map((b) => {
              const n = tints.filter((t) => brandOf(t) === b).length;
              return <button key={b} role="tab" aria-selected={activeBrand === b} className={'pill' + (activeBrand === b ? ' on' : '')} onClick={() => setBrand(b)}>{b} <small>{n}</small></button>;
            })}
          </div>
          <p className="inv-legend"><i className="ok" />Hay <i className="low" />Se acaba <i className="out" />No hay · toca un color para sumar o restar</p>

          {chart.total === 0 && (
            <div className="inv-empty"><div>🎨</div><b>Aún no hay colores de {activeBrand}</b><p>Toca “＋ Color” para agregar el primero.</p></div>
          )}

          {chart.rows.map(([lv, list]) => (
            <div key={lv} className="inv-level">
              <div className="inv-lvl" style={{ background: levelColor(lv) }} aria-label={`Nivel ${lv}`}>{lv}</div>
              <div className="inv-chips">
                {list.map((t) => <Chip key={t.id} t={t} lv={lv} onOpen={() => setSheet(t.id)} />)}
              </div>
            </div>
          ))}

          {chart.special.length > 0 && (
            <div className="inv-level">
              <div className="inv-lvl sp" aria-label="Especiales">✦</div>
              <div className="inv-chips">
                {chart.special.map((t) => <Chip key={t.id} t={t} lv={null} onOpen={() => setSheet(t.id)} />)}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===== Listas simples (peróxidos, cuidado, rizos, styling, búsqueda…) ===== */}
      {(searching || tab !== 'Tintes') && (
        <div className="inv-list">
          {listed.map((it) => {
            const st = stockState(it);
            return (
              <div key={it.id} className={`inv-card ${st}`}>
                <button className="inv-emo" onClick={() => { setErr(''); setEdit(toForm(it)); }} aria-label={`Editar ${it.name}`}>{CAT_EMOJI[it.category] || '📦'}</button>
                <button className="inv-main" onClick={() => { setErr(''); setEdit(toForm(it)); }}>
                  <b>{it.category === 'Peróxidos' && it.code ? `Peróxido ${it.code} vol` : it.name}</b>
                  <small>
                    {st === 'out' ? <span className="inv-tag out">Agotado</span> : st === 'low' ? <span className="inv-tag low">Se acaba</span> : null}
                    {' '}{[it.brand, fmtSize(it), (searching || tab === 'low') ? it.category : ''].filter(Boolean).join(' · ')}
                  </small>
                </button>
                <Stepper it={it} />
              </div>
            );
          })}
          {listed.length === 0 && items.length > 0 && <p className="note">{tab === 'low' && !searching ? 'Nada por reponer ✓' : 'No hay productos que coincidan.'}</p>}
          {items.length === 0 && (
            <div className="inv-empty">
              <div>📦</div>
              <b>Todavía no hay productos</b>
              <p>Agrega lo que usas en el salón y marca cuántos tienes. El sistema te avisará cuando se esté acabando.</p>
            </div>
          )}
        </div>
      )}

      <button className="fab inv-fab" aria-label={tab === 'Tintes' && !searching ? 'Agregar color' : 'Agregar producto'} onClick={openNew}><span>＋</span><b>{tab === 'Tintes' && !searching ? 'Color' : 'Producto'}</b></button>

      {msg && <div className="snack">{msg}</div>}
      {undo && <div className="snack">Quitaste “{undo.name}” <button onClick={restore}>Deshacer</button></div>}

      {/* ===== Ventana rápida de un color ===== */}
      {sheetItem && !edit && (
        <div className="modal-scrim" onClick={() => setSheet(null)}>
          <div className="modal inv-modal inv-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setSheet(null)} aria-label="Cerrar">✕</button>
            <div className="inv-sheet-top">
              <div className="inv-lvl" style={{ background: levelColor(levelOf(sheetItem.code)) }}>{levelOf(sheetItem.code) ?? '✦'}</div>
              <div>
                <h2>{sheetItem.code || sheetItem.name}</h2>
                <p className="inv-sub">{[sheetItem.brand, fmtSize(sheetItem) && `${sheetItem.unit} de ${fmtSize(sheetItem)}`].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            {sheetItem.name && sheetItem.name !== `Tinte ${sheetItem.code}` && <p className="inv-tone">{sheetItem.name.replace(/^tinte\s+\S+\s*/i, '') || sheetItem.name}</p>}
            <Stepper it={sheetItem} big />
            {stockState(sheetItem) === 'out' && <p className="inv-state out">No hay · va a la lista de compras</p>}
            {stockState(sheetItem) === 'low' && <p className="inv-state low">Se acaba · va a la lista de compras</p>}
            <button className="btn soft full" onClick={() => { setErr(''); setEdit(toForm(sheetItem)); }}>Editar detalles</button>
            <button className="btn primary full" onClick={() => setSheet(null)}>Listo</button>
          </div>
        </div>
      )}

      {/* ===== Editar / agregar ===== */}
      {edit && (
        <div className="modal-scrim" onClick={() => setEdit(null)}>
          <div className="modal inv-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setEdit(null)} aria-label="Cerrar">✕</button>
            <h2>{edit.id ? 'Editar producto' : edit.category === 'Tintes' ? 'Nuevo color' : 'Nuevo producto'}</h2>

            <div className="inv-cats" role="radiogroup" aria-label="Categoría">
              {CATEGORIES.map((c) => (
                <button key={c} role="radio" aria-checked={edit.category === c} className={'pill' + (edit.category === c ? ' on' : '')} onClick={() => pickCat(c)}>{CAT_EMOJI[c]} {c}</button>
              ))}
            </div>

            {WITH_BRAND.includes(edit.category) && (
              <div className="inv-cats" role="radiogroup" aria-label="Marca">
                {[...BRANDS, ...(edit.brand && !BRANDS.includes(edit.brand) ? [edit.brand] : [])].map((b) => (
                  <button key={b} role="radio" aria-checked={edit.brand === b} className={'pill' + (edit.brand === b ? ' on' : '')} onClick={() => setEdit((x) => ({ ...x, brand: x.brand === b ? '' : b }))}>{b}</button>
                ))}
              </div>
            )}

            {edit.category === 'Tintes' && <label>Código del color<input value={edit.code} onChange={F('code')} placeholder="Ej. 6.66" inputMode="decimal" autoFocus={!edit.id} /></label>}
            {edit.category === 'Peróxidos' && <label>Volumen (vol)<input value={edit.code} onChange={F('code')} placeholder="Ej. 20" inputMode="numeric" /></label>}
            <label>{edit.category === 'Tintes' ? 'Nombre del tono (opcional)' : 'Nombre'}
              <input value={edit.name} onChange={F('name')} placeholder={edit.category === 'Tintes' ? 'Ej. Rubio oscuro rojizo' : edit.category === 'Peróxidos' ? 'Ej. Peroxide Yellow 20Vol' : 'Ej. Shampoo color'} autoFocus={!edit.id && edit.category !== 'Tintes'} />
            </label>

            <div className="inv-two">
              <label>Cantidad ahora<input inputMode="decimal" value={edit.qty} onChange={F('qty')} /></label>
              <label>Avisarme cuando queden<input inputMode="decimal" value={edit.min_qty} onChange={F('min_qty')} /></label>
            </div>
            <div className="inv-two">
              <label>Cada envase trae<input inputMode="decimal" value={edit.size_amt} onChange={F('size_amt')} placeholder="Ej. 60" /></label>
              <label>Medida
                <select value={edit.size_unit} onChange={F('size_unit')}>{SIZE_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
              </label>
            </div>
            <label>Se cuenta en
              <select value={edit.unit} onChange={F('unit')}>
                {[...new Set([edit.unit, ...UNITS])].map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label>Nota (opcional)<input value={edit.note} onChange={F('note')} placeholder="Ej. Proveedor o dónde comprarlo" /></label>
            {err && <p className="error">{err}</p>}
            <button className="btn primary full" onClick={save}>{edit.id ? 'Guardar cambios' : 'Agregar'}</button>
            {edit.id && <button className="btn danger full inv-del" onClick={() => remove(edit)}>Quitar del inventario</button>}
          </div>
        </div>
      )}

      {shop && (
        <div className="modal-scrim" onClick={() => setShop(false)}>
          <div className="modal inv-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setShop(false)} aria-label="Cerrar">✕</button>
            <h2>Lista de compras</h2>
            {shopGroups.map(([k, L]) => (
              <div key={k}>
                <h3 className="inv-shop-h">{k}</h3>
                <ul className="inv-shoplist">
                  {L.map((i) => <li key={i.id}><b>{i.category === 'Tintes' ? i.code || i.name : i.category === 'Peróxidos' && i.code ? `${i.code} vol` : i.name}{fmtSize(i) ? <small className="inv-sz"> {fmtSize(i)}</small> : null}</b><small>{stockState(i) === 'out' ? 'Agotado' : `Quedan ${fmtQty(i.qty)}`}</small></li>)}
                </ul>
              </div>
            ))}
            <a className="btn wa full" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(shopText)}`}>💬 Enviar por WhatsApp</a>
            <button className="btn soft full" onClick={copy}>{copied ? '✓ Copiada' : 'Copiar lista'}</button>
          </div>
        </div>
      )}
    </>
  );
}

function Chip({ t, lv, onOpen }) {
  const st = stockState(t);
  return (
    <button className={`inv-chip ${st}`} onClick={onOpen} aria-label={`${t.code || t.name}, ${fmtQty(t.qty)} ${t.unit}`}>
      <span className="sw" style={{ background: lv === null ? 'linear-gradient(135deg,#b46bd1,#5b7cff)' : levelColor(lv) }} />
      <b>{t.code || t.name}</b>
      <em>{fmtQty(t.qty)}</em>
    </button>
  );
}
