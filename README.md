# Barcelona Latido

Un atlas inmersivo de la red de **Transports Metropolitans de Barcelona**. Recorre sus líneas, adelanta el reloj y descubre las historias que viven bajo sus calles.

**[Abrir la aplicación](https://alejandropico.github.io/TMB/)**

## La experiencia

- Mapa de todas las líneas de bus, metro y funicular del GTFS, con trazados y paradas geográficas.
- Edificios en 3D, donde OpenStreetMap dispone de datos, y control de inclinación.
- Vehículos animados sobre sus recorridos **según horarios**, con fecha y velocidades de 1×, 10× y 60×. No son posiciones GPS.
- Búsqueda de líneas y paradas; próximas salidas, accesibilidad publicada, accesos y favoritos conservados en el navegador.
- Viajes entre paradas con calendario y transbordos. El cálculo se realiza en un trabajador separado para mantener la interfaz fluida.
- Paradas alcanzables en 15, 30 o 45 minutos desde una estación. Se muestran puntos, no una isócrona peatonal.
- Seis historias con fuentes del archivo de TMB y tres recorridos editoriales.
- Panel «Datos» con procedencia, versión, calendario y conexión opcional a las APIs.

## Datos reales y límites

La copia inicial utiliza el GTFS oficial de TMB del 2 de octubre de 2026, archivado públicamente por Mobility Database el 3 de octubre: 115 líneas, 2.809 puntos de embarque y 57.105 viajes importados. Un punto de embarque no equivale necesariamente a una estación única. Se importan accesos, caminos internos, frecuencias, excepciones de calendario y tiempos mínimos de transbordo.

Las posiciones se interpolan entre paradas siguiendo los trazados. Las horas intermedias vacías del GTFS se interpolan entre los puntos con hora; los servicios por frecuencia son estimaciones. Se contemplan viajes después de medianoche y servicios iniciados el día anterior.

La planificación local aplica los transbordos explícitos del GTFS y añade enlaces a pie entre paradas próximas. Estos enlaces son aproximados y no siguen calles. No incluye incidencias, ascensores fuera de servicio, tarifas ni operadores ausentes del GTFS de TMB. El filtro de accesibilidad exige `wheelchair_boarding=1`; no garantiza la accesibilidad de todo el trayecto.

## APIs del portal TMB

Se revisaron las especificaciones oficiales el 6 de octubre de 2026. [El catálogo](docs/api-catalog.json) recoge todos los recursos publicados en Transit, iBus y Planner.

| Servicio      | Uso                                                                                                           | Acceso                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Static / GTFS | Red, recorridos, paradas, accesos, horarios y calendario                                                      | Archivo público; descarga oficial con claves |
| Transit       | Más información en líneas, mobiliario y correspondencias de bus; servidor con todos los recursos del catálogo | Requiere credenciales                        |
| iBus          | Próximos buses por parada, con timestamp y control de antigüedad                                              | Requiere credenciales                        |
| Planner       | Planificador oficial cuando el servidor está configurado; alternativa local sin acceso                        | Requiere credenciales                        |

**Sin claves funcionan el mapa y las funciones basadas en GTFS. Las APIs autenticadas están integradas, pero no se han podido verificar con credenciales válidas.** No se usan claves ajenas ni se inventan respuestas. El portal consultado documenta tiempos de paso de bus, no posiciones GPS en directo de trenes.

## Ejecutar

Node.js 22+ y pnpm 10.17.1:

```sh
pnpm install
pnpm dev
```

Los datos vienen incluidos. Para preparar la distribución:

```sh
pnpm test
pnpm build
pnpm preview
```

## Activar las APIs

1. Registra tu aplicación en [developer.tmb.cat](https://developer.tmb.cat/) y obtén `app_id` y `app_key`.
2. Copia `.env.example` a `.env` y rellena `TMB_APP_ID` y `TMB_APP_KEY` en el servidor.
3. Ejecuta `pnpm build` y `pnpm start`. Abre `http://127.0.0.1:8787`. En desarrollo, inicia también `pnpm dev`: Vite envía las consultas de API al servidor.
4. Para GitHub Pages, aloja el servidor Node en un servicio HTTPS y escribe su URL en «Datos → Servidor para datos en directo». Configura `HOST=0.0.0.0`, el puerto del proveedor y `ALLOWED_ORIGINS=https://alejandropico.github.io`.

Las claves nunca entran en archivos públicos. El servidor restringe recursos, limita consultas, agrupa peticiones concurrentes y conserva respuestas brevemente. iBus solo se muestra con el reloj actual y una respuesta de menos de 90 segundos; no consulta continuamente toda la red.

**GitHub Pages es estático:** los secretos de GitHub Actions sirven para renovar el GTFS; el servidor es necesario para iBus, Transit y Planner autenticados.

## Publicación y renovación

`.github/workflows/pages.yml` valida, compila y publica al subir a `main`. También renueva la web los lunes a las 04:23 UTC y mediante ejecución manual. Si falla la descarga, conserva los datos incluidos. La importación actualizada se publica en la web sin crear commits automáticos.

La renovación usa `TMB_APP_ID` y `TMB_APP_KEY` si existen como secretos del repositorio; si no, descubre el último archivo público de Mobility Database. Localmente: `python tools/import_gtfs.py` (Python 3.12+, biblioteca estándar).

## Fuentes y atribuciones

- [TMB: herramientas para desarrolladores](https://www.tmb.cat/es/tmb-app-y-otras-aplicaciones/herramientas-para-desarrolladores), [portal y condiciones](https://developer.tmb.cat/docs/terms-conditions).
- [GTFS de TMB en Mobility Database](https://mobilitydatabase.org/feeds/gtfs/mdb-2359). Procedencia, fecha y hash se conservan en `public/data/network.json`.
- [Cronología del metro](https://historia.tmb.cat/100-anys-metro/es/cronologia/), [trayecto histórico](https://historia.tmb.cat/100-anys-metro/es/trayecto/) y [elementos del centenario](https://www.tmb.cat/es/centenario-metro/elementos-conmemorativos). Textos editoriales con fuentes enlazadas.
- Cartografía © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [OpenMapTiles](https://openmaptiles.org/) y [OpenFreeMap](https://openfreemap.org/). Atribución visible en el mapa.
- Motor [MapLibre GL JS](https://maplibre.org/) e iconos [Lucide](https://lucide.dev/), con sus licencias. DM Sans y Manrope, a través de Google Fonts.

La cartografía y las fuentes requieren conexión. No es un producto oficial de TMB.
