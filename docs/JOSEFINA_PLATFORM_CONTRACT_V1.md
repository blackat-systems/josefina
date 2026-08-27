# Contrato de plataformas de Josefina v1

Estado: implementado por D0 y aceptado por MAIN.

## Propósito

Este documento es la fuente durable del límite entre el registro heredado de Cobalt, la superficie pública de Josefina, los adaptadores de plataforma y la interfaz web actual.

Las únicas plataformas públicas de Josefina son, exactamente y en este orden:

1. `instagram`
2. `tiktok`
3. `youtube`
4. `facebook`

La fuente canónica en código es `api/src/processing/service-scope.js`. El orden es parte del contrato de `GET /`.

## Registro interno y alcance público

### Registro interno heredado

Cobalt conserva 21 servicios conocidos:

`bilibili`, `bsky`, `dailymotion`, `facebook`, `instagram`, `loom`, `ok`, `pinterest`, `newgrounds`, `reddit`, `rutube`, `snapchat`, `soundcloud`, `streamable`, `tiktok`, `tumblr`, `twitch`, `twitter`, `vimeo`, `vk` y `youtube`.

Ese registro continúa siendo la fuente de patrones y configuración, y se corresponde con aliases, testers, imports, adaptadores y manifests de pruebas vivas mantenidos en sus módulos respectivos. Un servicio registrado no queda por eso soportado públicamente por Josefina.

D0 no elimina ni modifica ese catálogo. Su conservación permite reutilización futura y evita romper dependencias compartidas antes de auditarlas.

### Alcance público de Josefina

El techo público es la lista canónica de cuatro IDs. Se impone en varias capas:

- `env.allServices` es una copia mutable de esos cuatro IDs para la configuración en ejecución;
- `env.enabledServices` conserva su orden y sólo puede ser un subconjunto de esos cuatro;
- `DISABLED_SERVICES` puede reducir `enabledServices`, nunca agregar servicios;
- una API key sólo puede nombrar IDs que pertenezcan a `env.allServices`;
- `allowedServices: "all"` significa los cuatro servicios de Josefina;
- `extract()` vuelve a imponer el techo aunque un caller le entregue manualmente un conjunto más amplio.

La lista canónica exportada es inmutable. Los `Set` de entorno son copias deliberadas porque la recarga de configuración actual necesita reemplazarlos.

### `DISABLED_SERVICES` y API keys

`DISABLED_SERVICES` se interpreta como una lista separada por comas. Se recortan espacios, se descartan valores vacíos y los duplicados no tienen efecto. Los IDs desconocidos o heredados fuera de Josefina se ignoran porque sólo se filtra la lista canónica.

Se preserva la relación heredada entre configuración global y API keys dentro del techo de cuatro servicios: una key con `allowedServices` puede seleccionar su subconjunto de `env.allServices` aunque un ID esté en `DISABLED_SERVICES`; `"all"` devuelve los cuatro. Esta excepción nunca habilita un quinto servicio porque `env.allServices` y el routing tienen el mismo techo.

## Detección, normalización y errores de routing

La detección de dominio, aliases y rutas pertenece al backend. La UI no mantiene una allowlist paralela por hostname.

El orden de decisión es:

1. normalizar una URL y sus aliases conocidos;
2. reconocer el host mediante el registro heredado;
3. imponer el alcance público y el conjunto permitido para la solicitud;
4. buscar un patrón de ruta del servicio incluido;
5. entregar el match al adaptador correspondiente.

Resultados de contrato:

- servicio heredado reconocido pero excluido: `service.disabled` interno y `error.api.service.disabled` en la API;
- plataforma incluida pero deshabilitada: el mismo error `service.disabled`;
- dominio desconocido o engañoso: `link.invalid`;
- dominio incluido con ruta no soportada: `link.unsupported` y contexto de servicio.

Las normalizaciones actuales de enlaces cortos o aliases se conservan. D0 no ejecuta ni valida extractores remotos.

## API pública actual

### `GET /`

`GET /` anuncia las capacidades habilitadas en `cobalt.services`. Para Josefina es siempre un subconjunto ordenado de:

```json
["instagram", "tiktok", "youtube", "facebook"]
```

El namespace `cobalt` se conserva transitoriamente para no romper el frontend heredado. El anuncio de capacidades no sustituye las barreras de autorización y routing.

### Solicitud `POST /`

`POST /` recibe `url` y las opciones vigentes de `api/src/processing/schema.js`. El esquema es estricto; los campos extra se rechazan. D0 no reduce ni endurece este contrato.

| Campo | Valor predeterminado de API |
|---|---|
| `url` | requerido |
| `audioBitrate` | `"128"` |
| `audioFormat` | `"mp3"` |
| `downloadMode` | `"auto"` |
| `filenameStyle` | `"basic"` |
| `youtubeVideoCodec` | `"h264"` |
| `youtubeVideoContainer` | `"auto"` |
| `videoQuality` | `"1080"` |
| `localProcessing` | `"disabled"` |
| `youtubeDubLang` | ausente |
| `subtitleLang` | ausente |
| `disableMetadata` | `false` |
| `allowH265` | `false` |
| `convertGif` | `true` |
| `tiktokFullAudio` | `false` |
| `alwaysProxy` | `false` |
| `youtubeHLS` | `false` |
| `youtubeBetterAudio` | `false` |

Por compatibilidad temporal, el backend todavía convierte `localProcessing` booleano a su equivalente string antes de validar. La web envía explícitamente sus preferencias actuales; entre otras diferencias, puede usar `localProcessing: "preferred"`, `subtitleLang: "none"` y `youtubeDubLang: "original"`. Esos defaults web/API forman parte de la compatibilidad que D0 preserva.

No existe en v1 un paso público separado de análisis o selección de formatos.

### Respuestas `POST /`

Las formas públicas actuales son:

```ts
{ status: "redirect", url: string, filename: string }
{ status: "tunnel", url: string, filename: string }

{
    status: "picker",
    picker: Array<{ type: "photo" | "video" | "gif", url: string, thumb?: string }>,
    audio?: string,
    audioFilename?: string
}

{
    status: "local-processing",
    type: "merge" | "mute" | "audio" | "gif" | "remux" | "proxy",
    service: string,
    tunnel: string[],
    output: {
        type: string,
        filename: string,
        metadata?: Partial<FileMetadata>,
        subtitles?: boolean
    },
    audio?: {
        copy: boolean,
        format: string,
        bitrate: string,
        cover?: boolean,
        cropCover?: boolean
    },
    isHLS?: boolean
}

{
    status: "error",
    error: {
        code: string,
        context?: { service?: string, limit?: number }
    },
    critical?: true
}
```

Los éxitos normales usan HTTP 200. Los errores creados por el flujo normal de procesamiento usan HTTP 400; el rate limiting de `POST /` conserva HTTP 429 con la misma forma `error`. El runtime heredado puede producir un error crítico HTTP 500 con `critical: true`; esa variante todavía no está reflejada en `docs/api.md` ni en el tipo de error web.

Sólo `local-processing` expone hoy `service` en una respuesta exitosa. `redirect`, `tunnel` y `picker` no identifican la plataforma.

## Semántica posicional de `local-processing.tunnel[]`

El orden que entrega la API es:

```text
[fuente 0, fuente 1, ..., subtítulo?, portada?]
```

Una fuente escalar se convierte en un arreglo de un elemento. Si el adaptador entrega varias fuentes, se conserva su orden. En los arreglos observados, ese orden es `[video, audio]`. Después se agregan el subtítulo y la portada, si existen.

La metadata no ocupa una posición: viaja en `output.metadata`. `output.subtitles` y `audio.cover` indican recursos anexos presentes en `tunnel[]`; `audio.cropCover` sólo describe cómo tratar esa misma portada y no agrega otra posición.

La cola web invierte el arreglo antes de crear los fetches y conserva ese orden invertido como entradas de FFmpeg:

```text
[portada?, subtítulo?, fuentes en orden inverso]
```

Casos actuales:

| Caso | API `tunnel[]` | Entradas locales |
|---|---|---|
| merge YouTube | `[video, audio, subtítulo?]` | `[subtítulo?, audio, video]` |
| remux con subtítulo | `[media, subtítulo]` | `[subtítulo, media]` |
| audio con portada | `[audio, portada]` | `[portada, audio]` |
| audio sin portada | `[audio]` | `[audio]` |
| mute, gif o proxy usual | `[media]` | `[media]` |

El mapeo de portada de audio depende hoy de que portada y audio queden como entradas 0 y 1. Esta semántica es implícita y frágil: el tipo público sólo expresa `string[]`. D0 la documenta y no la modifica.

## Contrato interno heredado de adaptadores

Los adaptadores entregan a `match.js` y `match-action.js` una unión estructural no formalizada:

```ts
type AdapterResult =
    | { error: string, critical?: boolean }
    | {
        urls?: string | URL | Array<string | URL>,
        headers?: Record<string, string>,

        filename?: string,
        filenameAttributes?: {
            service: string,
            id: string,
            title: string,
            author?: string,
            extension?: string,
            resolution?: string,
            qualityLabel?: string,
            youtubeFormat?: string,
            youtubeDubName?: string
        },
        audioFilename?: string,

        picker?: Array<{ type: "photo" | "video" | "gif", url: string, thumb?: string }>,
        isPhoto?: boolean,
        isGif?: boolean,
        isHLS?: boolean,
        isAudioOnly?: boolean,

        type?: string,
        typeId?: "redirect" | "tunnel",
        bestAudio?: string,

        fileMetadata?: Record<string, string | undefined>,
        subtitles?: string,
        cover?: string,
        cropCover?: boolean,
        originalRequest?: object
    }
```

Semántica preservada:

- `urls` escalar o múltiple contiene las fuentes; en arreglos actuales, video ocupa 0 y audio 1;
- `filename` es literal y `filenameAttributes` delega la generación al core;
- `picker` representa múltiples elementos y puede tener un audio general separado;
- los flags seleccionan foto, picker, GIF, audio, mute, HLS o video;
- `type` y `typeId` orientan procesamiento y forma pública en ramas heredadas;
- `fileMetadata`, `subtitles`, `cover` y `cropCover` acompañan el procesamiento sin constituir un modelo público de metadata;
- `originalRequest` permite renovar fuentes expirables sin cambiar su posición;
- `{ error }` produce `error.api.<código>` y `{ error, critical: true }` produce error crítico.

D0 no refactoriza ni formaliza esta unión porque modificar adaptadores pertenece a las dependencias de plataforma.

## Brechas y decisiones pendientes

D0 registra y no resuelve:

1. No existe un endpoint `/analyze`, un flujo metadata → selección ni un modelo público `MediaInfo`.
2. La plataforma no aparece en todos los tipos de éxito.
3. Instancias API personalizadas pueden anunciar otro alcance; su tratamiento en la UI corresponde a D5.
4. Branding y nombres visibles corresponden a D5. El namespace público `cobalt` se preserva; cambiarlo requiere una decisión y dependencia futura separada.
5. `local-processing.tunnel[]` tiene semántica posicional no expresada por su tipo.
6. `docs/api.md` omite `proxy` entre los tipos de `local-processing`, aunque runtime y tipo web lo contemplan.
7. La documentación modela metadata parcial, pero el array de claves web no usa `as const`: el tipo se ensancha a `Record<string, string | undefined>` y la whitelist se aplica recién en runtime.
8. API y documentación aceptan calidad `4320`, ausente de las opciones tipadas actuales de la web.
9. Los errores críticos agregan `critical: true`, ausente de `docs/api.md` y del tipo de error web.
10. El esquema backend rechaza propiedades extra; el tipo parcial de request web no puede garantizarlo.
11. La rama heredada de Reddit puede producir un redirect sin `filename`; Reddit queda fuera del techo público.
12. La documentación llama “ISO válido” a idiomas que el schema sólo restringe por longitud y caracteres.
13. Una API key con un valor falsy inválido en `allowedServices` se trata hoy como si el campo estuviera ausente; endurecer esa validación cambiaría comportamiento heredado y requiere una decisión separada.

## Alcance de verificación de D0

D0 verifica contrato, allowlist, configuración, API keys, normalización, routing y smoke HTTP local mediante pruebas deterministas sin red externa.

El job API que invoca `.github/test.sh api` usa esta batería offline. El workflow separado `.github/workflows/test-services.yml` conserva intencionalmente las pruebas vivas de los 21 manifests y sí puede contactar plataformas; no forma parte de la garantía offline de D0.

D0 no verifica ninguna descarga real ni declara funcional a Instagram, TikTok, YouTube o Facebook.
