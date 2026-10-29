'use client';
import { useState, useMemo, useRef } from 'react';
import { CATEGORIES, CAT_EMOJI, stockState, fmtQty } from '@/lib/inventory';

const UNITS = ['unidades', 'tubos', 'botellas', 'frascos', 'paquetes', 'litros'];
const blank = { name: '', category: 'Color', qty: '1', min_qty: '1', unit: 'unidades', note: '' };

export default function Inventory({ initial }) {
  const [items, setItems] = useState(initial);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null); // null | {…campos, id?}
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
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => (cat === 'all' ? true : cat === 'low' ? stockState(i) !== 'ok' : i.category === cat)
      && (!t || i.name.toLowerCase().includes(t)))
      .sort((a, b) => (stockState(a) === 'ok') - (stockState(b) === 'ok') || a.name.localeCompare(b.name, 'es'));
  }, [items, cat, q]);

  async function save() {
    const f = edit;
    if (f.name.trim().length < 2) { setErr('Escribe el nombre del producto.'); return; }
    const j = await call(f.id ? { action: 'update', ...f } : { action: 'create', ...f });
    if (!j) return;
    if (f.id) setItems((L) => L.map((x) => (x.id === f.id ? { ...x, name: f.name.trim(), category: f.category, qty: +f.qty, min_qty: +f.min_qty, unit: f.unit || 'unidades', note: f.note || null } : x)));
    else setItems((L) => [...L, j.item]);
    flash(f.id ? 'Guardado ✓' : 'Producto agregado ✓'); setEdit(null);
  }
  async function remove(it) {
    if (!confirm(`¿Quitar "${it.name}" del inventario?`)) return;
    if (!(await call({ action: 'delete', id: it.id }))) return;
    setItems((L) => L.filter((x) => x.id !== it.id)); setEdit(null);
    clearTimeout(timer.current); setUndo(it); timer.current = setTimeout(() => setUndo(null), 8000);
  }
  async function restore() {
    const it = undo; setUndo(null);
    if (it && (await call({ action: 'restore', id: it.id }))) setItems((L) => [...L, it]);
  }

  const shopText = `Compras · Elle Hair Salon\n\n` + low.map((i) => `• ${i.name} — ${stockState(i) === 'out' ? 'agotado' : `quedan ${fmtQty(i.qty)}`}`).join('\n');
  async function copy() {
    try { await navigator.clipboard.writeText(shopText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr('No se pudo copiar. Usa el botón de WhatsApp.'); }
  }

  const F = (k) => (e) => setEdit((x) => ({ ...x, [k]: e.target.value }));

  return (
    <>
      <div className="inv-head">
        <h1>Inventario</h1>
        <p className="lead">{items.length === 0 ? 'Agrega tus productos para llevar la cuenta.' : low.length ? <b className="inv-warn">{low.length} {low.length === 1 ? 'producto por reponer' : 'productos por reponer'}</b> : 'Todo en orden ✓'}</p>
      </div>

      {low.length > 0 && <button className="btn primary full inv-shop" onClick={() => setShop(true)}>🛒 Ver lista de compras ({low.length})</button>}

      {items.length > 0 && (
        <>
          <form className="search" onSubmit={(e) => e.preventDefault()}><span>🔍</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" /></form>
          <div className="pills" role="tablist" aria-label="Categorías">
            <button role="tab" aria-selected={cat === 'all'} className={'pill' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>Todos</button>
            {low.length > 0 && <button role="tab" aria-selected={cat === 'low'} className={'pill alert' + (cat === 'low' ? ' on' : '')} onClick={() => setCat('low')}>Por reponer · {low.length}</button>}
            {CATEGORIES.filter((c) => items.some((i) => i.category === c)).map((c) => (
              <button key={c} role="tab" aria-selected={cat === c} className={'pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
        </>
      )}

      {err && <p className="error">{err}</p>}

      <div className="inv-list">
        {shown.map((it) => {
          const st = stockState(it);
          return (
            <div key={it.id} className={`inv-card ${st}`}>
              <button className="inv-emo" onClick={() => setEdit({ ...it, qty: String(it.qty), min_qty: String(it.min_qty), note: it.note || '' })} aria-label={`Editar ${it.name}`}>{CAT_EMOJI[it.category] || '📦'}</button>
              <button className="inv-main" onClick={() => setEdit({ ...it, qty: String(it.qty), min_qty: String(it.min_qty), note: it.note || '' })}>
                <b>{it.name}</b>
                <small>
                  {st === 'out' ? <span className="inv-tag out">Agotado</span> : st === 'low' ? <span className="inv-tag low">Se acaba</span> : it.category}
                </small>
              </button>
              <div className="inv-step" role="group" aria-label={`Cantidad de ${it.name}`}>
                <button onClick={() => step(it, -1)} disabled={+it.qty <= 0} aria-label="Quitar uno">−</button>
                <span><b>{fmtQty(it.qty)}</b><small>{it.unit}</small></span>
                <button onClick={() => step(it, 1)} aria-label="Agregar uno">＋</button>
              </div>
            </div>
          );
        })}
        {items.length > 0 && shown.length === 0 && <p className="note">No hay productos que coincidan.</p>}
        {items.length === 0 && (
          <div className="inv-empty">
            <div>📦</div>
            <b>Todavía no hay productos</b>
            <p>Agrega lo que usas en el salón (tintes, shampoo, keratina…) y marca cuántos tienes. El sistema te avisará cuando se esté acabando.</p>
          </div>
        )}
      </div>

      <button className="fab inv-fab" aria-label="Agregar producto" onClick={() => { setErr(''); setEdit({ ...blank, category: cat !== 'all' && CATEGORIES.includes(cat) ? cat : 'Color' }); }}><span>＋</span><b>Producto</b></button>

      {msg && <div className="snack">{msg}</div>}
      {undo && <div className="snack">Quitaste “{undo.name}” <button onClick={restore}>Deshacer</button></div>}

      {edit && (
        <div className="modal-scrim" onClick={() => setEdit(null)}>
          <div className="modal inv-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setEdit(null)} aria-label="Cerrar">✕</button>
            <h2>{edit.id ? 'Editar producto' : 'Nuevo producto'}</h2>
            <label>Nombre<input value={edit.name} onChange={F('name')} placeholder="Ej. Tinte 6.0 rubio oscuro" autoFocus={!edit.id} /></label>
            <div className="inv-cats" role="radiogroup" aria-label="Categoría">
              {CATEGORIES.map((c) => (
                <button key={c} role="radio" aria-checked={edit.category === c} className={'pill' + (edit.category === c ? ' on' : '')} onClick={() => setEdit((x) => ({ ...x, category: c }))}>{CAT_EMOJI[c]} {c}</button>
              ))}
            </div>
            <div className="inv-two">
              <label>Cantidad ahora<input inputMode="decimal" value={edit.qty} onChange={F('qty')} /></label>
              <label>Avisarme cuando queden<input inputMode="decimal" value={edit.min_qty} onChange={F('min_qty')} /></label>
            </div>
            <label>Se cuenta en
              <select value={edit.unit} onChange={F('unit')}>
                {[...new Set([edit.unit, ...UNITS])].map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label>Nota (opcional)<input value={edit.note} onChange={F('note')} placeholder="Ej. Marca, proveedor o dónde comprarlo" /></label>
            {err && <p className="error">{err}</p>}
            <button className="btn primary full" onClick={save}>{edit.id ? 'Guardar cambios' : 'Agregar producto'}</button>
            {edit.id && <button className="btn danger full inv-del" onClick={() => remove(edit)}>Quitar del inventario</button>}
          </div>
        </div>
      )}

      {shop && (
        <div className="modal-scrim" onClick={() => setShop(false)}>
          <div className="modal inv-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setShop(false)} aria-label="Cerrar">✕</button>
            <h2>Lista de compras</h2>
            <ul className="inv-shoplist">
              {low.map((i) => <li key={i.id}><b>{i.name}</b><small>{stockState(i) === 'out' ? 'Agotado' : `Quedan ${fmtQty(i.qty)}`}</small></li>)}
            </ul>
            <a className="btn wa full" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(shopText)}`}>💬 Enviar por WhatsApp</a>
            <button className="btn soft full" onClick={copy}>{copied ? '✓ Copiada' : 'Copiar lista'}</button>
          </div>
        </div>
      )}
    </>
  );
}
