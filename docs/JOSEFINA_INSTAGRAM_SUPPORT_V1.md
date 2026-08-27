# Soporte de Instagram de Josefina v1

Estado: D1 aceptada por MAIN en el working tree, sin commit ni push.

Fecha de verificación viva: 2026-08-27.

Entorno observado:

- Windows;
- Node.js 24.20.0;
- API local de Josefina en loopback, sin autenticación ni archivo de cookies;
- FFmpeg estático 6.1.1 para las salidas de audio y mute;
- solicitudes seriales sobre las muestras públicas ya incluidas en el manifest heredado;
- ningún recurso privado, cuenta, cookie, token o técnica de evasión.

## Alcance

D1 conserva el contrato heredado de Instagram y no agrega endpoints ni formatos públicos. Las rutas reconocidas continúan siendo:

- publicaciones: `/p/:postId`;
- videos históricos: `/tv/:postId`;
- Reels: `/reel/:postId` y `/reels/:postId`;
- enlaces antiguos con username: `/:username/p/:postId` y `/:username/reel/:postId`;
- share: `/share/:shareId`, `/share/p/:shareId` y `/share/reel/:shareId`;
- stories: `/stories/:username/:storyId`, sólo mediante el camino autenticado heredado;
- aliases: `ddinstagram.com`, `d.ddinstagram.com` y `g.ddinstagram.com`.

El routing, el orden público de servicios y las formas `redirect`, `tunnel`, `picker`, `local-processing` y `error` pertenecen al contrato D0 y no fueron modificados.

## Línea base viva anterior al cambio

Se ejecutaron una sola vez los 14 casos heredados con Instagram fuera de la lista `finnicky`. El runner sólo observa la respuesta estructural de Josefina; no informa los HTTP internos de Instagram ni descarga los medios.

| Caso heredado | Esperado | Observado antes de editar | Clasificación |
|---|---|---|---|
| single photo post | HTTP 200, `tunnel` | HTTP 400, `error.api.fetch.empty` | hard fail |
| various picker (photos + video) | HTTP 200, `picker` | HTTP 200, `picker` | hard pass |
| reel (`DFQ…`) | HTTP 200, `redirect` | HTTP 200, `tunnel` | hard fail por tipo de respuesta |
| regular video | HTTP 200, `redirect` | HTTP 200, `redirect` | hard pass |
| reel (`DFQ…`) audio | HTTP 200, `tunnel` | HTTP 200, `tunnel` | hard pass estructural |
| reel (`DFQ…`) mute | HTTP 200, `tunnel` | HTTP 200, `tunnel` | hard pass estructural |
| inexistent reel | HTTP 400, `error` | HTTP 400, `error` | hard pass estructural |
| inexistent post | HTTP 400, `error` | HTTP 400, `error` | hard pass estructural |
| post info in an array (`CrVB…`) | HTTP 200, `redirect` | HTTP 400, `error.api.fetch.empty` | hard fail |
| prone to get rate limited (`CrO…`) | HTTP 200, `redirect` | HTTP 200, `redirect` | hard pass |
| ddinstagram | HTTP 200, `redirect` | HTTP 200, `redirect` | hard pass |
| d.ddinstagram | HTTP 200, `redirect` | HTTP 200, `redirect` | hard pass |
| g.ddinstagram | HTTP 200, `redirect` | HTTP 200, `redirect` | hard pass |
| private instagram post | HTTP 400, `content.post.private` | HTTP 400, `error.api.fetch.empty` | `canFail`, falló y fue ignorado sólo por el manifest |

Conteo: 10 hard pass, 3 hard fail y 1 `canFail` fallido. No se observó 429 ni challenge en la salida del runner. Los HTTP internos de Instagram, el fallback exacto que agotó cada muestra y la causa externa de los `fetch.empty` son PENDIENTES porque el runner no los expone.

La verificación posterior de bytes demostró que `DFQ…`, todavía rotulado como Reel por el manifest, hoy entrega una imagen JPEG de 25.484 bytes y nombre `.jpg`. Por eso sus verdes estructurales de audio y mute no representaban audio ni video utilizables. `DFx…` y `CrVB…` continuaron en `fetch.empty`; no se ocultaron ni se reemplazaron por contenido elegido al azar.

## Reparaciones deterministas

Antes de modificar producción se creó una batería offline. En la base original dio 8/12 y reprodujo cuatro fallas:

1. una respuesta móvil incompleta se aceptaba como válida y cortaba los fallbacks;
2. un embed HTML malformado lanzaba y evitaba GraphQL;
3. `requestGQL()` pisaba la cookie anónima con `undefined` cuando no había cookie configurada;
4. una story con respuesta incompleta podía lanzar; además, el DTSG cacheado se compartía entre cookies distintas.

La reparación en el adaptador:

- valida que las respuestas móviles o GraphQL contengan multimedia utilizable antes de cortar fallbacks;
- parsea el embed de forma segura y continúa con GraphQL si está ausente o malformado;
- conserva la cookie anónima generada por la página cuando no existe una cookie configurada;
- selecciona candidatos válidos y mantiene la elección del video de mayor área;
- sólo acepta carruseles completos; ante un elemento inválido continúa al siguiente fallback y nunca devuelve un picker truncado;
- devuelve `fetch.empty` ante una respuesta incompleta de story;
- liga el cache DTSG a la instancia de cookie correspondiente mediante `WeakMap`.

La auditoría de MAIN encontró dos regresiones en la candidata: se había perdido el fallback histórico de un nodo de video a su imagen y un carrusel incompleto podía devolverse truncado. Antes de corregirlas se agregaron regresiones que fallaron 13/15. MAIN restauró el fallback, impuso integridad completa del picker y agregó cobertura para carrusel sólo de fotos, ambas formas GraphQL, candidatos vacíos o mal tipados, stories con `items` inválido y selección de URLs no vacías.

Después de la corrección la batería dio 17/17 sin red externa. La guardia se carga antes del adaptador y protege toda la batería; bloqueó un destino externo de documentación y permitió un servidor loopback de control. MAIN no repitió las solicitudes vivas ni las descargas contra Instagram: aceptó esa evidencia como observación fechada del especialista y revalidó de manera independiente el contrato offline.

## Evidencia viva de medios

Para comprobar el recorrido real se inició una API local y se usó `alwaysProxy: true`. Así se siguieron los endpoints `/tunnel` reales en vez de considerar suficiente una URL estructurada. Todos los archivos enumerados a continuación se leyeron completos; ninguno superó 25 MiB.

### Carrusel mixto

La muestra heredada produjo un `picker` de 10 elementos en orden: 9 fotos y 1 video. Se descargaron los 10 elementos y sus 10 thumbnails.

| Índice | Tipo | Bytes del medio | Firma/MIME | Bytes del thumbnail | Resultado |
|---:|---|---:|---|---:|---|
| 0 | foto | 115.194 | JPEG / `image/jpeg` | 115.194 | verificado |
| 1 | foto | 101.878 | JPEG / `image/jpeg` | 101.878 | verificado |
| 2 | foto | 106.961 | JPEG / `image/jpeg` | 106.961 | verificado |
| 3 | foto | 99.162 | JPEG / `image/jpeg` | 99.162 | verificado |
| 4 | foto | 112.754 | JPEG / `image/jpeg` | 112.754 | verificado |
| 5 | foto | 122.820 | JPEG / `image/jpeg` | 122.820 | verificado |
| 6 | foto | 108.258 | JPEG / `image/jpeg` | 108.258 | verificado |
| 7 | foto | 248.154 | JPEG / `image/jpeg` | 248.154 | verificado |
| 8 | foto | 286.654 | JPEG / `image/jpeg` | 286.654 | verificado |
| 9 | video | 992.861 | ISO-BMFF / `video/mp4` | 77.089 | verificado |

### Video, Reel, audio, mute y alias

| Recorrido | Respuesta | Bytes | Evidencia |
|---|---|---:|---|
| publicación con video | `tunnel` | 1.233.135 | MP4 completo, firma ISO-BMFF y `video/mp4` |
| Reel público (`CrO…`) | `tunnel` | 2.305.060 | MP4 completo, firma ISO-BMFF y `video/mp4` |
| audio desde la publicación con video | `tunnel` | 71.619 | MP3 completo; firma MP3; FFmpeg confirmó audio y ausencia de video |
| mute de la publicación con video | `tunnel` | 1.168.577 | MP4 completo; firma ISO-BMFF; FFmpeg confirmó video y ausencia de audio |
| alias `ddinstagram.com` sobre el video | `tunnel` | 1.233.135 | mismo MP4 completo que la ruta canónica |
| publicación inexistente | HTTP 400, `error` | — | `error.api.fetch.empty` estructurado |

Los túneles FFmpeg de audio y mute no enviaron `Content-Type`; sí enviaron nombre de archivo y longitud estimada. Por lo tanto, su MIME por header queda PENDIENTE, aunque la firma, el archivo completo y el sondeo de streams fueron compatibles y utilizables.

Las URLs CDN firmadas no se guardaron ni se registraron. Los temporales se eliminaron después de verificar firma, tamaño y streams.

## Matriz de soporte

| Contenido o ruta | Estado | Evidencia y límite |
|---|---|---|
| foto dentro de carrusel público | VERIFICADO | 9 JPEG completos y sus thumbnails |
| publicación pública con una sola imagen | PENDIENTE | la única muestra autorizada `DFx…` devuelve `fetch.empty`; no se sustituyó por contenido ajeno |
| publicación pública con video | VERIFICADO | MP4 completo de 1.233.135 bytes |
| Reel público | VERIFICADO | MP4 completo de 2.305.060 bytes con la muestra heredada `CrO…` |
| carrusel sólo de imágenes | PENDIENTE | forma cubierta offline; no había una muestra viva autorizada independiente |
| carrusel mixto | VERIFICADO | picker completo: 9 fotos, 1 video y 10 thumbnails |
| audio de video | VERIFICADO | MP3 completo y sondeo FFmpeg; MIME HTTP ausente |
| video sin audio (`mute`) | VERIFICADO | MP4 completo, video presente y audio ausente |
| `alwaysProxy` | VERIFICADO | medios reales recuperados por túneles locales, incluidos picker y thumbnails |
| `ddinstagram.com` | VERIFICADO | routing, extracción, túnel y MP4 completo |
| `d.ddinstagram.com` | PENDIENTE | routing y respuesta estructural vivos; bytes no repetidos |
| `g.ddinstagram.com` | PENDIENTE | routing y respuesta estructural vivos; bytes no repetidos |
| enlace share | PENDIENTE | no existía una muestra pública válida y autorizada |
| publicación inexistente | VERIFICADO | HTTP 400 y `error.api.fetch.empty` |
| Reel inexistente | VERIFICADO | error estructural en la pasada heredada; no se repitieron bytes inexistentes |
| contenido privado | PENDIENTE | la muestra `canFail` no diagnosticó privado: devolvió `fetch.empty` |
| restricción por edad | PENDIENTE | diagnóstico cubierto sólo con fixture sintético offline |
| stories sin cookie | NO SOPORTADO | devuelve `link.unsupported` sin red |
| stories autenticadas | PENDIENTE | no se usaron credenciales; sólo se probó manejo seguro con cookies sintéticas offline |
| selección mediante `videoQuality` | NO SOPORTADO | el parámetro llega al adaptador, pero no controla la resolución de Instagram |

## Audio, mute y prioridades heredadas

Para un video escalar, audio produce un túnel de conversión y mute produce un túnel MP4 sin audio. Para una foto o un picker, las ramas `photo` y `picker` tienen prioridad sobre audio/mute: la solicitud conserva la foto o el picker y no inventa una pista de audio. Esta semántica fue verificada offline y no se cambió.

## Límites y riesgos

- Los fixtures públicos son mutables. Tres rótulos heredados ya no representan su expectativa original: `DFx…` no es recuperable, `DFQ…` hoy es una imagen y `CrVB…` no es recuperable.
- Las URLs CDN de Instagram son firmadas y expiran. La evidencia sólo prueba que eran recuperables inmediatamente durante esta ejecución.
- No apareció un 429 o challenge, pero una muestra está rotulada como propensa a rate limit; no se reintentó de forma agresiva.
- No se verificaron geobloqueo, contenido privado, restricción por edad ni stories autenticadas con una cuenta real.
- Las URLs de medios llegan al sistema compartido de túneles. No existe una política SSRF específica de Instagram. D1 no modificó `stream/**` ni improvisó una allowlist CDN; ese riesgo debe volver a MAIN si se decide endurecer la frontera compartida.
- El `Content-Type` está ausente en salidas procesadas por FFmpeg, aunque firma y streams sean válidos. Corregir headers pertenece al stream compartido y queda fuera de D1.
- La calidad de Instagram continúa siendo la que entrega el extractor; `videoQuality` no selecciona una resolución.

## Diferencia entre respuesta estructural y archivo descargable

Una respuesta `redirect`, `tunnel` o `picker` sólo demuestra que el adaptador produjo una forma válida. No prueba que la URL siga vigente ni que audio/mute contengan el tipo pedido. El caso `DFQ…` lo demuestra: el runner aprobó estructuralmente audio y mute, pero la descarga real fue una imagen JPEG. La matriz VERIFICADO de este documento exige bytes no triviales, firma compatible y, para audio/mute, sondeo de streams.
