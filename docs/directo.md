# Directo y simulación en EnRuta 1.8

El modo predeterminado es **En directo · datos publicados**. Ningún fallo de red, ausencia de GPS o previsión caducada activa la interpolación GTFS. El mapa y el diagrama lineal comparten esta selección. Las posiciones publicadas permanecen en su última coordenada recibida; no se extrapolan por el horario ni se animan entre actualizaciones. La simulación se activa expresamente en «Reloj y horarios», al modificar el reloj o al abrir un enlace fechado de un servicio del horario; aparece un rótulo visible en el mapa.

| Fuente                            | Información utilizada                                                        | Consulta       | Acceso                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------- |
| FGC Geotren                       | Coordenadas, línea, destino, estación, puntualidad y ocupación cuando existe | 4 s            | Público, directo desde el navegador; CORS verificado                    |
| FGC paneles ISIC                  | Pantalla oficial de próximas salidas de 52 estaciones                        | 8 s            | Imagen pública, actualización del operador                              |
| TMB iBus                          | Previsión de llegada y número de autobús cuando existe                       | 20 s           | Claves TMB en el servidor                                               |
| AMB GTFS-RT                       | Previsiones de paso, incluidos servicios Nitbus publicados                   | 20 s           | Público, mediante servidor por ausencia de CORS                         |
| Renfe Cercanías / larga distancia | Coordenadas y datos publicados vinculados a un único viaje                   | 20 s           | Público, mediante servidor por ausencia de CORS                         |
| Metro TMB / demás operadores      | Red y horarios GTFS                                                          | Archivo diario | No hay una conexión de posiciones o previsiones en directo implementada |

Fuentes oficiales comprobadas el 7 de octubre de 2026:

- [Geotren FGC](https://geotren.fgc.cat/): su web solicita `/tracker/trens.geojson` cada cuatro segundos, sin autenticación, y paneles `/isic/{estación}` cada ocho. Publica CORS `*` para las coordenadas. Su conjunto de datos abiertos se renueva más lentamente; la app utiliza el visor directamente.
- [Códigos de estaciones FGC](https://dadesobertes.fgc.cat/explore/dataset/codigo-estaciones/): traducción de destinos como PC o SR a nombres. Licencia CC BY 4.0.
- [iBus TMB](https://developer.tmb.cat/api-docs/v1/ibus): los tiempos son previsiones basadas en la última localización conocida, con precisión máxima de un minuto. El contador de segundos no aumenta esa precisión. Esta API **no proporciona un mapa GPS de toda la flota**. El catálogo consultado no incluye una API de llegadas/posiciones de metro; sería necesario confirmar un acceso específico con TMB.
- [GTFS Real time AMB](https://www.amb.cat/ca/web/area-metropolitana/dades-obertes/cataleg/detall/-/dataset/servei-gtfs-real-time-autobusos/6332347/11692): tiempos de paso de autobuses AMB, excluidos los TMB. Se decodifica el protobuf oficial; se enlaza cada `tripId` exacto con GTFS. No se inventan vehículos, coordenadas ni llegadas a partir de un retraso aislado. Se omiten viajes cancelados y paradas omitidas.
- [Renfe Data](https://data.renfe.com/es/dataset/ubicacion-vehiculos) y [visor de larga distancia](https://tiempo-real.largorecorrido.renfe.com/).

Geotren no publica la hora individual de medición de cada posición. La ficha muestra **hora de consulta**, nunca una hora GPS inventada. Si no llega una respuesta válida en 20 segundos, las posiciones desaparecen. TMB, AMB y Renfe descartan datos de más de 90 segundos. Una respuesta de llegadas vacía significa que el operador no anuncia llegadas, no que deban sustituirse por horarios. Los paneles FGC conservan la presentación y resolución temporal del operador; no se convierten en un contador inventado. Las previsiones de iBus/AMB pueden cambiar con el tráfico. Los GPS de Renfe no se convierten en una predicción de llegada.

## Activar el servidor público

GitHub Pages solo sirve archivos. Los secretos de Actions permiten actualizar el archivo GTFS, pero no ejecutan un servidor permanente ni pueden leerse desde la web. Nunca se incluyen claves en JavaScript.

1. Abre [Deploy to Render](https://render.com/deploy?repo=https://github.com/AlejandroPico/TMB), entra con tu cuenta y conecta este repositorio. El fichero `render.yaml` prepara un servicio Docker.
2. Introduce `TMB_APP_ID` y `TMB_APP_KEY` en los campos privados de Render. Debes recuperar sus valores del portal de TMB: los secretos ya guardados en GitHub no pueden volver a leerse.
3. Cuando termine, la dirección HTTPS de Render sirve **la aplicación y sus APIs juntas**, lista para consultar AMB/Renfe y, con las claves, TMB. No necesita otra configuración para usarse allí.
4. Para que también funcione en la dirección de GitHub Pages, añade la URL de Render como variable de repositorio **API_BASE** en GitHub → Settings → Secrets and variables → Actions → Variables; vuelve a ejecutar el workflow de publicación. También se puede probar en «Fuentes y cobertura → Servidor para datos en directo».

AMB y Renfe no necesitan claves adicionales. El fichero propone el plan gratuito para probarlo; [Render suspende los servicios gratuitos inactivos](https://render.com/docs/free), por lo que para disponibilidad continua hay que elegir un plan que permanezca activo. La frecuencia final depende también del operador. No se ha creado una cuenta ni contratado un servicio automáticamente.

## Verificación

Las pruebas cubren ausencia de sustitución por horarios, publicaciones caducadas, respuestas vacías, cancelaciones, llegadas con timestamp absoluto, identificadores legibles y proyección de coordenadas reales en el diagrama. Se ha consultado AMB sin credenciales y verificado la correspondencia exacta de sus viajes con el GTFS local. FGC se verifica desde el navegador con sus coordenadas y pantallas oficiales. La consulta autenticada iBus queda pendiente de introducir las claves en el servidor público.
