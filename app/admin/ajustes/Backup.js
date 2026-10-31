export default function Backup() {
  return (
    <div>
      <p className="note">Descarga una copia de todo (clientes, citas e inventario) en un solo archivo de Excel, con una hoja para cada cosa. Te recomendamos hacerlo una vez por semana.</p>
      <div className="actions">
        <a className="btn primary" href="/api/admin/export" download>⬇ Descargar todo</a>
      </div>
    </div>
  );
}
