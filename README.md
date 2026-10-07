# EnRuta

Transporte público de España: mapa en 3D, horarios, viajes e historias con fuentes. **[Abrir la aplicación](https://alejandropico.github.io/TMB/)**.

## Directo y consulta de horarios

El modo predeterminado solo muestra **posiciones y previsiones publicadas**. Los horarios GTFS se consultan sin crear vehículos animados, incluso al cambiar la fecha o abrir un enlace antiguo. FGC Geotren conecta directamente cada cuatro segundos y ofrece paneles oficiales de salidas. AMB/Nitbus, Renfe, EMT Málaga e iBus necesitan el servidor incluido; iBus requiere además las claves TMB. [Fuentes verificadas, límites y activación paso a paso](docs/directo.md).

[Activar el servidor en Render](https://render.com/deploy?repo=https://github.com/AlejandroPico/TMB). El repositorio incluye Dockerfile y render.yaml.

## Nombre y favicon

Edita `name` en **[app.config.json](app.config.json)**. Alimenta la marca, el título y los textos de la aplicación. También contiene la descripción y la ciudad inicial. El nombre no depende del nombre del repositorio.

También puedes cambiarlo en GitHub → Settings → Secrets and variables → Actions → **Variables** → New repository variable: nombre `APP_NAME`, valor el nuevo nombre. Ejecuta Actions para publicarlo. Esa variable tiene prioridad sobre el fichero. Es información pública, no un secreto.

**[favicon.svg](favicon.svg)** está en la raíz de `main`. Es el único original: la compilación lo utiliza como icono del navegador y lo publica además como `/TMB/favicon.svg`.

## Cobertura

| Vista           | Operadores                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Barcelona       | TMB, FGC, TRAM (T1–T6) y AMB, incluido Nitbus                                                      |
| Madrid          | Metro, EMT y Metro Ligero                                                                          |
| Sevilla         | TUSSAM, Metro y Consorcio del Área de Sevilla                                                      |
| Zaragoza        | Avanza urbana y tranvía                                                                            |
| Andalucía       | Consorcios de Bahía de Cádiz, Granada, Málaga, Campo de Gibraltar, Almería, Jaén, Córdoba y Huelva |
| Bilbao          | Metro Bilbao, Euskotren, tranvía, funicular de Larreineta y Bilbobus                               |
| Donostia        | Euskotren E1 y E2, Dbus y Búhos                                                                    |
| Vitoria-Gasteiz | Tranvía Euskotren TG1/TG2 y autobuses TUVISA                                                       |
| España · Renfe  | AVE, Larga y Media Distancia, Cercanías y Rodalies                                                 |

Dieciséis vistas: siete ciudades, ocho áreas adicionales de consorcios andaluces y la red nacional de Renfe. Las áreas adicionales muestran los servicios del consorcio; Málaga y Granada añaden sus redes urbanas y Jaén añade el Búho. No incluyen todos los operadores de cada ciudad. No cubre todavía todos los operadores de España. Cercanías se explora en la vista nacional; no se planifican enlaces entre vistas. Las líneas GTFS pueden representar variantes de un servicio, no números comerciales únicos. Los datos se cargan al seleccionar cada vista. Puedes compartirla con `?city=madrid`, `sevilla`, `zaragoza`, `barcelona` `bilbao`, `donostia`, `vitoria` o `espana`.

**El calendario público consultado de Metro de Madrid termina el 27 de mayo de 2026, y el de Avanza Zaragoza el 5 de octubre de 2026.** Se conservan sus redes y horarios archivados con un aviso visible. No se extienden las fechas. El resto de operadores tiene calendarios independientes. «Fuentes» muestra procedencia, licencia, versión, vigencia y SHA-256 por operador.

## Autobuses nocturnos

«Explorar → Nocturnos» filtra el mapa y la vista lineal. Filtros separa los nocturnos por operador y línea. Se respetan calendarios, excepciones y la continuidad después de medianoche; no todas las líneas circulan todas las noches. [Fuentes, cobertura y revisión](docs/night-services-review.md). Las fuentes estáticas se renuevan diariamente; los horarios nunca se convierten en posiciones de vehículos. Las previsiones AMB requieren la conexión al servidor.

## Funciones

- Mapa a pantalla completa, menú lateral contraído y paneles que se despliegan a la derecha. En móvil, hamburguesa. Sin cabecera ni tarjetas promocionales. Paneles y botones con esquinas rectas.
- Filtros jerárquicos independientes de recorridos, paradas y vehículos: todos, tipo/operador y línea. Botón «Solo» para aislar una línea; estados parciales y reinicio. Historias y movimiento de autobuses diurnos apagados al iniciar; los nocturnos conservan el movimiento según su calendario.
- Vista lineal con líneas ordenadas, sentidos paralelos, ramales, paradas y vehículos estimados seleccionables. Una barra horizontal por línea, arrastre con ratón y desplazamiento táctil. Comparte los filtros de recorridos y vehículos con el mapa. Cada recorrido mantiene todas sus paradas y transbordos, incluso al añadir líneas después de usar «Solo». «Paradas en el mapa» controla únicamente los puntos del mapa. Los diagramas se cargan al entrar en pantalla.
- Fichas de estación con líneas y destinos, logotipos agrupados una vez en el encabezado, dos llegadas por sentido y cuenta atrás en segundos. Fichas de vehículos con próxima parada, destino e identificador del viaje. Cerrar la ficha recupera la cámara, selección y desplazamiento previos.
- Fichas navegables: los distintivos de línea abren el recorrido completo, sus paradas abren las llegadas y cada servicio de horario abre su ficha y localización estimada cuando circula. «Volver» recorre las fichas consultadas. «Copiar enlace» comparte una parada, línea o servicio mediante identificadores publicados; los enlaces de servicio incluyen la fecha, hora y salida concreta para distinguir frecuencias y viajes después de medianoche. El número real del autobús solo se muestra si iBus lo facilita; no se asocia un vehículo real a una estimación GTFS por coincidencia de línea. Si no hay posición publicada, se indica.
- Cierres sin fondo ni borde: la X permanece visible al desplazar fichas, Fuentes y Acerca de. La cuenta atrás actualiza los segundos conservando los enlaces y el foco del teclado.
- Tema Automático por defecto, calculado con la fecha real, la ubicación y las horas de salida, mediodía y puesta del sol. Sin geolocalización utiliza la ciudad seleccionada. Mañana, Tarde y Noche mantienen la elección manual. Nueve temas urbanos siguen la ciudad al cargarla, permiten otra elección manual y agrupan los consorcios andaluces en Andalucía; Sevilla mantiene TUSSAM. [Paletas y funcionamiento](docs/appearance-research.md). Símbolos oficiales y colores de línea GTFS: [procedencia](docs/operator-identities.json).
- Reloj, fecha y velocidad dentro del menú lateral; contadores de movimientos y estado FGC en Filtros. El mapa queda despejado. Los viajes calculados muestran un aviso con cierre: elimina el resalte y restaura la vista anterior. Los detalles del viaje y la selección de origen/destino se conservan al consultar el reloj. El punto azul de ubicación aparece al obtener permiso y se mantiene al cambiar de estilo o red.
- Rueda/pellizco para zoom; giro con botón derecho o dos dedos. Doble clic derecho restablece norte y vista plana. Vista general y 3D en el lateral.
- Selección de red por geolocalización si no hay ciudad explícita en la URL. Requiere permiso del navegador; coordenadas procesadas localmente. Si no hay una red urbana cercana, se abre Renfe. «Paradas cerca de mí» está en Explorar.
- Acerca de: favicon original, nombre configurable, versión de package.json, autor, portfolio y repositorio.
- Búsqueda, salidas por parada, accesibilidad publicada, accesos y favoritos locales.
- Panel lateral del reloj con pausa, control deslizante, fecha y velocidades 1×, 10× y 60×.
- Planificación entre paradas y alcance en 15, 30 y 45 minutos. Horizonte de tres horas en ciudades y 24 horas en Renfe.
- Historias documentadas de Barcelona, Madrid, Sevilla y Zaragoza; tres recorridos editoriales en Barcelona.
- Selector de ciudad y catálogo de cobertura y fuentes.

## GPS, horarios y límites

En Barcelona, los **puntos azules** son coordenadas del [visor oficial Geotren FGC](https://geotren.fgc.cat/). Se consultan cada cuatro segundos y se ocultan tras 20 segundos sin una respuesta válida. La ficha muestra un nombre legible, destino, serie, puntualidad y ocupación cuando existe; los identificadores opacos quedan en un apartado desplegable. La hora indicada es la de consulta: Geotren no facilita una hora individual de medición de posición.

El mapa y la vista lineal utilizan las mismas posiciones publicadas. EMT Málaga añade números físicos de autobús y coordenadas del portal municipal, sin interpolar; el diagrama exige un trazado inequívoco. Los paneles oficiales de salidas FGC se consultan cada ocho segundos en las estaciones disponibles. Renfe necesita el servidor para acceder a coordenadas de Cercanías y larga distancia. iBus y AMB utilizan previsiones oficiales de llegada, no una interpolación GTFS; AMB no publica posiciones GPS en ese servicio. Se descartan respuestas caducadas y viajes cancelados. Sin conexión o sin cobertura en directo no aparecen vehículos inventados ni cuenta atrás por horario.

La **consulta de horarios** muestra salidas previstas, con una etiqueta diferenciada, sin mover vehículos en el mapa ni en el diagrama. Al abrir otra ciudad se vuelve al directo. Los enlaces antiguos de servicios del horario abren su línea cuando no existe una posición publicada; no rebobinan el mapa. **Actualizar un contador cada segundo no aumenta la precisión de la previsión del operador**. El catálogo público TMB consultado no incluye una API de tiempos de metro; sería necesario confirmar acceso específico con TMB. [Detalle y activación del servidor](docs/directo.md).

EMT publica itinerarios completos en `stop_times` y ventanas de frecuencia asociadas a esos mismos viajes. Su adaptador conserva las horas individuales y evita expandir repetidamente ventanas, que multiplicarían artificialmente los vehículos. La política específica figura en `tools/providers.json` y los metadatos.

La planificación local no incorpora incidencias ni ascensores fuera de servicio. Los horarios estáticos no incorporan cancelaciones; el adaptador AMB sí respeta las cancelaciones de su publicación en directo. Los enlaces peatonales entre paradas próximas se calculan de forma aproximada y no se dibujan como trazados. Los tramos de transporte de los viajes utilizan la geometría del viaje elegido, recortada entre embarque y desembarque; el mismo recorrido sirve para animar vehículos. Se respetan los transbordos prohibidos y restricciones de embarque/desembarque. El filtro accesible exige `wheelchair_boarding=1`; no garantiza todo el itinerario. El alcance muestra puntos por horario, no una isócrona peatonal.

## Geometrías y revisión

`tools/geometry.py` recupera trazados ausentes y guarda la procedencia individual en `shapeInfo`:

- TMB, FGC, TRAM, Euskotren, Metro Bilbao, Madrid, Consorcios y Zaragoza: geometría GTFS del operador.
- TUSSAM: [recorridos municipales del Ayuntamiento de Sevilla](https://www.arcgis.com/home/item.html?id=c5e6ecf63aa944c8a09eb1e65e72d8f4), asociados a línea y secuencia de paradas. Se rechazan emparejamientos a más de 120 m.
- Metro de Sevilla: [relación OSM 255088](https://www.openstreetmap.org/relation/255088), ensamblada sin unir piezas desconectadas. ODbL.
- Renfe sin shapes: grafo de [enlaces ferroviarios IGN / INSPIRE](https://api-features.idee.es/collections/railwaylink?f=html). Pasa por las estaciones publicadas, con preferencia por vías de 1435 mm en AVE/Avlo y reparación de precisión de extremos inferior a un metro. Las curvas se simplifican con tolerancia de 8 m.

**Los corredores reconstruidos de Renfe son inferidos sobre infraestructura real; no son confirmaciones del itinerario exacto de un servicio.** El GTFS no aporta esa información. No se enlazan componentes ferroviarios desconectados. En esta revisión se recuperaron 839 de 984 shapes ausentes de larga/media distancia y cuatro de Cercanías; 145 siguen sin recorrido verificable, incluyendo servicios internacionales y casos de infraestructura o estaciones que no encajan. Se omiten sus líneas y vehículos. TUSSAM recupera 225 shapes y Metro de Sevilla cuatro.

La geometría proyecta las paradas sobre segmentos del trazado para presentar recorridos y planificar viajes. El mapa conserva exclusivamente coordenadas publicadas; la proyección del GPS en el diagrama requiere un trazado compatible (150 m en bus, 550 m sobre raíles). Se dibujan también variantes de trazado utilizadas por los viajes. En redes de bus con un único color oficial, una paleta estable distingue líneas; el color original se conserva en `sourceColor`.

`python tools/audit_geometry.py` revisa todas las referencias y geometrías y publica [el informe](public/data/geometry-audit.json). Los tests verifican curvas, proyección, itinerarios compartidos, rechazo de geometrías ausentes o desconectadas y el corredor AVE Barcelona–Madrid, de unos 671 km. Una auditoría estructural no confirma cierres de calles, cambios de vía o incidencias en tiempo real.

Si falla una fuente de geometría, se recupera el último trazado publicado **solo cuando coinciden exactamente operador, ruta y secuencia de paradas**. La cartografía se cachea por mes en Actions; las credenciales nunca se guardan en estos ficheros.

## Claves TMB

La descarga oficial GTFS con los secretos de GitHub se ha comprobado en Actions. **GitHub Pages es estático:** `TMB_APP_ID` y `TMB_APP_KEY` renuevan los horarios durante la compilación. Para Transit, iBus y Planner en directo hay que alojar el servidor incluido con las claves. El catálogo completo está en [docs/api-catalog.json](docs/api-catalog.json).

1. Copia `.env.example` a `.env` en el servidor y rellena las claves.
2. Ejecuta `pnpm build` y `pnpm start`. Abre `http://127.0.0.1:8787`.
3. En desarrollo inicia también `pnpm dev`; Vite conecta con ese servidor.
4. Para Pages, aloja el servidor en HTTPS, configura `HOST=0.0.0.0` y `ALLOWED_ORIGINS=https://alejandropico.github.io`, y añade su URL en «Fuentes → Servidor TMB para datos en directo».

Las claves permanecen en el servidor. Se limitan consultas y recursos y se cachean respuestas. iBus solo se consulta en paradas TMB y con respuestas recientes. AMB proporciona previsiones GTFS-RT de bus/Nitbus sin claves adicionales; no proporciona posiciones GPS. El planificador oficial se utiliza entre paradas TMB; el cálculo local es la alternativa. Estas APIs autenticadas en directo no se han podido verificar con las claves de GitHub, que no son legibles después de guardarlas.

## Desarrollo y actualización

Node.js 22+, pnpm 10.17.1; Python 3.12+ para renovar fuentes. Los datos están incluidos.

```sh
pnpm install
pnpm dev
pnpm test
python -m unittest discover -s tests -p 'test_*.py'
pnpm build
pnpm preview
```

`python tools/import_networks.py` renueva todas las vistas; `--city madrid` solo una; `--local` normaliza ZIP de caché. Python usa la biblioteca estándar. Cachés y credenciales están excluidas de Git.

Actions renueva, valida, compila y publica con cada subida a `main`, cada día a las 04:23 UTC y manualmente. Si una ciudad falla conserva su copia publicada. No genera commits automáticos. Descargar hoy un archivo no garantiza que su calendario esté vigente: se muestran sus fechas reales.

La incorporación de TRAM incluye la T4 hasta Verdaguer, Sicília y Monumental. Euskadi añade las redes publicadas, no toda la cobertura de autobuses urbanos. Metro Bilbao agrupa L1/L2 en una ruta GTFS del operador: no se inventan números de línea ausentes. [Investigación de redes y APIs](docs/network-research.md).

## Expandir la cobertura

[tools/providers.json](tools/providers.json) separa operadores y vistas. Añade una fuente GTFS con ID, URL, web, licencia y caché; después una vista con fuentes, centro, zoom y descripción de cobertura. El importador normaliza tipos estándar y extendidos y aísla los IDs por operador. Las APIs en directo se incorporan como adaptadores independientes, con procedencia y control de antigüedad.

El [Punto de Acceso Nacional](https://nap.transportes.gob.es/) reúne GTFS, GTFS-RT y NeTEx; sus descargas autenticadas requieren credenciales propias. Los operadores tienen distintos formatos y requisitos: no hay una única API universal. Las consultas de llegadas probadas de la API municipal de Zaragoza devolvieron errores del proveedor; no se muestran como datos en directo operativos.

## Atribuciones

- [TMB](https://developer.tmb.cat/) y [condiciones](https://developer.tmb.cat/docs/terms-conditions).
- [TRAM Open Data](https://opendata.tram.cat/), [Open Data Euskadi](https://opendata.euskadi.eus/) y [Euskotren](https://www.euskotren.eus/).
- [FGC](https://dadesobertes.fgc.cat/), [CRTM](https://datos.crtm.es/) y [EMT](https://datos.emtmadrid.es/).
- [Consorcios de Andalucía](https://api.ctan.es/), [TUSSAM](https://www.tussam.es/) y [Metro de Sevilla](https://www.metro-sevilla.es/).
- [Zaragoza](https://www.zaragoza.es/web/espacio-de-datos/servicio/catalogo/335), [Tranvía de Zaragoza](https://www.tranviasdezaragoza.es/) y [Renfe](https://data.renfe.com/).
- Powered by [MIMTRANS](https://www.transportes.gob.es/). Archivos públicos conservados por [Mobility Database](https://mobilitydatabase.org/).
- © [Instituto Geográfico Nacional](https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf): infraestructura ferroviaria transformada en corredores inferidos. Ayuntamiento de Sevilla: recorridos TUSSAM.
- Cartografía © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), OpenMapTiles y OpenFreeMap. MapLibre, iconos Lucide, fuentes DM Sans y Manrope.

La cartografía, fuentes y APIs requieren conexión. Proyecto independiente de los operadores.

## Revisión de fuentes nacionales

EMT, CRTM, Sevilla y Euskadi ya se utilizan. La revisión de los portales propuestos, NAP, posibilidades de tiempo real y requisitos de acceso está en [docs/data-portals-review.md](docs/data-portals-review.md).

## Revisión Renfe y seguimiento · 1.5

Al seleccionar un vehículo, la cámara sigue su posición conservando el zoom y la orientación. «Seguimiento activo · pausar» libera la cámara y «Centrar y seguir» la centra y reactiva el seguimiento; cerrar la ficha restaura la vista anterior.

Cercanías se agrupa por núcleo y línea comercial, conservando las variantes y los IDs originales como alias. R3 se representa en dos sentidos mediante la unión de tramos compatibles, sin convertirlos en un nuevo servicio. Cada viaje mantiene sus estaciones y trazado. Los transbordos no repiten la propia línea; los productos de larga distancia agrupan sus corredores en un desplegable.

Se priorizan trazados completos del operador. La reconstrucción del IGN descarta bucles y desvíos incoherentes; la animación suprime intervalos con velocidades incompatibles con el horario. Se conservan las paradas y tiempos aunque una variante no pueda dibujarse. El informe `public/data/renfe-audit.json` revisa todos los patrones y documenta las incoherencias detectadas. [Método, fuentes y límites](docs/renfe-review.md).

El servidor consulta posiciones oficiales de Cercanías y del visor de larga distancia cada 20 segundos, sin claves Renfe ni TMB. `pnpm build` y `pnpm start` permiten probarlo localmente en el puerto 8787; para GitHub Pages hay que alojarlo y conectarlo en Fuentes. La API oficial bloquea consultas directas desde Pages. Se unen únicamente IDs GTFS exactos y se ocultan mediciones de más de 90 segundos. Las llegadas siguen siendo horarios, no tiempos corregidos por retrasos. AVE y otros servicios de larga distancia se vinculan exclusivamente por su número comercial GTFS publicado (`trip_short_name`), terminales y una única instancia de calendario. Las coincidencias ausentes o ambiguas se omiten; los servicios sin posición publicada no se dibujan como vehículos.

## Paradas y exploración · 1.6

Los vehículos estimados respetan las esperas publicadas entre llegada y salida. Cuando ambas horas coinciden, la animación introduce una pausa visual en las paradas intermedias: hasta 18 s en bus, 25 s en metro, 20 s en tranvía y 40 s en tren. Se limita al 25 % del intervalo siguiente y al margen disponible sin superar la velocidad admitida. No se añaden esperas en puntos sin subida ni bajada, ni se prolonga el servicio en los terminales. Los horarios, las llegadas y el planificador conservan los datos originales. La ficha distingue «espera del horario» y «pausa simulada», muestra la parada actual y cuenta hasta la salida. Mapa y vista lineal usan el mismo movimiento. Las posiciones publicadas por los operadores se mantienen intactas y no reciben pausas inventadas. [Campos de horarios y servicio de pasajeros de GTFS](https://gtfs.org/documentation/schedule/reference/#stop_timestxt).

En la ficha de una línea, pasar el puntero por una estación (o enfocarla con el teclado) muestra un punto azul y su nombre en el mapa. Al salir, cambiar de sentido o cerrar la ficha se elimina ese resaltado sin mover la cámara ni cambiar la selección.
