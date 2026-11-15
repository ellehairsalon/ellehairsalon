# DESIGN.md · Elle Hair Salon

Reglas de diseño del sitio (web, agenda y panel). Si se cambia algo visual, que siga esto.

## Idea general
Una sola pieza llamativa y todo lo demás tranquilo. La pieza llamativa es el nombre **"Elle"** en cursiva y muy grande al abrir la web, como la cabecera de una revista. El resto: títulos medianos, texto grande y oscuro, mucho aire, fotos sin adornos.
Referencias: lagencedesignstudio.com (aire, títulos pequeños, fotos grandes) y el tema "Wonder Beauty" (nombre gigante al inicio, botones redondos). Solo la estructura; nada de sus textos ni imágenes.

## Colores
| Uso | Valor |
|---|---|
| Fondo (crema) | `#fef9ef` |
| Fondo de bloques | `#f5eee1` |
| Texto (tinta) | `#2a2b2f` |
| Texto secundario | `#515151` |
| Líneas | `#d1c9bf` |
| Acento (terracota): botones | `#b05a36` |
| Terracota oscuro: etiquetas pequeñas y hover | `#7d3a1f` |
| Bloque oscuro (Visítanos, pie) | `#211d1a` con texto `#fef9ef` |

Un solo color de acento. Los verdes, ámbar y rojos del panel son solo para estados (confirmada, prioritaria, cancelar).

## Tipografía
- **Bodoni Moda**: el nombre "Elle", títulos y nombres de categoría. Peso 500 en títulos.
  - Bodoni tiene trazos muy finos. Por eso los títulos de lectura usan un corte más firme: `font-variation-settings:'opsz' 18–22`. Solo el "Elle" gigante usa el corte fino (`'opsz' 96`).
  - La cursiva se reserva para "Elle" y para los subtítulos del menú (Mujer, Hombre, Niños). No se pone una palabra suelta en cursiva dentro de los títulos de la web.
- **Albert Sans**: todo lo demás (textos, botones, horas y datos). Las horas y cifras pequeñas van en Albert Sans 500–600, nunca en Bodoni.
- Texto de lectura en la web: 17–18 px, color `#3d3a37`. Nunca menor a 16 px. En el panel, nunca menor a 12 px.
- Sin MAYÚSCULAS espaciadas en la web: botones, menú y enlaces van en minúsculas normales ("Agendar cita"), que se leen más rápido.

## Componentes de la web (`app/page.js` + `app/home.css`, todo bajo `.home`)
- **Botón** (`.hm-btn`): píldora terracota, texto blanco de 17 px, alto mínimo 54 px. Es el mismo lenguaje redondo de la agenda.
- **Enlace** (`.hm-link`): texto subrayado con línea fina.
- **Inicio**: "Elle" gigante + "Hair Salon" debajo, una frase que dice qué es y dónde, el botón y una foto vertical.
- **El salón**: dos fotos encimadas (la grande del local, la pequeña de detalle) + texto + calificación de Google.
- **Servicios**: una carta. Nombre a la izquierda, puntos, tiempo a la derecha. Dos columnas en computador. Sin precios. Se lee de la base de datos.
- **Cómo llegar**: bloque oscuro con la dirección como título, horario, WhatsApp e Instagram.
- **Fotos**: proporción 4:5 o 3:4, sin bordes redondeados ni sombras.
- **Movimiento**: solo una entrada suave al cargar el inicio. Nada más se anima.

## Agenda y panel
Conservan su forma actual (tarjetas redondeadas, píldoras, emojis en el menú del panel): son herramientas de uso diario y deben ser amables y fáciles, no "de revista". Comparten con la web los colores y las dos tipografías.

## Qué evitar
Degradados, sombras fuertes, más de un color de acento, texto gris claro, letra fina en datos pequeños, etiquetas en mayúsculas sobre cada título, fotos de banco de imágenes.

## Fotos
Están en `public/fotos/`. Para cambiarlas, reemplaza el archivo con el mismo nombre (`secador.jpg`, `peines.jpg`, `plancha.jpg`, `espejos.jpg`). Ideal: 1600 px de ancho o más.
