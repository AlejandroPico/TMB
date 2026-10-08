# Directo y consulta de horarios en EnRuta 1.8.1

El modo predeterminado es **En directo · datos publicados**. Ningún fallo de red, ausencia de GPS o previsión caducada activa la interpolación GTFS. El mapa y el diagrama lineal comparten esta selección. Las posiciones publicadas permanecen en su última coordenada recibida; no se extrapolan por el horario ni se animan entre actualizaciones. La consulta de horarios no crea vehículos en el mapa ni en el diagrama. Sus controles solo se habilitan al elegir «Horarios publicados · sin vehículos». Los enlaces antiguos del horario no activan un modo simulado: abren el GPS actual si existe o la ficha de la línea. Cambiar de ciudad vuelve al directo.

| Fuente                            | Información utilizada                                                        | Consulta       | Acceso                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------- |
| FGC Geotren                       | Coordenadas, línea, destino, estación, puntualidad y ocupación cuando existe | 4 s            | Público, directo desde el navegador; CORS verificado                    |
| FGC paneles ISIC                  | Pantalla oficial de próximas salidas de 52 estaciones                        | 8 s            | Imagen pública, actualización del operador                              |
| TMB iBus                          | Previsión de llegada y número de autobús cuando existe                       | 20 s           | Claves TMB en el servidor                                               |
| AMB GTFS-RT                       | Previsiones de paso, incluidos servicios Nitbus publicados                   | 20 s           | Público, mediante servidor por ausencia de CORS                         |
| Renfe Cercanías / larga distancia | Coordenadas y datos publicados vinculados a un único viaje                   | 20 s           | Público, mediante servidor por ausencia de CORS                         |
| EMT Málaga                        | Coordenadas, línea y número físico de autobús                                | 30 s           | Público, mediante servidor; actualización publicada cada minuto         |
| Metro TMB / demás operadores      | Red y horarios GTFS                                                          | Archivo diario | No hay una conexión de posiciones o previsiones en directo implementada |

Fuentes oficiales comprobadas el 7 de octubre de 2026:

- [Geotren FGC](https://geotren.fgc.cat/): su web solicita `/tracker/trens.geojson` cada cuatro segundos, sin autenticación, y paneles `/isic/{estación}` cada ocho. Publica CORS `*` para las coordenadas. Su conjunto de datos abiertos se renueva más lentamente; la app utiliza el visor directamente.
- [Códigos de estaciones FGC](https://dadesobertes.fgc.cat/explore/dataset/codigo-estaciones/): traducción de destinos como PC o SR a nombres. Licencia CC BY 4.0.
- [iBus TMB](https://developer.tmb.cat/api-docs/v1/ibus): los tiempos son previsiones basadas en la última localización conocida, con precisión máxima de un minuto. El contador de segundos no aumenta esa precisión. Esta API **no proporciona un mapa GPS de toda la flota**. El catálogo consultado no incluye una API de llegadas/posiciones de metro; sería necesario confirmar un acceso específico con TMB.
- [GTFS Real time AMB](https://www.amb.cat/ca/web/area-metropolitana/dades-obertes/cataleg/detall/-/dataset/servei-gtfs-real-time-autobusos/6332347/11692): tiempos de paso de autobuses AMB, excluidos los TMB. Se decodifica el protobuf oficial; se enlaza cada `tripId` exacto con GTFS. No se inventan vehículos, coordenadas ni llegadas a partir de un retraso aislado. Se omiten viajes cancelados y paradas omitidas.
- [EMT Málaga](https://datosabiertos.malaga.eu/es/dataset/ubicaciones-de-autobuses-emt-en-tiempo-real): coordenadas reales del recurso GeoJSON público. Se conserva el punto publicado y su hora local convertida con la zona Europe/Madrid; se rechazan horas ambiguas del cambio de hora. La parada de referencia se relaciona por su código oficial. La proyección sobre el diagrama requiere un único recorrido compatible y proximidad de 150 m al trazado. En caso contrario se mantiene el punto del mapa, sin inventar un sentido en el diagrama. No ofrece previsiones de llegada. El catálogo indica un minuto, pero durante las comprobaciones también hubo publicaciones que permanecieron sin renovar varios minutos: se ocultan al superar 90 segundos.
- [Renfe Data](https://data.renfe.com/es/dataset/ubicacion-vehiculos) y [visor de larga distancia](https://tiempo-real.largorecorrido.renfe.com/).

Geotren no publica la hora individual de medición de cada posición. La ficha muestra **hora de consulta**, nunca una hora GPS inventada. Si no llega una respuesta válida en 20 segundos, las posiciones desaparecen. TMB, AMB y Renfe descartan datos de más de 90 segundos. Una respuesta de llegadas vacía significa que el operador no anuncia llegadas, no que deban sustituirse por horarios. Los paneles FGC conservan la presentación y resolución temporal del operador; no se convierten en un contador inventado. Las previsiones de iBus/AMB pueden cambiar con el tráfico. Los GPS de Renfe no se convierten en una predicción de llegada.

## Activar el servidor público

GitHub Pages solo sirve archivos. Los secretos de Actions permiten actualizar el archivo GTFS, pero no ejecutan un servidor permanente ni pueden leerse desde la web. Nunca se incluyen claves en JavaScript.

1. Abre [Deploy to Render](https://render.com/deploy?repo=https://github.com/AlejandroPico/TMB), entra con tu cuenta y conecta este repositorio. El fichero `render.yaml` prepara un servicio Docker.
2. Introduce `TMB_APP_ID` y `TMB_APP_KEY` en los campos privados de Render. Debes recuperar sus valores del portal de TMB: los secretos ya guardados en GitHub no pueden volver a leerse.
3. Cuando termine, la dirección HTTPS de Render sirve **la aplicación y sus APIs juntas**, lista para consultar AMB/Renfe/Málaga y, con las claves, TMB. No necesita otra configuración para usarse allí.
4. Para que también funcione en la dirección de GitHub Pages, añade la URL de Render como variable de repositorio **API_BASE** en GitHub → Settings → Secrets and variables → Actions → Variables; vuelve a ejecutar el workflow de publicación. También se puede probar en «Fuentes y cobertura → Servidor para datos en directo».

AMB, Renfe y Málaga no necesitan claves adicionales. El fichero propone el plan gratuito para probarlo; [Render suspende los servicios gratuitos inactivos](https://render.com/docs/free), por lo que para disponibilidad continua hay que elegir un plan que permanezca activo. La frecuencia final depende también del operador. No se ha creado una cuenta ni contratado un servicio automáticamente.

## Verificación

Las pruebas cubren ausencia de sustitución por horarios, publicaciones caducadas, respuestas vacías, cancelaciones, llegadas con timestamp absoluto, identificadores legibles y proyección de coordenadas reales en el diagrama. Se ha consultado AMB sin credenciales y verificado la correspondencia exacta de sus viajes con el GTFS local. Málaga se ha consultado sin credenciales: se verifica el número físico, el código de línea y la correspondencia de paradas, sin ampliar el límite de antigüedad cuando el proveedor tarda en renovar el archivo. FGC se verifica desde el navegador con sus coordenadas y pantallas oficiales. La consulta autenticada iBus se ha verificado desde GitHub Pages contra el servidor público en Render, con sus claves privadas configuradas.

## Revisión de N0 y posiciones de autobús (8 de octubre de 2026)

Se ha verificado la línea AMB `216` (N0), sus dos sentidos circulares y las paradas **Marina - Monumental**, códigos `3262` / `3231` (GTFS `003262` / `003231`). La respuesta consultada incluía nueve viajes de N0, con previsiones explícitas para ambas paradas. No se deduce una posición a partir de esas horas.

El protobuf original de AMB contenía 236 entidades `tripUpdate` y **ninguna entidad `vehicle` con posición** en la comprobación. No se trata de coordenadas que el adaptador haya descartado: faltan en el recurso de origen. El [catálogo oficial](https://www.amb.cat/es/web/area-metropolitana/dades-obertes/cataleg/detall/-/dataset/servicio-gtfs-real-time-autobuses/6332347/11692) identifica este servicio como Trip Updates. La [especificación iBus vigente](https://developer.tmb.cat/assets/api-docs/v1/ibus/swagger.json) contiene únicamente `/bus/parades/{codi_parada}`; `ProperBus` tiene `temps_arribada` e `id_bus`, sin latitud/longitud. Tener un número de vehículo o una predicción basada en GPS no proporciona sus coordenadas.

No se ha encontrado otro feed oficial accesible de coordenadas del Nitbus en el catálogo revisado. Para representar sus autobuses hace falta que AMB o el operador faciliten un servicio **VehiclePositions / SAE**, con coordenadas, hora de medición, identificador del vehículo y correspondencia de línea/viaje, además del permiso para reutilizarlos. El [catálogo de servicios con solicitud de acceso](https://www.amb.cat/es/web/area-metropolitana/dades-obertes/cataleg/detall/-/dataset/informacion-de-companias--lineas-y-recorridos-del-municipio-seleccionado/1027679/11692) ofrece un canal de solicitud, pero describe datos de compañías y recorridos: no garantiza que concedan posiciones GPS. No se necesita otra clave para las llegadas AMB ya conectadas; otra cuenta no soluciona por sí sola la ausencia de un feed de posiciones.

También se ha revisado la documentación pública del [servicio SOAP de AMB](https://serveis2.ambmobilitat.cat/Sec_WebServExportarAMB/Service.asmx). `ObtenirBusLinea` devuelve compañías y líneas; su parámetro `strTipusCoordenada` no significa que devuelva la posición de autobuses. `ObtenirTemps` y `ObtenirTempsTots` documentan previsiones por parada, sin coordenadas del vehículo. Las peticiones de estos servicios requieren `AuthHeader` con usuario y contraseña. No se han realizado peticiones autenticadas ni operaciones de generación/mantenimiento. Estos contratos tampoco proporcionan el GPS que falta.

En una segunda consulta al protobuf de origen, a las **01:55 UTC del 8 de octubre de 2026**, había 274 entidades `tripUpdate` y cero `vehicle.position`; la publicación era de las 01:54:51 UTC. Es una observación del recurso consultado, no una afirmación de que los operadores no dispongan de GPS interno.

El siguiente paso de acceso está preparado en [Solicitud de posiciones GPS](solicitud-gps.md), con textos para AMB y TMB. Hace falta la respuesta del titular de los datos antes de implementar otro proveedor; no basta con registrarse de nuevo en el portal existente.

## Actualizar una instalación existente en Render

El despliegue de GitHub Pages y el de Render son independientes. Publicar `main` no demuestra que ambos estén actualizados. Si Render sigue mostrando «Simulación por horario», está sirviendo una versión anterior a esta corrección.

En el servicio **enruta-directo**, seleccionar **Manual Deploy → Deploy latest commit** y esperar a **Live**. Este despliegue reutiliza las variables privadas ya configuradas. Después recargar la aplicación: en Tiempo debe aparecer «Horarios publicados · sin vehículos» y el directo no debe crear puntos a partir de horarios. No elegir «Deploy a specific commit» con una revisión antigua.
