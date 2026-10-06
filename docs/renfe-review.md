# Revisión Renfe · EnRuta 1.5

La revisión recorre todos los patrones y trazados de los archivos de Renfe y Cercanías. El informe reproducible está en `public/data/renfe-audit.json`; se genera con `python tools/audit_geometry.py`.

## Identidad y representación

Los IDs GTFS de Cercanías separan sentidos, trayectos parciales y variantes. Se agrupan por núcleo publicado y nombre comercial. R3 de Barcelona no se mezcla con una R3 de otro núcleo. Cada ID de origen se conserva como alias para los enlaces anteriores. Las rutas de larga distancia se agrupan por producto y extremos del corredor, conservando todos los patrones, calendarios, identificadores de viaje y geometrías.

La vista lineal combina secuencias parciales únicamente cuando comparten al menos dos estaciones en el mismo orden y no describen ramales alternativos entre ellas. Los trenes se sitúan según su propio patrón de paradas, incluidos servicios que saltan estaciones. La R3 queda representada en dos sentidos; se conservan sus trayectos parciales publicados. La descripción del servicio puede citar terminales históricos aunque el archivo actual publique recorridos parciales: el esquema refleja las estaciones de los viajes disponibles, sin añadir servicio inexistente.

Los transbordos excluyen la identidad comercial de la propia línea. Para productos con varios corredores se muestra un solo distintivo y un desplegable con cada recorrido navegable. Las conexiones proceden de estaciones y transbordos GTFS; no se deducen de la mera proximidad.

## Geometría y velocidad

Se priorizan corredores completos publicados en el GTFS de Renfe, recortados a las paradas ordenadas del viaje, con un desplazamiento máximo de 250 m entre estación y trazado. No se ensamblan piezas inconexas de distintas rutas. Esto corrige el desvío de aproximadamente 32 km que la cartografía de infraestructura producía entre Sants y Passeig de Gràcia: el corredor del operador mide aproximadamente 2,45 km entre ambas.

Cuando no existe un corredor completo del operador, la reconstrucción utiliza la red ferroviaria conectada del IGN, con ponderación de ancho para AVE, Avlo y Avant. Los bucles de infraestructura y desvíos locales excesivos se descartan. Los trazados reconstruidos siguen siendo inferencias: el GTFS no confirma decisiones del centro de control ni qué vía o bypass utiliza un tren concreto. No parar en una estación no implica desviarse de su corredor. El [dossier de Adif de la LAV Madrid–Barcelona](https://www.adif.es/documents/34745/14043255/20230220%2BDossier%2B15%2Ba%C3%B1os%2BLAV%2BMadrid-Barcelona.pdf/0345e611-23f4-4c10-ebc5-7fea345be090?t=1676833342143) documenta Camp de Tarragona y la variante de Lleida.

La animación comprueba cada intervalo: 200 km/h en Cercanías, 220 km/h en productos convencionales y 360 km/h en productos que pueden utilizar alta velocidad. Son límites conservadores de validación, no velocidades de circulación anunciadas. Si la distancia y el tiempo no son compatibles, se omite la posición estimada de ese viaje, también antes y después del tramo, para impedir saltos instantáneos. Los horarios permanecen consultables; no se corrigen ni inventan tiempos. Los trazados inválidos no se rescatan de la versión anterior del importador.

## GPS

La [API oficial de posiciones de Cercanías](https://data.renfe.com/es/dataset/ubicacion-vehiculos) publica GTFS-RT JSON cada 20 segundos, bajo CC BY 4.0. La unión con el horario usa exclusivamente `trip.tripId`. Se conservan el identificador publicado del tren, su etiqueta y la hora individual de medición. Se descartan posiciones ausentes, desconocidas o con más de 90 segundos. Las coordenadas publicadas reemplazan la estimación del mismo viaje. El esquema lineal solo muestra GPS si se puede proyectar a su propio corredor; no fuerza puntos alejados sobre una línea.

El servidor incluido ofrece `/api/renfe/positions`, con caché de 15 segundos, destinos fijos y consultas limitadas. Funciona sin credenciales TMB. La API de Renfe no ofrece CORS para GitHub Pages; se necesita ejecutar y conectar este servidor desde Fuentes. Pages mantiene estimaciones identificadas como tales y explica la conexión necesaria. El GPS no se convierte en una llegada en tiempo real: los tiempos mostrados siguen siendo horarios, sin corrección de retrasos.

Renfe también dispone de un [visor oficial de larga distancia](https://tiempo-real.largorecorrido.renfe.com/), anunciado en marzo de 2026. Sus posiciones no se unen por semejanza de números a los viajes estáticos: EnRuta mantiene estas circulaciones como estimaciones hasta disponer de una correspondencia fiable. No se atribuyen ocupación ni matrículas no publicadas.

## Cámara

Al abrir un vehículo se activa el seguimiento. Cada actualización centra su posición conservando el zoom, orientación e inclinación elegidos por el usuario. «Seguimiento activo» permite pausarlo y reactivarlo. Al cerrar o navegar a otra ficha se detiene; se restaura la vista previa cuando se cierra el detalle. FGC utiliza su publicación GPS, Renfe utiliza GPS vigente cuando está conectado y el resto utiliza la posición estimada identificada en la ficha.
