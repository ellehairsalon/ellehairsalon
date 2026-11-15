# Elle Hair Salon · v19

## Qué cambió
1. **Seguridad:** Next.js actualizado a 15.5.29 (corrige una falla crítica). Nueva `migration-21.sql` que activa RLS en todas las tablas.
2. **Página web nueva** en la dirección principal (`/`): inicio, el salón, menú de servicios (solo duración), fotos, Instagram y contacto.
3. **La agenda se movió a `/agendar`.** Funciona igual que antes. Los enlaces de citas (`/cita/...`), el panel (`/admin`) y la pantalla (`/pantalla`) no cambian de dirección.
4. **Tipografías nuevas** en todo el sitio: Bodoni Moda en títulos (antes Playfair Display) y Albert Sans en textos. En el panel, las horas pequeñas ahora van en letra simple y gruesa.
5. `DESIGN.md`: las reglas de diseño.

## Pasos para publicar
1. Reemplaza el contenido de tu carpeta del proyecto con el de este zip (no copies tu `.env.local` encima: ese se queda como está).
2. En la carpeta, ejecuta: `npm install`
3. Si en tu carpeta existen `admin/`, `api/`, `Booking.js` o `globals.css` **en la raíz** (fuera de `app/`), bórralos. Son copias viejas que siguen en GitHub.
4. Sube los cambios a GitHub. Vercel publica solo.
5. En Supabase > SQL Editor, pega y ejecuta `migration-21.sql` (una sola vez).
6. En GitHub, pon el repositorio en privado: Settings > Danger Zone > Change visibility.

## Pendientes tuyos
- **Texto "El salón":** lo escribí a mi criterio. Está en `app/page.js`, marcado con `TEXTO A TU CRITERIO`.
- **Fotos:** son recortes de capturas de pantalla, en baja resolución. Reemplázalas en `public/fotos/` con los originales, usando los mismos nombres.
- **Datos del salón** (dirección, teléfono, Instagram, nombre de la dueña, calificación y número de opiniones de Google): están en `lib/config.js`.
- **Horario:** la web lo lee del panel (Ajustes > Horario de atención). Revisa que ahí esté el horario real.
