export default function Backup() {
  return (
    <div>
      <p className="note">Descarga una copia de tus datos para guardarla en tu computador (se abre en Excel). Te recomendamos hacerlo una vez por semana.</p>
      <div className="actions">
        <a className="btn soft" href="/api/admin/export?tipo=clientes" download>⬇ Clientes</a>
        <a className="btn soft" href="/api/admin/export?tipo=citas" download>⬇ Citas</a>
        <a className="btn soft" href="/api/admin/export?tipo=inventario" download>⬇ Inventario</a>
      </div>
    </div>
  );
}
