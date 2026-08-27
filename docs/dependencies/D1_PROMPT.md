# Dependencia D1 — Instagram: línea base, diagnóstico y preservación

Trabajás como especialista de la dependencia D1 del proyecto Josefina.

## QUÉ HACE

D1 debe demostrar con evidencia real qué funciona hoy en Instagram, conservar ese comportamiento y reparar únicamente las fallas que se reproduzcan y se localicen dentro del adaptador de Instagram.

La matriz mínima a clasificar es:

1. publicación pública con una imagen;
2. publicación pública con video;
3. Reel público;
4. carrusel de imágenes;
5. carrusel mixto con imagen y video;
6. descarga de audio desde un video o Reel;
7. video sin audio;
8. aliases ddinstagram.com, d.ddinstagram.com y g.ddinstagram.com;
9. enlaces share cuando exista una muestra pública válida;
10. contenido inexistente, privado, restringido o no accesible.

## POR QUÉ EXISTE

Instagram es la funcionalidad que se considera estable en la base Cobalt, pero Josefina todavía no la verificó mediante descargas reales. Las pruebas heredadas pueden dar una impresión falsa de éxito: Instagram está marcado como finnicky y sus fallos se ignoran por defecto; además, el runner sólo compara código y tipo de respuesta y no comprueba que los bytes multimedia sean recuperables.

D1 convierte esa suposición en una línea base verificable antes de reparar YouTube, TikTok o Facebook.

## ROL Y LÍMITE DE LA DEPENDENCIA

Tu única responsabilidad es Instagram. No implementes otras plataformas, no diseñes la UI y no modifiques el contrato público de D0.

Trabajá directamente en:

C:/Users/Joaquin/Desktop/chatgptprojects/josefina

No crees otra rama, worktree, commit o remoto. No hagas push, merge, rebase, reset, clean ni descartes archivos. Al finalizar, devolvé un handoff a MAIN con los cambios sin commit.

Primero diagnosticá. Si la línea base funciona, D1 puede terminar con pruebas y documentación sin modificar el adaptador productivo. No refactorices por gusto.

## PUERTA 0 OBLIGATORIA

Antes de editar:

1. Confirmá la ruta exacta.
2. Leé completo AGENTS.md.
3. Leé completos:
   - docs/STATUS.md;
   - docs/JOSEFINA_PLATFORM_CONTRACT_V1.md;
   - docs/dependencies/D1_PROMPT.md.
4. Registrá:
   - git status --short --branch;
   - raíz Git;
   - rama y HEAD;
   - rama remota de seguimiento;
   - git rev-parse --is-shallow-repository;
   - remotos;
   - worktrees;
   - diff rastreado y staged;
   - archivos no rastreados.
5. Confirmá como base obligatoria:
   - rama main;
   - HEAD ecd52d85b277fda2c4260f9a7b5cd9011cfd16c8;
   - commit feat: establish Josefina service scope;
   - base upstream histórica a636575b09de1fc55d9b8cd98cac88f5f2f16b42;
   - rama main siguiendo origin/main;
   - remoto origin = https://github.com/blackat-systems/josefina.git;
   - remoto upstream = https://github.com/imputnet/cobalt.git;
   - repositorio no shallow: false;
   - un único worktree en la ruta indicada.
6. El estado local esperado al preparar este prompt contiene únicamente archivos concurrentes no rastreados de D5, el STATUS compartido y este prompt:
   - docs/JOSEFINA_VISUAL_IDENTITY_V1.md;
   - docs/STATUS.md;
   - docs/brand/**;
   - docs/dependencies/D5_PREPARATION.md;
   - docs/dependencies/D1_PROMPT.md.
7. Confirmá que `origin` es el repositorio propio de Josefina y que `upstream` continúa apuntando a Cobalt. Si aparece cualquier otro remoto, cambio o archivo adicional que no pueda atribuirse con certeza, detenete y reportalo.
8. Confirmá que no existe diff contra HEAD en:
   - api/src/processing/services/instagram.js;
   - api/src/util/tests/instagram.json;
   - api/src/processing/service-config.js;
   - api/src/processing/service-patterns.js;
   - api/src/processing/match.js;
   - api/src/processing/match-action.js;
   - api/src/processing/cookie/**;
   - api/src/stream/**;
   - web/**;
   - pnpm-lock.yaml.

No corrijas un mismatch. Informalo a MAIN.

## FUENTES DE VERDAD QUE DEBÉS INSPECCIONAR

Leé antes de decidir:

- api/src/processing/services/instagram.js;
- api/src/processing/service-config.js, bloque Instagram;
- api/src/processing/service-patterns.js, tester Instagram;
- api/src/processing/url.js, aliases y techo D0;
- api/src/processing/match.js, llamada al adaptador;
- api/src/processing/match-action.js;
- api/src/processing/request.js;
- api/src/processing/cookie/manager.js;
- api/src/processing/cookie/cookie.js;
- api/src/stream/manage.js;
- api/src/misc/run-test.js;
- api/src/util/test.js;
- api/src/util/tests/instagram.json;
- api/test/service-contract.test.js;
- api/test/network-guard.cjs;
- api/package.json;
- docs/api.md;
- docs/api-env-variables.md;
- docs/JOSEFINA_PLATFORM_CONTRACT_V1.md.

Reconstruí el flujo completo:

POST /
→ validación y normalización D0
→ patrón y tester de Instagram
→ match.js
→ adaptador instagram.js
→ match-action.js
→ respuesta redirect, tunnel, picker, local-processing o error
→ descarga, proxy o procesamiento.

Dentro del adaptador distinguí:

- shareId y resolución del redirect;
- postId con oEmbed, API móvil, embed HTML, GraphQL y diagnóstico de error;
- username + storyId, que exige cookie.

## DECISIONES YA TOMADAS POR MAIN

No reabras estas decisiones:

1. Instagram conserva el ID canónico instagram y el primer lugar del orden público.
2. D0 debe seguir limitando Josefina a Instagram, TikTok, YouTube y Facebook.
3. No se reemplaza Instagram por yt-dlp ni por otra herramienta sólo para unificar arquitectura.
4. No se crea /analyze, MediaInfo ni un selector nuevo de formatos.
5. Se preservan las respuestas públicas redirect, tunnel, picker, local-processing y error.
6. Una ruta Instagram reconocida pero no soportada conserva link.unsupported.
7. Un dominio falso conserva link.invalid.
8. Instagram deshabilitado conserva service.disabled.
9. Stories son un camino autenticado y condicional. Sin autorización y credenciales legítimas no se declaran verificadas ni se intenta ampliar su soporte.
10. No se intenta acceder a contenido privado, eludir login, challenges, restricciones por edad, geografía o rate limits.
11. videoQuality llega al adaptador pero hoy no controla la selección de calidad de Instagram. D1 debe documentarlo; no debe inventar selección de resolución.
12. La UI y el branding pertenecen a D5.

## TASK

### Fase A — línea base antes de editar

1. Ejecutá `corepack pnpm --dir api run test:contract` y confirmá el conteo esperado de D0: 16/16. Si cambia el conteo o falla un caso, detenete y reportalo.
2. Ejecutá una sola pasada serial de las 14 pruebas vivas heredadas de Instagram en modo estricto.
3. Impedí el falso verde de finnicky usando temporalmente una lista ignorada que no contenga Instagram:

   $env:TEST_IGNORE_SERVICES = '__none__'
   node api/src/util/test.js run-tests-for instagram
   Remove-Item Env:TEST_IGNORE_SERVICES

4. El caso que posee canFail: true debe informarse por separado; no lo cuentes como prueba dura.
5. Tratá esa pasada de 14 casos como una única operación atómica: el runner heredado captura fallos y no puede detenerse entre casos. No la reinicies ni hagas nuevas solicitudes vivas si aparece un 429, challenge o bloqueo.
6. La pasada heredada sólo da una línea base estructural gruesa. Registrá por caso lo que realmente pueda observarse:
   - resultado esperado y observado;
   - código HTTP y status;
   - error exacto;
   - etapa donde falló;
   - si parece contenido eliminado, rate limit, challenge, autenticación, parsing, túnel o media.
7. Si el runner no expone el HTTP interno, la etapa o la causa, marcá ese dato como PENDIENTE. No lo inventes. Para una falla concreta podés usar un harness diagnóstico temporal y acotado fuera del repositorio, sin registrar secretos ni instrumentar producción de forma permanente.
8. No modifiques código hasta tener el diagnóstico.

La ejecución limitada de pruebas vivas sobre contenido públicamente accesible está autorizada para D1. Hacé pocas solicitudes, seriales, sin cookies y sin reintentos agresivos. Si el runner informa HTTP 429, challenge o bloqueo al terminar su pasada atómica, no hagas ninguna otra prueba viva y registralo.

### Fase B — reparación mínima

Si una falla se reproduce:

1. localizala antes de editar;
2. agregá primero una regresión determinista;
3. corregí el mínimo código necesario;
4. preservá las ramas que todavía funcionan;
5. no conviertas una falla externa o un fixture eliminado en un refactor;
6. no borres casos del manifest para conseguir verde.

Una reproducción determinista offline de uno de los riesgos concretos también habilita una reparación mínima, aunque la muestra viva haya funcionado. No introduzcas cambios basados únicamente en sospechas sin una regresión que falle antes y pase después.

Auditá expresamente estos riesgos ya identificados, sin asumir que todos requieren un cambio:

- hasData() puede aceptar objetos incompletos y cortar fallbacks;
- un embed HTML malformado puede lanzar y evitar el fallback GraphQL;
- requestGQL() puede pisar la cookie anónima con cookie undefined;
- getStory() puede acceder a media.items sin validar la respuesta;
- el token DTSG cacheado no está ligado a la cookie elegida;
- videoQuality no se usa;
- URLs CDN firmadas pueden expirar;
- las URLs multimedia remotas llegan al sistema de túneles sin una política SSRF específica de Instagram;
- audio o mute sobre fotos y pickers conserva prioridades heredadas.

Si una solución requiere tocar stream/**, cookies compartidas, match.js, match-action.js, request.js, url.js o cualquier contrato D0, detenete y consultá a MAIN. No improvises una allowlist CDN: los dominios de medios pueden variar.

### Fase C — pruebas deterministas

Creá una batería offline explícita:

- api/test/instagram-contract.test.js;
- fixtures mínimos, sintéticos y sanitizados bajo api/test/fixtures/instagram/** sólo cuando sean necesarios;
- script exacto en api/package.json:

  test:instagram:contract = node --test test/instagram-contract.test.js

No uses node --test sin archivo explícito.

Preferí extraer helpers puros específicos de Instagram cuando eso permita probar parsing o selección sin refactorizar el flujo general. Si probás el adaptador directamente, sustituí de forma controlada `global.fetch` y las fronteras de request/cookies necesarias. Reutilizá la guardia de red de D0 o una equivalente con control positivo: el test debe demostrar tanto que bloquea red externa como que permite el loopback previsto. No crees una API productiva sólo para facilitar tests.

La batería debe cubrir, según la arquitectura final:

1. forma heredada GraphQL y forma nueva de API móvil;
2. foto, video, carrusel de fotos y carrusel mixto;
3. orden, tipos, URL y thumbnail del picker;
4. selección actual del video de mayor área;
5. alwaysProxy;
6. HTML malformado y continuación segura de fallbacks;
7. respuestas móviles y GraphQL incompletas;
8. errores fetch.empty, privado y restringido por edad;
9. story sin cookie y respuesta de story incompleta sin excepción crítica;
10. cookie anónima preservada cuando no existe cookie configurada;
11. ninguna solicitud externa real durante la batería;
12. no filtración de cookies, tokens, URLs firmadas ni headers sensibles.

No guardes respuestas reales completas como fixtures. Reducilas a la estructura mínima y reemplazá nombres, IDs, tokens y URLs por valores sintéticos.

### Fase D — verificación viva de descarga

Después de que las pruebas offline estén verdes, verificá el recorrido real con una cantidad pequeña de muestras públicas:

- una imagen;
- un video de publicación;
- un Reel;
- un carrusel representativo, incluyendo cada elemento;
- audio de un video o Reel corto;
- video sin audio cuando sea razonable;
- un alias ddinstagram;
- un enlace share sólo si existe una muestra pública válida;
- un contenido inexistente que termine en error estructurado.

Reutilizá, siempre que sigan vigentes, las mismas URLs exitosas de la pasada inicial para comprobar los bytes. No hagas una segunda extracción sólo para conseguir otra muestra equivalente.

No alcanza con recibir status 200, redirect, tunnel o picker. Seguí la respuesta como lo haría el producto y verificá:

- bytes no vacíos;
- MIME y firma compatibles;
- tamaño no trivial;
- para picker, cada elemento y thumbnails relevantes;
- para tunnel o alwaysProxy, el endpoint local real;
- para audio o mute, salida procesada utilizable.

Usá una carpeta temporal fuera del repositorio. Preferí muestras pequeñas y un límite prudente. Si el recurso excede 25 MiB, verificá una lectura acotada y dejá explícito que no se completó el archivo. Eliminá los temporales al finalizar.

No uses cuentas, cookies ni tokens. No busques archivos de credenciales existentes. Si Instagram exige sesión para completar la matriz pública, reportá el bloqueo a MAIN.

Si hubo un cambio productivo, repetí únicamente los casos vivos afectados y una muestra representativa no afectada como control. No vuelvas a ejecutar los 14 casos completos.

## OUTPUT

D1 debe producir:

1. diagnóstico previo a cualquier cambio;
2. matriz durable VERIFICADO / INFERIDO / PENDIENTE por tipo de contenido y ruta;
3. cambio productivo mínimo o conclusión explícita sin cambio productivo;
4. pruebas deterministas sin red;
5. evidencia viva acotada de bytes o archivos realmente recuperables;
6. docs/JOSEFINA_INSTAGRAM_SUPPORT_V1.md;
7. actualización exclusiva de la sección D1 de docs/STATUS.md, preservando íntegramente D5;
8. handoff autosuficiente a MAIN.

El documento de soporte debe registrar:

- fecha y entorno de la prueba viva;
- rutas y aliases soportados;
- tipos de contenido verificados;
- forma de respuesta observada;
- comportamiento de audio, mute, picker y alwaysProxy;
- límites de stories, privados, edad, rate limit y geografía;
- ausencia de selección real de videoQuality;
- diferencia entre respuesta estructural y archivo efectivamente descargable;
- cualquier muestra que haya quedado obsoleta.

## SCOPE — ARCHIVOS PERMITIDOS

Permitidos:

- api/src/processing/services/instagram.js, sólo después de reproducir una falla;
- nuevos helpers puros dentro de un subdirectorio específico de Instagram, sólo si reducen riesgo y permiten pruebas;
- api/src/util/tests/instagram.json;
- nuevo api/test/instagram-contract.test.js;
- fixtures sintéticos bajo api/test/fixtures/instagram/**;
- api/package.json, sólo para test:instagram:contract;
- nuevo docs/JOSEFINA_INSTAGRAM_SUPPORT_V1.md;
- sección D1 de docs/STATUS.md.

El manifest puede corregirse si una URL está eliminada o ya no representa el caso, pero no reemplaces muestras con contenido de terceros elegido al azar. Si faltan muestras estables y autorizadas, reportalo a MAIN.

## DEPENDENCIES

- D1 depende del contrato D0 del commit ecd52d85b277fda2c4260f9a7b5cd9011cfd16c8.
- D1 no depende de D5.
- D2, D3 y D4 no forman parte de esta entrega.
- Una falla compartida de routing, cookies, streams, filesystem o core debe volver a MAIN para decidir una dependencia separada.

## DO NOT

No modifiques sin autorización nueva:

- api/src/processing/url.js;
- api/src/processing/schema.js;
- api/src/processing/service-scope.js;
- api/src/processing/service-config.js;
- api/src/processing/service-patterns.js;
- api/src/processing/match.js;
- api/src/processing/match-action.js;
- api/src/processing/request.js;
- api/src/core/env.js;
- api/src/security/api-keys.js;
- api/src/misc/utils.js;
- api/src/processing/cookie/**;
- api/src/stream/**;
- api/test/service-contract.test.js;
- .github/**;
- web/**;
- pnpm-lock.yaml;
- otras plataformas;
- documentos o activos D5;
- contratos D0.

No agregues paquetes. No cambies API pública. No agregues soporte oportunista para stories, highlights, perfiles, vivos, Threads o contenido privado. No eludas rate limits, autenticación, challenges ni restricciones. No registres secretos. No hagas commit ni push.

## VALIDATION FINAL

Ejecutá como mínimo:

1. corepack pnpm install --frozen-lockfile --offline
2. corepack pnpm --dir api run test:contract
3. corepack pnpm --dir api run test:instagram:contract
4. si hubo cambios productivos, repetición viva sólo de casos afectados más un control no afectado
5. node api/src/util/test.js get-services
6. frontend svelte-check con WEB_DEFAULT_API local
7. build estático del frontend
8. git diff --check
9. revisión completa de git diff y archivos no rastreados
10. confirmación de que pnpm-lock.yaml, web/**, D0, otras plataformas y los otros 20 manifests no cambiaron
11. confirmación de que no quedan API, FFmpeg, Node, puertos ni temporales activos

Informá:

- cantidad exacta de pruebas offline y resultado;
- los 14 casos vivos, distinguiendo hard pass, hard fail y canFail;
- muestras E2E realmente verificadas;
- bytes/tamaño y tipo comprobados sin exponer URLs firmadas;
- warnings;
- duración relevante;
- todo lo no ejecutado.

## DONE WHEN

D1 termina únicamente cuando:

1. existe evidencia de línea base anterior al cambio;
2. cada cambio responde a una falla reproducida;
3. foto, al menos un video o Reel y cada elemento de un carrusel representativo poseen evidencia multimedia real;
4. el soporte no depende sólo de fallos ignorados por finnicky;
5. las regresiones de parsing y fallback relevantes quedan cubiertas offline;
6. D0 continúa completamente verde;
7. el frontend continúa verde;
8. no cambian otras plataformas, dependencias ni lockfile;
9. no se usaron o expusieron secretos;
10. stories, privados, calidad, rate limits y límites externos quedan explícitos;
11. el otro camino entre video y Reel, audio, mute, aliases y error inexistente están verificados estructuralmente o figuran como PENDIENTE con causa concreta;
12. share queda VERIFICADO sólo si existió una muestra pública válida; stories autenticadas permanecen PENDIENTES sin credenciales autorizadas;
13. la documentación coincide con la evidencia;
14. no quedan procesos ni archivos temporales creados por D1.

Si la red externa, un challenge o la falta de muestras autorizadas impiden demostrar la matriz principal, D1 queda PENDIENTE o BLOQUEADA; no la declares funcional.

## HANDOFF OBLIGATORIO A MAIN

Entregá un único bloque autosuficiente en español con:

### QUÉ HACE

Resultado concreto de D1.

### POR QUÉ EXISTE

Qué comportamiento de Instagram protege o repara.

### OBJECTIVE

Objetivo exacto trabajado.

### BASE Y ESTADO GIT

- ruta;
- rama;
- HEAD/base;
- remotos y worktree;
- estado inicial y final;
- diff stat;
- confirmar que no hubo commit ni push;
- separar D1 de D5 y del STATUS compartido.

### BASELINE

Resultado anterior a editar, caso por caso.

### CHANGES

Cambios archivo por archivo o confirmación de que no hubo cambio productivo.

### SUPPORT MATRIX

Para cada contenido o ruta: VERIFICADO, INFERIDO, PENDIENTE o NO SOPORTADO.

### VALIDATION

Comandos realmente ejecutados, conteos y resultados. Separá:

- pruebas offline;
- pruebas vivas estructurales;
- evidencia real de bytes o archivos;
- regresión global.

### SECURITY AND PRIVACY

Confirmá que no se usaron ni expusieron cookies, tokens, URLs firmadas o contenido privado.

### RISKS

Rate limits, fixtures mutables, fallbacks, expiración de CDN y cualquier incertidumbre.

### PENDING

Todo lo no demostrado, especialmente stories autenticadas, calidad y muestras faltantes.

### DEPENDENCIES

Qué queda desbloqueado o qué requiere volver a MAIN.

### NEXT

Próximo paso recomendado.

Cerrá el handoff repitiendo en dos frases:

- QUÉ HACE la entrega final;
- POR QUÉ EXISTE dentro de Josefina.
