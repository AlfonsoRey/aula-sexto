# Aula sexto

Web educativa independiente en español para tercero y sexto de Primaria, Comunidad de Madrid. **No es una web oficial del CEIPSO Príncipe Felipe** ni cuenta con su aval. Incluye 63 ejercicios originales con pistas progresivas y explicaciones paso a paso: 43 de sexto (los 33 anteriores y 10 nuevos) y 20 de tercero.

Incluye también una pantalla de **1.º de Bachillerato de Galicia**, modalidad Ciencias y Tecnología: Matemáticas I y Física (dentro de Física y Química). Es una selección inicial de **3 documentos externos con ejercicios existentes**, no un banco de ejercicios integrados ni cobertura completa del currículo. No se inventan enunciados, pistas, niveles ni soluciones para estos documentos.

La portada permite elegir curso antes de entrar en materias y temas. Cada curso tiene una pantalla independiente y un enlace directo: `/#/curso/sexto` y `/#/curso/tercero`. Se puede volver a la portada y usar Atrás/Adelante del navegador. No requiere reglas de redirección ni un build en Pages. Cambiar de curso limpia filtros, cajones abiertos y respuestas reveladas; los resultados y la impresión no mezclan cursos.

El nuevo enlace es `/#/curso/bachillerato-galicia`. Muestra Galicia, no Madrid, y separa las dos materias. Los documentos se buscan por título, descripción y etiquetas. No reciben un nivel ficticio: la dificultad se deshabilita en materias sin ejercicios integrados.

## Web pública sin build

Cloudflare Pages ya está conectado al repositorio. Mantener:

| Ajuste | Valor |
| --- | --- |
| Rama de producción | `main` |
| Framework | None |
| Build command | Vacío |
| Build output directory | `public` |

`public` contiene solo HTML, CSS, JavaScript y JSON. No hay framework, cuentas de alumnos, formularios de respuesta, cookies añadidas, trackers ni progreso guardado. El proveedor de alojamiento puede mantener registros técnicos. Las soluciones están en los datos públicos: se ocultan como ayuda pedagógica, no como información confidencial.

**Integrar cambios en `main` puede desplegar automáticamente.** Subir otras ramas puede generar previews. Ni push, ni fusión, ni creación de recursos ni despliegue están autorizados por la mera implementación local.

## Uso local y comprobaciones

Requiere Node.js 22 o posterior (CI usa 24).

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm start
```

Abrir `http://127.0.0.1:4173`. No abrir `index.html` con `file://`: los módulos y la carga de JSON necesitan HTTP. El servidor solo escucha en la máquina local. `PORT` permite elegir otro puerto.

```powershell
npm run validate
npm test
npm run editor:prepare
npm run browser:install
npm run test:browser
$env:WRANGLER_SEND_METRICS = 'false'
npm run editor:check
```

Los navegadores de pruebas se instalan dentro de `node_modules`, no en un directorio compartido. `editor:check` usa **dry-run**: empaqueta localmente sin desplegar ni crear bindings. `editor:prepare` copia la distribución fijada de Decap 3.16.3, sus chunks, CSS, WASM y avisos de licencia desde la dependencia; no hace falta un CDN. Esos assets generados no se versionan. La licencia del proyecto Decap es MIT y sus avisos de terceros se conservan en `editor/assets/vendor/decap-cms.js.LICENSE.txt`.

Las dependencias de Decap son exclusivamente del editor/pruebas; sus advertencias de peer dependencies no afectan a la web pública. La preparación y las pruebas de navegador verifican la distribución empaquetada, no construyen un React nuevo.

El workflow `Validar aula / validar` comprueba contenido, lógica, autenticación, empaquetado y navegador. **Un check no bloquea una fusión por sí solo**: necesita una regla de protección efectiva de GitHub.

## Contenido y ampliación

`public/data/catalog.json` (formato versión 2) enumera cursos, materias y temas. Cada curso tiene un `id`, `title`, `region`, `description` y una lista `subjects` con los IDs de sus materias. Cada materia debe pertenecer a exactamente un curso: sexto usa `matematicas` (se conservan todos los ejercicios y rutas anteriores), tercero usa `matematicas-tercero` y Bachillerato usa `matematicas-bachillerato` y `fisica-bachillerato`. Cada tema apunta a `/data/ID_MATERIA/ID_TEMA.json`; contiene `topic` y una lista `exercises`. Cada ejercicio tiene:

| Campo | Uso |
| --- | --- |
| `id` | Identificador global único y estable, minúsculas y guiones |
| `title`, `statement` | Título y enunciado completo |
| `difficulty` | `inicial`, `intermedio` o `reto` |
| `hints` | Lista de pistas, de menor a mayor ayuda |
| `solution` | Resultado resumido con unidades |
| `steps` | Explicación ordenada |
| `tags` | Palabras de búsqueda, sin datos de personas reales |
| `chart` (opcional) | `caption`, `categoryLabel`, `valueLabel` y `values` con `label` y `value` |

Contenido de texto, **sin HTML**. Se valida tanto localmente/CI como al cargar el sitio, y se renderiza con `textContent`. Si falla un archivo, la web muestra un error y permite reintentar; no sirve una lista parcial aparentando éxito.

Un tema puede añadir `resources`: documentos externos con `id`, `title`, `statement` (descripción), `tags` y `source` (`url`, `recordUrl` opcional, `publisher`, `locator`, `language`, `published`, `license`, `verifiedOn` ISO y `notes`). `exercises` puede estar vacío solo si hay recursos. IDs únicos también entre ejercicios y recursos. Las URLs se limitan a HTTPS sin credenciales en `recursos.edu.xunta.gal` y `www.edu.xunta.gal`; ampliar esta lista requiere revisión. Los recursos no admiten campos de solución, pistas o dificultad.

La interfaz distingue recuentos de ejercicios y documentos. No descarga ni incrusta los PDFs: abrir un enlace, en nueva pestaña sin referente, accede a un tercero con su propia privacidad. Los PDFs pueden incluir respuestas visibles. **Nunca se incluyen en la hoja «Imprimir ejercicios»**: no podemos garantizar impresión sin soluciones de un documento externo. En materias solo de documentos, ese botón queda deshabilitado.

### Fuentes de Bachillerato y límites

Comprobados el 04/10/2026 mediante acceso al PDF, portada/sección y número de páginas:

| Materia | Fuente | Documento |
| --- | --- | --- |
| Matemáticas I | [IES Álvaro Cunqueiro, portal de centros de la Xunta](https://www.edu.xunta.gal/centros/iesalvarocunqueiro/system/files/PENDIENTES%20MATEM%C3%81TICAS%20I_0.pdf) | Cuaderno de refuerzo para 1.º de Bachillerato de Ciencias, 22 páginas; español |
| Física | [Ficha Cinemática de la Xunta](https://recursos.edu.xunta.gal/es/recurso/cinematica) | `Unidade08/arquivos/actividades.pdf`, 21 páginas; gallego |
| Física | Misma ficha | `Unidade08/arquivos/apoio.pdf`, 4 páginas; gallego |

Son materiales docentes publicados en sitios educativos públicos, **no exámenes oficiales ni aval de esta web**. En Matemáticas no se ha verificado permiso de reproducción: se enlaza, sin copiar. La ficha de Física atribuye el recurso a la Consellería de Cultura, Educación e O.U e indica Creative Commons BY-NC-SA; tampoco se reproduce aquí.

La ficha de Física está fechada el 04/07/2013 y la portada del cuaderno de Matemáticas no acredita actualización curricular. La referencia de etapa es el [Decreto 157/2022 de Galicia](https://www.xunta.gal/dog/Publicados/2022/20220926/AnuncioG0655-190922-0003_es.html); no se ha realizado una auditoría integral de adecuación ni de todos los resultados originales. Consultar el profesorado. No usar PAU/ABAU de segundo como si fuera una prueba de primero. Se descartó el recurso genérico de Matemáticas de 2013 del repositorio para no confundir modalidad con Matemáticas I.

Para añadir ejercicios, editar el JSON del tema o su lista en Decap. Para añadir cursos/materias/temas, crear sus archivos de contenido, actualizar el catálogo (incluida la asignación de materias a cursos) y añadir las colecciones de archivos correspondientes en `editor/assets/config.yml`. Mantener las rutas sincronizadas, actualizar pruebas de recuento cuando cambie la colección inicial y ejecutar validación antes de publicar. La navegación se genera del catálogo, sin modificar la lógica de la interfaz.

Tres niveles relativos a cada curso: inicial, intermedio y reto. Los 33 ejercicios originales de sexto mantienen sus niveles (11 por nivel), sin eliminar ni reescribir sus enunciados. Los 10 nuevos añaden operaciones combinadas, factores primos, páginas pendientes, descuentos sucesivos, escala, capacidad, áreas compuestas, moda, probabilidad y tiempo. No representan una calificación ni un diagnóstico. Las series finitas admiten distintas reglas: las soluciones proponen una coherente y piden justificarla.

Los 20 ejercicios de tercero se organizan en cuatro temas: numeración y cálculo; problemas y fracciones sencillas; medidas, tiempo y dinero; formas, datos y lógica. Usan números de hasta cuatro cifras, multiplicación/división con números pequeños, medios y cuartos, equivalencias básicas, perímetros sencillos y lectura de tablas. No trasladan a tercero los descuentos, la media, las escalas, las operaciones con fracciones o los volúmenes de sexto.

El filtro combina materia, tema, nivel y palabras; ignora mayúsculas y acentos y no busca dentro de las respuestas ocultas. Al recrear resultados, pistas y soluciones vuelven a cerrarse. La impresión usa una hoja independiente con los enunciados filtrados, incluso si los cajones están plegados, sin copiar pistas ni soluciones aunque estén abiertas.

## Editor: preparado, todavía no activado

El panel **no está en `public`**. Sus assets y OAuth se sirven desde un Worker independiente que exige una sesión firmada de Cloudflare Access en **todas** las rutas. `workers_dev` y previews del Worker están deshabilitados. Con variables vacías o bindings ausentes rechaza el acceso; no tiene login simulado ni modo de bypass local.

Flujo: Access → Decap → popup GitHub OAuth → callback del Worker → comprobación de identidad y permiso de escritura → borrador en rama/PR de GitHub. El state OAuth tiene cookie Secure/HttpOnly, caduca a los diez minutos y se consume atómicamente en un Durable Object, evitando replays concurrentes.

Decap usa `editorial_workflow` y `publish: false` por colección. Esto oculta la publicación en el panel, **no quita permisos de GitHub**. La revisión y fusión se hacen explícitamente en GitHub. Los borradores y la fusión son mutaciones remotas y deben realizarse solo cuando se autorice operar el editor. El CMS no comprueba por sí solo que una explicación matemática sea correcta.

El backend GitHub necesita un token OAuth en el navegador del editor. **El client secret nunca se entrega al navegador**, pero el token es sensible y Decap puede conservarlo en almacenamiento local de ese origen. No se entrega al alumnado. `public_repo` es el alcance mínimo compatible con un repositorio público, pero **no está limitado a este único repositorio**. Para repositorio privado hay que aprobar el alcance más amplio `repo`. No usar este OAuth como una promesa de aislamiento a un solo repositorio.

La distribución fijada de Decap compila su esquema con Ajv en el navegador: requiere `unsafe-eval` en la CSP **solo del editor**, además de estilos inline de Emotion. La web pública no permite eval ni scripts inline; el callback OAuth usa una política independiente con nonce. Esta limitación de Decap reduce la defensa ante una posible inyección en el editor: mantener el hostname aislado, acceso cerrado, dependencias fijadas y revisión de actualizaciones. No añadir scripts externos ni HTML libre a su contenido.

### Activación posterior, solo con autorización explícita

Estos pasos **no se han ejecutado**:

1. Elegir un hostname HTTPS separado para el editor y comprobar disponibilidad/coste de Workers, Durable Objects y Cloudflare Access. No utilizar el dominio público del alumnado.
2. Crear la aplicación Access para **todo** ese hostname, sin exclusiones ni bypass; permitir solo la identidad del propietario. Obtener issuer y audiencia de la aplicación.
3. Crear una GitHub OAuth App con homepage igual al origen del editor y callback exacto `https://HOST_EDITOR/callback`. Confirmar la visibilidad del repositorio y alcance necesario.
4. Completar `editor/wrangler.jsonc`: `EDITOR_ORIGIN` y `PUBLIC_ORIGIN` sin barra final, `ACCESS_ISSUER` (`https://EQUIPO.cloudflareaccess.com`), `ACCESS_AUD`, `ACCESS_EMAIL`, `GITHUB_CLIENT_ID`, `GITHUB_LOGIN` y `GITHUB_SCOPE`. Son parámetros, no valores inventados.
5. Guardar **solo** `GITHUB_CLIENT_SECRET` como secreto del Worker mediante entrada segura de Cloudflare. No ponerlo en código, JSON, terminal transcrita, `.env` versionado ni configuración Decap. `.dev.vars` está excluido de Git; tampoco compartir sus contenidos.
6. Tras autorizar la creación/despliegue, preparar los assets, desplegar el Worker con su binding `SESSIONS` y añadir el hostname correspondiente. No habilitar workers.dev ni previews. No añadir una ruta pública a los assets que salte el Worker.
7. Configurar protección de `main` con revisión/checks cuando el plan de GitHub lo permita; comprobar que el propietario no usa un bypass para publicar contenido inválido. El check debe estar disponible después de un push autorizado.
8. Comprobar el hostname y todos sus alias sin sesión, con JWT falso y con cuenta ajena; deben negar panel, assets y OAuth. Verificar login del propietario, cancelación, caducidad, borrador/PR y publicación deliberada. Solo entonces declarar el CMS operativo.

Para cerrar sesión, usar el cierre de Decap y visitar `/logout` en el origen del editor: elimina almacenamiento local y ofrece cerrar también Access. Cerrar todas las ventanas del editor; para revocar el token, quitar la autorización OAuth en GitHub. Access y GitHub son sesiones distintas.

Ante errores, el Worker devuelve mensajes explícitos y registra únicamente categorías de fallo, no tokens, códigos OAuth ni secretos. No habilitar logs de cuerpos, URLs completas de callback o cabeceras de autorización en servicios externos. Las pruebas locales usan identidades y respuestas ficticias: **no sustituyen una prueba real de Access/GitHub**, pendiente de activación.

## Referencia pedagógica y accesibilidad

Material de apoyo original para tercero (segundo ciclo) y sexto (tercer ciclo), tomando como referencia el [Decreto 61/2022 de Madrid](https://www.bocm.es/eli/es-md/d/2022/07/13/61/con). Los contenidos del ciclo no se consideran exigibles íntegramente en tercero: la colección es una selección inicial de actividades sencillas y corresponde al centro concretar la progresión. No pretende cubrir todo el currículo ni sustituir la programación del centro.

HTML semántico, foco visible, cajones nativos accesibles con teclado, controles etiquetados, resultados anunciados sin mover el foco, objetivos táctiles de 44 px y diseño desde 320 px. Tema claro/oscuro con fuentes locales, sin red externa. Objetivo WCAG 2.2 AA; las comprobaciones automáticas no equivalen a una certificación y conviene completar una revisión con lector de pantalla real antes de publicar.