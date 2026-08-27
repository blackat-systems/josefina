# Dependencia D0 — Contrato y alcance de servicios

Trabajás como especialista de la dependencia D0 del proyecto Josefina.

## QUÉ HACE

D0 establece una única fuente de verdad para los servicios públicos de Josefina, impone un techo técnico de cuatro plataformas y documenta el contrato que compartirán el backend, los futuros adaptadores especializados y la futura UI.

Las únicas plataformas públicas de Josefina son, exactamente y en este orden:

1. `instagram`
2. `tiktok`
3. `youtube`
4. `facebook`

## POR QUÉ EXISTE

Cobalt conserva 21 adaptadores y hoy deriva su alcance público desde ese catálogo completo. Ocultar nombres en la UI o configurar `DISABLED_SERVICES` no alcanza: una ruta interna o una API key con `allowedServices: "all"` puede volver a exponer servicios fuera del producto.

D0 debe separar el registro heredado de Cobalt de la superficie pública de Josefina sin borrar código útil ni reescribir la arquitectura.

## ROL Y LÍMITE DE LA DEPENDENCIA

Tu única responsabilidad es D0. No implementes ni repares descargas de Instagram, TikTok, YouTube o Facebook. No diseñes la UI. No integres otras dependencias.

Trabajá directamente en:

`C:\Users\Joaquin\Desktop\chatgptprojects\josefina`

No crees otra rama, worktree, commit o remoto. No hagas `push`, `merge`, `rebase`, `reset`, `clean` ni descartes archivos. Al finalizar, devolvé un handoff a MAIN con los cambios sin commit.

## PUERTA 0 OBLIGATORIA

Antes de editar:

1. Confirmá la ruta exacta del proyecto.
2. Leé completos `AGENTS.md` y `docs/STATUS.md`.
3. Inspeccioná `README.md`, `package.json`, `pnpm-workspace.yaml`, `api/package.json` y `web/package.json`.
4. Registrá:
   - `git status --short --branch`;
   - raíz Git;
   - rama y HEAD;
   - remotos;
   - worktrees;
   - diff rastreado;
   - archivos no rastreados.
5. Confirmá como base esperada:
   - rama `main` siguiendo `upstream/main`;
   - HEAD `a636575b09de1fc55d9b8cd98cac88f5f2f16b42`;
   - remoto `upstream` = `https://github.com/imputnet/cobalt.git`;
   - únicos archivos locales iniciales no rastreados: `AGENTS.md`, `docs/STATUS.md` y `docs/dependencies/D0_PROMPT.md`.
6. Leé como fuentes de verdad:
   - `api/src/core/env.js`;
   - `api/src/core/api.js`;
   - `api/src/security/api-keys.js`;
   - `api/src/processing/schema.js`;
   - `api/src/processing/url.js`;
   - `api/src/processing/service-config.js`;
   - `api/src/processing/service-patterns.js`;
   - `api/src/processing/service-alias.js`;
   - `api/src/processing/match.js`;
   - `api/src/processing/match-action.js`;
   - `api/src/processing/request.js`;
   - `api/src/util/test.js`;
   - `api/src/misc/run-test.js`;
   - `docs/api.md`;
   - `docs/api-env-variables.md`;
   - `.github/test.sh`;
   - `.github/workflows/test.yml`;
   - `.github/workflows/test-services.yml`;
   - `web/src/lib/types/api.ts`;
   - `web/src/lib/api/api.ts`;
   - `web/src/lib/api/server-info.ts`;
   - `web/src/lib/api/saving-handler.ts`.

Detenete y reportá a MAIN si la ruta, HEAD, rama, remotos o estado inicial no coinciden; si faltan las reglas; o si aparecen cambios ajenos. No intentes corregir un mismatch.

## DECISIONES YA TOMADAS POR MAIN

Estas decisiones no deben reabrirse dentro de D0:

1. El catálogo interno de 21 servicios, sus adaptadores y sus pruebas vivas se conservan por ahora.
2. La superficie pública máxima de Josefina contiene sólo los cuatro IDs canónicos indicados arriba.
3. Debe existir una fuente de verdad propia de Josefina, separada del catálogo heredado.
4. `DISABLED_SERVICES` puede reducir el conjunto habilitado, pero nunca agregar una quinta plataforma.
5. Una API key con `allowedServices: "all"` significa “todos los servicios de Josefina”, no todos los adaptadores heredados.
6. Una URL reconocida de un servicio heredado excluido debe terminar como `service.disabled` internamente y `error.api.service.disabled` en la API.
7. Un dominio desconocido conserva `link.invalid`; una ruta no soportada de una plataforma incluida conserva `link.unsupported`.
8. `GET /` debe anunciar exactamente los cuatro servicios habilitados, en orden estable. El namespace `cobalt` del payload se conserva transitoriamente para no romper el frontend actual.
9. La detección de dominios y alias pertenece al backend. No se implementa una allowlist por hostname en la UI.
10. El contrato público actual se conserva: `POST /` y las respuestas `redirect`, `tunnel`, `picker`, `local-processing` y `error`.
11. No se crea ahora un endpoint `/analyze`, un flujo metadata → selección ni un modelo público `MediaInfo`. Esa brecha debe documentarse para una decisión arquitectónica posterior de MAIN.
12. No se eliminan campos heredados del esquema, aunque hoy pertenezcan a servicios fuera de alcance, porque hacerlo puede romper compatibilidad y preferencias persistidas.

## TASK

Implementá el cambio mínimo suficiente para:

1. Crear una fuente canónica e inmutable del alcance de Josefina, preferentemente `api/src/processing/service-scope.js`.
2. Derivar `env.allServices` y `env.enabledServices` desde esa fuente, no desde las 21 claves de `service-config.js`.
3. Normalizar `DISABLED_SERVICES` de forma segura —espacios, vacíos y duplicados— y usarlo únicamente para reducir el alcance.
4. Aplicar el techo público también en `extract()`, de modo que un caller que entregue manualmente un conjunto más amplio no pueda enrutar Vimeo, Twitter u otro servicio excluido.
5. Mantener intactos el registro, los patrones, aliases, imports, adaptadores y manifests de pruebas de los 21 servicios.
6. Mantener el comportamiento existente de API keys dentro del techo de cuatro servicios. Si detectás que cambiar la relación entre API keys y `DISABLED_SERVICES` es imprescindible, no lo decidas silenciosamente: documentá el bloqueo y consultá a MAIN.
7. Agregar una batería determinista y sin red mediante `node:test`, sin incorporar dependencias nuevas.
8. Agregar en `api/package.json` un script explícito:

   `"test:contract": "node --test test/service-contract.test.js"`

   No uses `node --test` sin archivo explícito, porque puede descubrir el runner de pruebas vivas.
9. Sustituir el smoke general de Tumblr en `.github/test.sh` por comprobaciones deterministas de contrato/health que no contacten ninguna plataforma externa.
10. Conservar `api/src/util/test.js` y los 21 JSON de pruebas vivas como catálogo heredado. `get-services` puede seguir enumerando 21; no debe confundirse con la allowlist pública.
11. Crear `docs/JOSEFINA_PLATFORM_CONTRACT_V1.md` y actualizar de forma acotada `docs/api-env-variables.md`, `docs/api.md` y `docs/STATUS.md` cuando corresponda.

## CONTRATO QUE DEBE QUEDAR DOCUMENTADO

El documento de contrato debe distinguir claramente:

### Registro interno

- Cobalt conserva 21 servicios conocidos.
- El registro sirve para patrones, aliases, código heredado y posible reutilización futura.
- Estar registrado no significa estar soportado públicamente por Josefina.

### Alcance público

- IDs canónicos exactos y orden estable.
- `GET /` anuncia capacidades, pero la seguridad también se impone en routing y autorización.
- Configuración y API keys sólo pueden seleccionar subconjuntos del techo público.

### Solicitud pública actual

- `POST /` recibe `url` y las opciones vigentes de `schema.js`.
- Defaults web/API forman parte de la compatibilidad.
- No se endurece ni reduce el esquema en D0.

### Respuestas públicas actuales

- `redirect` y `tunnel`: `url`, `filename`;
- `picker`: elementos `{ type, url, thumb? }` y audio opcional;
- `local-processing`: `type`, `service`, `tunnel[]`, `output`, `audio?`, `isHLS?`;
- `error`: `error.code`, `error.context?`.

Documentá también la semántica posicional actualmente implícita de `local-processing.tunnel[]` que consume la cola del frontend. No cambies esa semántica en D0.

### Contrato interno heredado

Documentá, sin refactorizar los adaptadores, las variantes estructurales que sus resultados entregan a `match-action.js`: URLs, nombres de archivo/atributos, picker, flags de tipo/procesamiento, metadata/subtítulos y errores.

### Brechas explícitas

Registrá como pendientes, sin resolverlas:

- ausencia de endpoint de análisis y `MediaInfo` público;
- la plataforma no aparece en todos los tipos de éxito;
- instancias API personalizadas pueden anunciar otro alcance y su tratamiento corresponde a D5;
- branding y nombres Cobalt corresponden a D5;
- cualquier inconsistencia documental descubierta entre API y tipos del frontend.

## SCOPE — ARCHIVOS PERMITIDOS

Permitidos:

- nuevo `api/src/processing/service-scope.js`;
- `api/src/core/env.js`;
- `api/src/processing/url.js`;
- `api/src/security/api-keys.js`, sólo si una prueba demuestra que es necesario para imponer el techo y sin ampliar el comportamiento;
- nuevo `api/test/service-contract.test.js` y fixtures deterministas estrictamente necesarios;
- `api/package.json`;
- `.github/test.sh`;
- `.github/workflows/test.yml`, sólo si hace falta conectar `test:contract` a la batería general;
- nuevo `docs/JOSEFINA_PLATFORM_CONTRACT_V1.md`;
- actualizaciones acotadas a `docs/api.md`, `docs/api-env-variables.md` y `docs/STATUS.md`.

Si necesitás tocar otro archivo, detenete antes de hacerlo y explicá a MAIN por qué el alcance actual no alcanza.

## DO NOT

No modifiques:

- `web/**`;
- `api/src/processing/services/**`;
- `api/src/util/tests/**`;
- `api/src/processing/service-config.js`;
- `api/src/processing/service-patterns.js`;
- `api/src/processing/service-alias.js`;
- `api/src/processing/schema.js`;
- `api/src/processing/match.js`;
- `api/src/processing/match-action.js`;
- `api/src/processing/request.js`;
- `api/src/stream/**`;
- `pnpm-lock.yaml`;
- branding, estilos, traducciones, settings o componentes visuales.

No agregues paquetes. No llames URLs reales de Instagram, TikTok, YouTube, Facebook ni de ningún otro servicio. No uses como evidencia `pnpm --prefix api test`, `run-tests-for` ni el workflow de pruebas vivas.

## PRUEBAS DETERMINISTAS OBLIGATORIAS

La batería D0 debe demostrar, sin red:

1. La lista canónica es exactamente `instagram`, `tiktok`, `youtube`, `facebook`, sin duplicados.
2. Los cuatro IDs existen en el registro heredado y poseen patrones/testers.
3. Con configuración predeterminada, `allServices` y `enabledServices` contienen sólo los cuatro.
4. `DISABLED_SERVICES=youtube,facebook` deja sólo Instagram y TikTok.
5. Espacios, vacíos y duplicados se normalizan.
6. Deshabilitar un servicio excluido, como Vimeo, no amplía ni altera el alcance.
7. `allowedServices: "all"` no puede incluir una quinta plataforma.
8. Un subconjunto válido de API key queda dentro de las cuatro y un subconjunto con Vimeo se rechaza.
9. Routing offline correcto para variantes representativas:
   - Instagram: publicación, reel y alias `ddinstagram.com`;
   - TikTok: video, foto y enlace corto;
   - YouTube: watch, `youtu.be`, Shorts y live normalizados;
   - Facebook: reel, watch y `fb.watch` normalizados.
10. Vimeo reconocido devuelve `service.disabled`, incluso si `extract()` recibe manualmente un set que contiene Vimeo.
11. Dominio desconocido o dominio engañoso devuelve `link.invalid`.
12. Ruta reconocida pero no soportada de una plataforma incluida devuelve `link.unsupported`.
13. Una plataforma incluida pero deshabilitada devuelve `service.disabled`.
14. La lista pública usada por `GET /` es exactamente la esperada.
15. El smoke HTTP local confirma:
   - `GET /` con exactamente cuatro servicios;
   - `POST /` para un servicio excluido con HTTP 400 y `error.api.service.disabled`;
   - ninguna solicitud saliente a la plataforma.

## VALIDATION

Ejecutá como mínimo:

```powershell
corepack pnpm install --frozen-lockfile --offline
corepack pnpm --dir api run test:contract
node api/src/util/test.js get-services
$env:WEB_DEFAULT_API = 'http://127.0.0.1:3210/'
corepack pnpm --dir web run check
corepack pnpm --dir web run build
git diff --check
git diff --exit-code a636575b09de1fc55d9b8cd98cac88f5f2f16b42 -- pnpm-lock.yaml api/src/processing/services api/src/util/tests web
git status --short --branch
```

Además, ejecutá el smoke HTTP local determinista previsto por la implementación y cerrá todos los procesos al finalizar. Confirmá que no quede ningún puerto escuchando.

No interpretes el verde de pruebas vivas upstream como prueba de D0. Informá los conteos reales de `node:test`, errores/advertencias de frontend y resultado del build.

## DONE WHEN

D0 termina únicamente cuando:

1. Existe una sola fuente canónica del alcance público.
2. Ningún camino comprobado —configuración, routing directo o API key— puede exponer una quinta plataforma.
3. `GET /` anuncia sólo las cuatro y un servicio heredado conocido queda deshabilitado antes de contactar su extractor.
4. Los 21 adaptadores y los 21 manifests heredados continúan presentes y sin cambios.
5. El contrato público existente permanece compatible.
6. Las pruebas D0 son deterministas y no usan red externa.
7. Frontend check/build continúan verdes.
8. No cambian dependencias ni lockfile.
9. No existen cambios ajenos al alcance ni procesos residuales.
10. La documentación coincide con el código.
11. Queda explícito que D0 no verificó ninguna descarga real.

## HANDOFF OBLIGATORIO A MAIN

Entregá un único bloque autosuficiente en español con:

### QUÉ HACE

Resumen concreto del resultado implementado.

### POR QUÉ EXISTE

Problema que resuelve y frontera que protege.

### OBJECTIVE

Objetivo exacto de D0.

### BASE Y ESTADO GIT

- ruta;
- rama;
- HEAD/base;
- remotos/worktree;
- estado inicial y final;
- diff stat;
- confirmar que no hubo commit ni push.

### CHANGES

Qué cambió, archivo por archivo.

### CONTRACT

Contrato público, contrato interno documentado y decisiones preservadas.

### VALIDATION

Comandos realmente ejecutados, resultados, conteos y distinción entre:

- VERIFICADO;
- INFERIDO;
- PENDIENTE.

### RISKS

Riesgos, límites y cualquier contradicción encontrada.

### PENDING

Todo lo que no quedó resuelto, especialmente análisis/metadata, UI, branding y pruebas reales de plataformas.

### DEPENDENCIES UNLOCKED

Qué contrato queda disponible para D1, D2, D3, D4 y D5.

### NEXT

Próximo paso recomendado para MAIN.

Cerrá el handoff repitiendo en dos frases:

- **QUÉ HACE** la entrega final;
- **POR QUÉ EXISTE** dentro de Josefina.
