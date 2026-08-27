# AGENTS.md

## 1. Propósito del proyecto

Este proyecto es una aplicación local para descargar contenido multimedia desde Internet a partir de una URL.

El usuario pega un enlace de una publicación, video, reel u otro contenido compatible y la aplicación debe:

1. detectar automáticamente la plataforma;
2. analizar la URL;
3. obtener la información disponible del contenido;
4. encontrar las fuentes multimedia descargables;
5. permitir o realizar la descarga;
6. guardar el archivo localmente;
7. informar claramente cualquier error.

El repositorio utilizado como base ya funciona parcialmente.

Estado inicial conocido:

- Instagram: funciona actualmente.
- YouTube: actualmente no funciona o funciona de manera incompleta.
- Otras plataformas pueden funcionar, funcionar parcialmente o estar rotas.

La prioridad inicial NO es reescribir el proyecto.

La prioridad es:

> comprender la implementación existente, conservar lo que funciona y reparar/extender progresivamente lo que no funciona.

## 1.1. Identidad y alcance inicial de Josefina

El producto se llama **Josefina**.

La base técnica upstream es Cobalt:

    https://github.com/imputnet/cobalt.git

Josefina debe exponer soporte únicamente para estas cuatro plataformas:

- Instagram;
- TikTok;
- YouTube;
- Facebook.

Los demás servicios heredados de Cobalt no forman parte del alcance inicial. No eliminarlos de manera apresurada: primero identificar dependencias compartidas y luego deshabilitarlos o retirarlos mediante cambios acotados y verificables.

La identidad visual, el nombre, las mascotas y el branding de Cobalt deben reemplazarse antes de distribuir Josefina.

## 1.2. MAIN y dependencias especializadas

Este chat MAIN conserva la visión integral y la columna vertebral del proyecto.

MAIN es responsable de:

- fijar la base upstream;
- definir contratos y límites entre componentes;
- preparar handoffs autosuficientes;
- recibir y auditar entregas especializadas;
- integrar una dependencia por vez;
- ejecutar verificaciones globales y de regresión;
- mantener el estado durable del proyecto.

La UI y el código específico de cada plataforma deben implementarse y probarse en chats especialistas separados. MAIN no desarrolla esas dependencias ni sus pruebas específicas.

Antes de delegar, MAIN debe estabilizar el contrato compartido y definir como mínimo:

- objetivo;
- alcance y archivos permitidos;
- dependencias previas;
- elementos que no pueden modificarse;
- validación exigida;
- condiciones concretas de finalización.

Un especialista no integra su propia entrega en MAIN. Debe devolver un handoff verificable con estado Git, archivos afectados, decisiones, pruebas ejecutadas, resultados, riesgos y pendientes.

MAIN sí puede ejecutar pruebas de línea base y repetir pruebas globales durante una auditoría o integración. Esto no convierte a MAIN en implementador de la dependencia.

---

# 2. Regla principal

NO ROMPER FUNCIONALIDAD EXISTENTE.

Instagram debe considerarse una funcionalidad estable hasta demostrar lo contrario.

Antes de modificar código relacionado directa o indirectamente con una plataforma que ya funciona:

1. identificar cómo funciona actualmente;
2. determinar qué módulos utiliza;
3. evaluar qué otras plataformas dependen de esos módulos;
4. evitar cambios globales innecesarios;
5. comprobar después del cambio que la funcionalidad anterior continúa funcionando.

Si una modificación para arreglar YouTube amenaza con romper Instagram, separar ambas implementaciones.

Preferir arquitectura modular por plataforma antes que lógica global llena de excepciones.

---

# 3. Filosofía de trabajo

Trabajar de forma:

- incremental;
- verificable;
- conservadora;
- modular;
- reversible.

No realizar refactors grandes únicamente porque el código podría quedar "más limpio".

Primero hacer que funcione correctamente.

Después mejorar arquitectura cuando exista una razón concreta.

Cada modificación debe responder a un problema identificado.

Nunca reemplazar una implementación funcional sin comprender primero por qué funciona.

---

# 4. Antes de modificar código

Al comenzar una tarea nueva:

## Paso 1 — inspeccionar

Examinar:

- estructura completa del repositorio;
- README;
- package files;
- requirements;
- configuración;
- dependencias;
- frontend;
- backend;
- servicios;
- extractores;
- downloaders;
- parsers;
- APIs utilizadas;
- rutas;
- almacenamiento;
- logs;
- configuración de red;
- manejo de cookies;
- procesamiento de URLs.

Identificar el flujo completo:

URL ingresada
→ detección de plataforma
→ extractor
→ obtención de metadata
→ descubrimiento del recurso
→ descarga
→ almacenamiento
→ respuesta a la interfaz.

No asumir la arquitectura sin inspeccionarla.

---

# 5. Diagnóstico antes de reparación

Cuando algo no funciona, NO comenzar inmediatamente a modificar código.

Primero determinar exactamente dónde falla.

Clasificar el problema:

- detección incorrecta de URL;
- regex incorrecta;
- cambio en el sitio externo;
- endpoint obsoleto;
- API modificada;
- extractor roto;
- dependencia desactualizada;
- bloqueo HTTP;
- headers;
- cookies;
- autenticación;
- rate limit;
- contenido georrestringido;
- contenido privado;
- formato multimedia;
- manifest DASH/HLS;
- problema de descarga;
- problema de conversión;
- problema de filesystem;
- problema frontend;
- problema backend;
- error silencioso.

Registrar el error original antes de modificar nada.

---

# 6. YouTube

YouTube es una de las prioridades principales del proyecto.

Si la implementación actual de YouTube está rota:

1. analizar primero cómo está implementada;
2. determinar por qué falla;
3. evaluar si puede repararse razonablemente;
4. evitar desarrollar un extractor de YouTube desde cero si existe una solución madura y mantenida;
5. considerar herramientas especializadas como `yt-dlp` cuando sean compatibles con la arquitectura del proyecto.

Si se utiliza `yt-dlp`, encapsularlo detrás de una capa propia del proyecto.

Ejemplo conceptual:

    PlatformDownloader
        ├── InstagramDownloader
        ├── YouTubeDownloader
        └── OtherPlatformDownloader

La aplicación no debería quedar completamente acoplada a una herramienta externa.

Crear una interfaz interna estable y permitir cambiar la implementación posteriormente.

---

# 7. Instagram

Instagram funciona actualmente.

Tratar su implementación como referencia de comportamiento esperado.

Antes de modificar código compartido con Instagram:

- identificar dependencias;
- documentar el comportamiento actual;
- realizar pruebas antes y después.

No reemplazar automáticamente la implementación de Instagram por `yt-dlp` u otra biblioteca solo para unificar arquitectura.

Una migración de ese tipo solo debe realizarse si:

- existe una ventaja concreta;
- se prueba exhaustivamente;
- no se pierde funcionalidad;
- mejora claramente la mantenibilidad.

---

# 8. Arquitectura deseada

Siempre que sea razonable, separar:

## Core

Responsable de:

- validar URLs;
- detectar plataforma;
- normalizar URLs;
- seleccionar extractor;
- gestionar errores;
- gestionar descargas;
- almacenamiento.

## Platform adapters

Cada plataforma debería tener su propio adaptador.

Ejemplo:

    src/
      core/
        downloader
        platform_detector
        models
        errors

      platforms/
        instagram
        youtube
        tiktok
        twitter
        facebook

La estructura real puede ser diferente.

NO reorganizar todo el repositorio solamente para parecerse a este ejemplo.

Usarlo únicamente como dirección arquitectónica.

---

# 9. Contrato común para plataformas

Siempre que sea posible, los extractores deberían devolver un modelo común.

Por ejemplo:

    MediaInfo

    platform
    title
    author
    description
    thumbnail
    duration
    media_type
    available_formats
    source_url
    original_url

Un formato descargable puede contener:

    format_id
    extension
    resolution
    fps
    video_codec
    audio_codec
    bitrate
    filesize
    has_video
    has_audio
    download_url

La interfaz no debería necesitar conocer detalles internos específicos de YouTube o Instagram.

---

# 10. Calidad de descarga

Siempre que la plataforma lo permita, priorizar:

- mejor calidad disponible;
- audio original;
- video original;
- evitar recompression innecesaria;
- mantener la extensión apropiada.

Si audio y video vienen separados, se puede utilizar FFmpeg para combinarlos.

No recomprimir si un simple remux es suficiente.

Preferir:

    video + audio → mux → archivo final

antes que:

    video + audio → reencode completo

---

# 11. FFmpeg

Si el proyecto requiere FFmpeg:

- detectar si está instalado;
- proporcionar errores comprensibles si falta;
- no fallar silenciosamente;
- evitar comandos inseguros;
- tratar correctamente rutas con espacios;
- utilizar argumentos separados en procesos cuando sea posible en lugar de construir comandos de shell.

---

# 12. Manejo de errores

Nunca mostrar solamente:

    Download failed

cuando exista información más útil.

Los errores internos deben permitir distinguir:

- URL inválida;
- plataforma no soportada;
- contenido eliminado;
- contenido privado;
- autenticación requerida;
- extractor desactualizado;
- geobloqueo;
- rate limit;
- error de red;
- formato no disponible;
- FFmpeg no disponible;
- error de almacenamiento;
- error desconocido.

La interfaz puede mostrar un mensaje simple al usuario, pero los logs deben conservar información técnica suficiente para diagnosticar.

---

# 13. Logs

Agregar logging útil donde sea necesario.

Los logs deben permitir seguir:

    URL recibida
    → plataforma detectada
    → extractor seleccionado
    → metadata obtenida
    → formato seleccionado
    → descarga iniciada
    → procesamiento
    → archivo guardado

No registrar:

- passwords;
- tokens;
- cookies completas;
- credenciales;
- headers sensibles.

---

# 14. Cookies y sesiones

Algunas plataformas pueden requerir sesión iniciada para determinado contenido.

La aplicación puede permitir utilizar cookies proporcionadas legítimamente por el usuario.

Nunca:

- robar cookies;
- extraer credenciales de terceros;
- acceder a cuentas sin autorización;
- intentar saltarse autenticación;
- almacenar secretos sin necesidad.

Si se utilizan cookies locales:

- mantenerlas fuera del repositorio;
- agregarlas al `.gitignore`;
- documentar dónde se esperan;
- protegerlas de logs accidentales.

---

# 15. Límites del proyecto

El proyecto está destinado a descargar contenido al que el usuario pueda acceder legítimamente.

No implementar mecanismos destinados específicamente a:

- romper DRM;
- evadir paywalls;
- acceder a contenido privado sin autorización;
- vulnerar cuentas;
- obtener credenciales;
- saltarse controles de acceso.

Las restricciones técnicas normales de las plataformas pueden manejarse mediante herramientas compatibles, sesiones del propio usuario y mecanismos legítimos.

---

# 16. Seguridad

Toda URL debe tratarse como input no confiable.

Prestar especial atención a:

- command injection;
- path traversal;
- SSRF;
- filenames maliciosos;
- URLs manipuladas;
- argumentos enviados a FFmpeg;
- argumentos enviados a yt-dlp;
- ejecución de shell;
- archivos temporales.

Nunca concatenar directamente input del usuario dentro de comandos de shell.

Sanitizar nombres de archivo.

Nunca permitir que un título remoto controle la ruta completa del archivo.

---

# 17. Archivos descargados

Los archivos deben:

- tener nombres legibles;
- evitar caracteres inválidos;
- evitar sobrescribir archivos accidentalmente;
- conservar extensión correcta.

Cuando exista colisión:

    video.mp4
    video (1).mp4
    video (2).mp4

o utilizar otra estrategia equivalente.

No escribir archivos fuera del directorio autorizado para descargas.

---

# 18. Archivos temporales

Los archivos temporales deben:

- almacenarse en una ubicación definida;
- limpiarse después de una descarga exitosa;
- intentar limpiarse después de errores;
- no acumularse indefinidamente.

No eliminar archivos que no hayan sido creados por la aplicación.

---

# 19. UI/UX

La aplicación debe sentirse simple aunque internamente sea compleja.

Flujo ideal:

1. usuario pega URL;
2. aplicación identifica plataforma;
3. muestra información del contenido;
4. muestra las opciones pertinentes;
5. usuario descarga;
6. muestra progreso;
7. informa dónde quedó guardado.

Evitar mostrar detalles técnicos innecesarios al usuario normal.

Los detalles técnicos deben quedar disponibles mediante logs o modo debug.

---

# 20. Estados de descarga

Cuando la arquitectura lo permita utilizar estados claros:

    idle
    analyzing
    ready
    downloading
    processing
    completed
    failed

Nunca dejar la interfaz indefinidamente en "loading" después de un error.

---

# 21. Progreso

Cuando sea técnicamente posible mostrar:

- porcentaje;
- bytes descargados;
- tamaño total;
- velocidad;
- ETA;
- estado de procesamiento.

No inventar progreso cuando la herramienta subyacente no permita medirlo.

---

# 22. Compatibilidad

El proyecto debe priorizar Windows como entorno local inicial, salvo indicación contraria.

Evitar asumir rutas exclusivas de Linux.

Utilizar:

- `pathlib`;
- APIs multiplataforma;
- detección de ejecutables;
- rutas relativas apropiadas.

Cuando sea sencillo, conservar compatibilidad con Linux y macOS.

---

# 23. Dependencias

Antes de agregar una dependencia nueva comprobar:

1. si el proyecto ya posee algo equivalente;
2. si la dependencia está mantenida;
3. si realmente resuelve un problema;
4. si introduce un peso excesivo;
5. si existe riesgo de seguridad conocido.

No agregar bibliotecas simplemente por comodidad.

Para extractores de plataformas que cambian frecuentemente, preferir proyectos mantenidos activamente antes que implementar scraping frágil propio.

---

# 24. Actualizaciones de plataformas externas

YouTube, Instagram y otras plataformas cambian frecuentemente.

Por eso:

- aislar código específico de cada plataforma;
- evitar depender innecesariamente de HTML interno;
- evitar selectores extremadamente frágiles;
- preferir herramientas mantenidas;
- detectar errores de extractor claramente.

Un fallo en una plataforma nunca debería inutilizar toda la aplicación.

---

# 25. Tests

Toda reparación importante debe intentar incorporar una prueba cuando sea posible.

Prioridades:

## URL detection

Verificar URLs comunes:

    youtube.com/watch
    youtu.be/*
    youtube.com/shorts/*
    instagram.com/p/*
    instagram.com/reel/*

## Platform routing

Comprobar que cada URL selecciona el extractor correcto.

## Filename sanitization

Probar:

- caracteres especiales;
- títulos largos;
- emojis;
- caracteres reservados por Windows.

## Failure handling

Probar URLs inválidas y extractores fallidos.

---

# 26. URLs para tests

Evitar depender exclusivamente de una URL específica que pueda desaparecer.

Separar tests en:

## Unit tests

No requieren conexión externa.

## Integration tests

Contactan plataformas reales.

Los integration tests pueden fallar debido a cambios externos y deben distinguirse claramente de errores internos.

---

# 27. Proceso para reparar una plataforma

Cuando se solicite:

> arreglar YouTube

seguir este orden:

## A. Reproducir

Encontrar un ejemplo que falle.

## B. Localizar

Determinar exactamente qué componente falla.

## C. Explicar

Antes de realizar cambios importantes, identificar la causa.

## D. Reparar

Realizar el cambio mínimo razonable.

## E. Probar YouTube

Confirmar que ahora funciona.

## F. Probar Instagram

Confirmar que continúa funcionando.

## G. Revisar efectos secundarios

Verificar backend, frontend, downloads y filesystem.

## H. Limpiar

Eliminar código temporal de debugging que ya no sea necesario.

---

# 28. No ocultar problemas

Si una solución funciona solo parcialmente, decirlo explícitamente.

Ejemplo:

    YouTube estándar: funciona
    YouTube Shorts: funciona
    Videos con restricción de edad: requieren cookies
    Livestreams: todavía no soportados
    Playlists: todavía no soportadas

No declarar una plataforma como "arreglada" solamente porque funcionó una URL.

---

# 29. No inventar resultados

Nunca afirmar:

- "funciona";
- "está solucionado";
- "los tests pasan";
- "Instagram sigue funcionando";

si no fue realmente comprobado.

Diferenciar siempre entre:

    implementado

y:

    verificado

---

# 30. Cambios pequeños

Preferir modificaciones pequeñas y fáciles de revisar.

Evitar cambiar simultáneamente:

- backend;
- frontend;
- diseño;
- arquitectura;
- dependencias;
- downloader;

si el problema original solo afecta a una plataforma.

---

# 31. Backups y Git

Antes de una modificación estructural importante:

- revisar `git status`;
- identificar cambios no relacionados;
- no sobrescribir trabajo existente;
- conservar los cambios del usuario.

Nunca utilizar destructivamente sin necesidad:

    git reset --hard
    git clean -fd
    git checkout -- .

No borrar trabajo local del usuario.

No modificar historial Git salvo solicitud explícita.

---

# 32. Commits

Cuando se trabaje con commits, preferir cambios conceptualmente separados.

Ejemplos:

    fix(youtube): restore video metadata extraction
    fix(youtube): support shorts URLs
    feat(download): add yt-dlp progress handling
    fix(instagram): preserve existing reel downloader
    refactor(core): isolate platform adapters

No crear commits automáticamente salvo que el flujo de trabajo lo requiera o el usuario lo solicite.

---

# 33. Código existente

Respetar:

- lenguaje;
- framework;
- convenciones;
- estructura;
- estilo;

del repositorio salvo que exista una razón concreta para cambiarlos.

No transformar el proyecto a otra tecnología sin autorización.

Si está hecho en Python, no migrarlo a Node.

Si está hecho en Node, no migrarlo a Python.

Puede utilizarse una herramienta externa escrita en otro lenguaje si se integra limpiamente y resuelve un problema concreto.

---

# 34. Comentarios

Agregar comentarios principalmente para explicar:

- decisiones no obvias;
- workarounds;
- restricciones de APIs;
- comportamiento peculiar de una plataforma.

Evitar comentarios que simplemente repitan el código.

---

# 35. Documentación técnica

Cuando se descubra una particularidad importante, documentarla.

Especialmente:

- por qué un extractor utiliza determinado método;
- qué plataformas requieren cookies;
- qué dependencia maneja cada plataforma;
- requerimientos de FFmpeg;
- ubicación de downloads;
- variables de entorno;
- limitaciones conocidas.

---

# 36. README

No reescribir el README innecesariamente.

Actualizarlo cuando cambie:

- instalación;
- dependencias;
- configuración;
- plataformas soportadas;
- requisitos;
- comportamiento visible para el usuario.

---

# 37. Gestión de secretos

Nunca incluir en Git:

    cookies.txt
    .env
    credentials.json
    tokens
    session files
    API keys

Comprobar `.gitignore` cuando aparezcan estos archivos.

---

# 38. Prioridades iniciales del proyecto

Trabajar inicialmente en este orden:

## Prioridad 1
Comprender completamente el repositorio.

## Prioridad 2
Documentar qué plataformas existen y cuáles funcionan.

## Prioridad 3
Preservar Instagram.

## Prioridad 4
Diagnosticar YouTube.

## Prioridad 5
Reparar YouTube.

## Prioridad 6
Agregar tests/regresiones básicas.

## Prioridad 7
Mejorar mensajes de error.

## Prioridad 8
Mejorar arquitectura únicamente donde sea necesario.

## Prioridad 9
Agregar o reparar otras plataformas.

## Prioridad 10
Pulir interfaz y experiencia.

---

# 39. Objetivo de soporte

A largo plazo la arquitectura debería permitir incorporar plataformas como:

- YouTube;
- Instagram;
- TikTok;
- X/Twitter;
- Facebook;
- Reddit;
- Vimeo;
- Twitch;
- otras fuentes compatibles.

Esto es una dirección futura.

NO intentar implementar todas las plataformas de una sola vez.

---

# 40. Definición de plataforma soportada

Una plataforma solamente puede considerarse soportada si al menos se verifican sus formatos principales.

Ejemplo YouTube:

- video normal;
- Shorts;
- URL `youtu.be`;
- distintos formatos/resoluciones;
- audio/video cuando correspondan.

Ejemplo Instagram:

- publicaciones;
- reels;
- videos;
- imágenes;
- carruseles, si la arquitectura los soporta.

---

# 41. Regla de oro para debugging

No arreglar síntomas cuando pueda identificarse la causa.

Si YouTube falla porque una dependencia quedó obsoleta:

NO agregar diez excepciones alrededor del error.

Actualizar, reemplazar o aislar correctamente la dependencia.

Si Instagram funciona gracias a comportamiento específico existente:

NO eliminarlo simplemente para hacer el código más uniforme.

Funcionalidad real > elegancia teórica.

---

# 42. Comunicación durante el desarrollo

Al realizar una tarea significativa informar de forma breve:

1. qué se encontró;
2. cuál parece ser la causa;
3. qué se modificó;
4. qué se verificó después;
5. qué problemas siguen pendientes.

Evitar narrar cada comando trivial.

Cuando haya varias alternativas técnicas, recomendar una y explicar brevemente por qué.

---

# 43. Autonomía

El agente tiene permiso para:

- inspeccionar el repositorio;
- leer archivos;
- ejecutar la aplicación;
- ejecutar tests;
- analizar logs;
- instalar dependencias necesarias del proyecto cuando corresponda;
- modificar código;
- crear módulos;
- corregir errores;
- agregar tests;
- actualizar documentación relacionada;
- utilizar Git para inspección y comparación.

No detener el trabajo para pedir permiso por modificaciones normales y reversibles necesarias para completar una tarea.

Antes de realizar acciones potencialmente destructivas, elegir una alternativa segura.

---

# 44. Prohibiciones

No:

- borrar cambios del usuario;
- eliminar archivos porque parezcan innecesarios sin investigar;
- reescribir todo el proyecto para solucionar un bug;
- actualizar todas las dependencias indiscriminadamente;
- cambiar frameworks sin necesidad;
- introducir credenciales;
- inventar APIs;
- ocultar errores;
- declarar pruebas exitosas que no fueron ejecutadas;
- eliminar funcionalidad existente para simplificar el código.

---

# 45. Criterio de finalización

Una tarea se considera terminada cuando:

1. se identificó el problema;
2. se implementó una solución;
3. el código compila o ejecuta cuando corresponde;
4. se probaron los caminos afectados;
5. no aparecen regresiones conocidas;
6. Instagram continúa funcionando si el cambio podía afectarlo;
7. YouTube se prueba cuando el cambio está relacionado con YouTube;
8. los errores restantes están documentados claramente.

---

# 46. Principio final

Este repositorio no debe ser tratado como código descartable.

Existe una base que ya funciona parcialmente.

La misión es convertirla progresivamente en un downloader robusto y mantenible sin destruir las partes que ya funcionan.

Siempre:

    UNDERSTAND → REPRODUCE → ISOLATE → FIX → TEST → VERIFY → IMPROVE

Nunca:

    ASSUME → REWRITE EVERYTHING → HOPE
