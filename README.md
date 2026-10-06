# EnRuta

Transporte público de España: mapa en 3D, horarios, viajes e historias con fuentes. **[Abrir la aplicación](https://alejandropico.github.io/TMB/)**.

## Nombre y favicon

Edita `name` en **[app.config.json](app.config.json)**. Alimenta la marca, el título y los textos de la aplicación. También contiene la descripción y la ciudad inicial. El nombre no depende del nombre del repositorio.

También puedes cambiarlo en GitHub → Settings → Secrets and variables → Actions → **Variables** → New repository variable: nombre `APP_NAME`, valor el nuevo nombre. Ejecuta Actions para publicarlo. Esa variable tiene prioridad sobre el fichero. Es información pública, no un secreto.

**[favicon.svg](favicon.svg)** está en la raíz de `main`. Es el único original: la compilación lo utiliza como icono del navegador y lo publica además como `/TMB/favicon.svg`.

## Cobertura

| Vista           | Operadores                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Barcelona       | TMB, FGC y TRAM (T1–T6), incluidas sus líneas regionales publicadas                                |
| Madrid          | Metro, EMT y Metro Ligero                                                                          |
| Sevilla         | TUSSAM, Metro y Consorcio del Área de Sevilla                                                      |
| Zaragoza        | Avanza urbana y tranvía                                                                            |
| Andalucía       | Consorcios de Bahía de Cádiz, Granada, Málaga, Campo de Gibraltar, Almería, Jaén, Córdoba y Huelva |
| Bilbao          | Metro Bilbao, Euskotren, tranvía y funicular de Larreineta                                         |
| Donostia        | Euskotren E1 y E2                                                                                  |
| Vitoria-Gasteiz | Tranvía Euskotren TG1 y TG2                                                                        |
| España · Renfe  | AVE, Larga y Media Distancia, Cercanías y Rodalies                                                 |

Dieciséis vistas: siete ciudades, ocho áreas adicionales de consorcios andaluces y la red nacional de Renfe. Las áreas adicionales muestran los servicios del consorcio, no todos los autobuses urbanos de cada ciudad. No cubre todavía todos los operadores de España. Cercanías se explora en la vista nacional; no se planifican enlaces entre vistas. Las líneas GTFS pueden representar variantes de un servicio, no números comerciales únicos. Los datos se cargan al seleccionar cada vista. Puedes compartirla con `?city=madrid`, `sevilla`, `zaragoza`, `barcelona` `bilbao`, `donostia`, `vitoria` o `espana`.

**El calendario público consultado de Metro de Madrid termina el 27 de mayo de 2026, y el de Avanza Zaragoza el 5 de octubre de 2026.** Se conservan sus redes y horarios archivados con un aviso visible. No se extienden las fechas. El resto de operadores tiene calendarios independientes. «Fuentes» muestra procedencia, licencia, versión, vigencia y SHA-256 por operador.

## Funciones

- Mapa a pantalla completa, menú lateral contraído y paneles que se despliegan a la derecha. En móvil, hamburguesa. Sin cabecera ni tarjetas promocionales. Paneles y botones con esquinas rectas.
- Filtros jerárquicos independientes de recorridos, paradas y vehículos: todos, tipo/operador y línea. Botón «Solo» para aislar una línea; estados parciales y reinicio. Historias y movimiento de autobuses apagados al iniciar.
- Vista lineal con líneas ordenadas, sentidos paralelos, ramales, paradas y vehículos estimados seleccionables. Una barra horizontal por línea, arrastre con ratón y desplazamiento táctil. Comparte filtros con el mapa y muestra transbordos bajo las paradas. Los diagramas se cargan al entrar en pantalla.
- Fichas de estación con líneas y destinos, logotipos agrupados una vez en el encabezado, dos llegadas por sentido y cuenta atrás en segundos. Fichas de vehículos con próxima parada, destino e identificador del viaje. Cerrar la ficha recupera la cámara, selección y desplazamiento previos.
- Temas Mañana, Tarde, Noche y 16 estilos de ciudad/red, guardados localmente y seleccionables con cualquier mapa. Colores comprobados en webs de operadores: [referencias](docs/appearance-research.md). Símbolos descargados de operadores y colores de línea GTFS: [procedencia](docs/operator-identities.json).
- Rueda/pellizco para zoom; giro con botón derecho o dos dedos. Doble clic derecho restablece norte y vista plana. Vista general y 3D en el lateral.
- Selección de red por geolocalización si no hay ciudad explícita en la URL. Requiere permiso del navegador; coordenadas procesadas localmente. Si no hay una red urbana cercana, se abre Renfe. «Paradas cerca de mí» está en Explorar.
- Acerca de: favicon original, nombre configurable, versión de package.json, autor, portfolio y repositorio.
- Búsqueda, salidas por parada, accesibilidad publicada, accesos y favoritos locales.
- Reloj compacto con pausa y control deslizante; fecha y velocidades 1×, 10× y 60× se despliegan al pulsar el reloj.
- Planificación entre paradas y alcance en 15, 30 y 45 minutos. Horizonte de tres horas en ciudades y 24 horas en Renfe.
- Historias documentadas de Barcelona, Madrid, Sevilla y Zaragoza; tres recorridos editoriales en Barcelona.
- Selector de ciudad y catálogo de cobertura y fuentes.

## GPS, horarios y límites

En Barcelona, los **puntos azules** son coordenadas de la [API pública de FGC](https://dadesobertes.fgc.cat/explore/dataset/posicionament-dels-trens/). Al pulsarlos aparecen línea, serie del tren, códigos de destino, puntualidad publicada y ocupación cuando existe. La ocupación es la media de los coches con información, no una medición de todo el tren. Licencia CC BY 4.0.

Se consulta cada 30 segundos con el reloj en «Ahora», movimiento activado y página visible. Se ocultan publicaciones de más de tres minutos. La hora corresponde a la actualización del **conjunto** de FGC, no a la medición individual de cada tren. Al cambiar fecha, acelerar o pausar desaparece GPS. Con GPS vigente se omiten los vehículos estimados de FGC para evitar duplicaciones.

La vista lineal usa siempre posiciones estimadas, también para FGC, y lo indica en su cabecera. El mapa conserva las posiciones publicadas de FGC cuando están vigentes.

Los contadores de metro, tren y tranvía proceden del horario GTFS: **actualizar un contador cada segundo no convierte la previsión en una llegada real**. La API TMB consultada no publica predicciones de metro. El adaptador iBus usa previsiones oficiales y antigüedad máxima de 90 segundos cuando se conecta el servidor. Campos como vía, serie o ocupación solo se muestran cuando el operador los facilita.

Los demás puntos son **interpolaciones por horario, no GPS**. Los recorridos sin geometría válida conservan horarios y paradas, pero no se dibujan ni se animan. No hay líneas rectas de sustitución. Las horas intermedias vacías se estiman; los servicios por frecuencia también. Se contemplan viajes del día anterior después de medianoche.

EMT publica itinerarios completos en `stop_times` y ventanas de frecuencia asociadas a esos mismos viajes. Su adaptador conserva las horas individuales y evita expandir repetidamente ventanas, que multiplicarían artificialmente los vehículos. La política específica figura en `tools/providers.json` y los metadatos.

No se incluyen incidencias, cancelaciones ni ascensores fuera de servicio. Los enlaces peatonales entre paradas próximas se calculan de forma aproximada y no se dibujan como trazados. Los tramos de transporte de los viajes utilizan la geometría del viaje elegido, recortada entre embarque y desembarque; el mismo recorrido sirve para animar vehículos. Se respetan los transbordos prohibidos y restricciones de embarque/desembarque. El filtro accesible exige `wheelchair_boarding=1`; no garantiza todo el itinerario. El alcance muestra puntos por horario, no una isócrona peatonal.

## Geometrías y revisión

`tools/geometry.py` recupera trazados ausentes y guarda la procedencia individual en `shapeInfo`:

- TMB, FGC, TRAM, Euskotren, Metro Bilbao, Madrid, Consorcios y Zaragoza: geometría GTFS del operador.
- TUSSAM: [recorridos municipales del Ayuntamiento de Sevilla](https://www.arcgis.com/home/item.html?id=c5e6ecf63aa944c8a09eb1e65e72d8f4), asociados a línea y secuencia de paradas. Se rechazan emparejamientos a más de 120 m.
- Metro de Sevilla: [relación OSM 255088](https://www.openstreetmap.org/relation/255088), ensamblada sin unir piezas desconectadas. ODbL.
- Renfe sin shapes: grafo de [enlaces ferroviarios IGN / INSPIRE](https://api-features.idee.es/collections/railwaylink?f=html). Pasa por las estaciones publicadas, con preferencia por vías de 1435 mm en AVE/Avlo y reparación de precisión de extremos inferior a un metro. Las curvas se simplifican con tolerancia de 8 m.

**Los corredores reconstruidos de Renfe son inferidos sobre infraestructura real; no son confirmaciones del itinerario exacto de un servicio.** El GTFS no aporta esa información. No se enlazan componentes ferroviarios desconectados. En esta revisión se recuperaron 839 de 984 shapes ausentes de larga/media distancia y cuatro de Cercanías; 145 siguen sin recorrido verificable, incluyendo servicios internacionales y casos de infraestructura o estaciones que no encajan. Se omiten sus líneas y vehículos. TUSSAM recupera 225 shapes y Metro de Sevilla cuatro.

La animación proyecta paradas sobre segmentos del trazado, conserva el avance y recorre sus vértices. Los vehículos no saltan de una parada a otra. Se omite una animación si sus paradas no encajan con el trazado (150 m en bus, 550 m sobre raíles). Se dibujan también variantes de trazado utilizadas por los viajes. En redes de bus con un único color oficial, una paleta estable distingue líneas; el color original se conserva en `sourceColor`.

`python tools/audit_geometry.py` revisa todas las referencias y geometrías y publica [el informe](public/data/geometry-audit.json). Los tests verifican curvas, proyección, itinerarios compartidos, rechazo de geometrías ausentes o desconectadas y el corredor AVE Barcelona–Madrid, de unos 671 km. Una auditoría estructural no confirma cierres de calles, cambios de vía o incidencias en tiempo real.

Si falla una fuente de geometría, se recupera el último trazado publicado **solo cuando coinciden exactamente operador, ruta y secuencia de paradas**. La cartografía se cachea por mes en Actions; las credenciales nunca se guardan en estos ficheros.

## Claves TMB

La descarga oficial GTFS con los secretos de GitHub se ha comprobado en Actions. **GitHub Pages es estático:** `TMB_APP_ID` y `TMB_APP_KEY` renuevan los horarios durante la compilación. Para Transit, iBus y Planner en directo hay que alojar el servidor incluido con las claves. El catálogo completo está en [docs/api-catalog.json](docs/api-catalog.json).

1. Copia `.env.example` a `.env` en el servidor y rellena las claves.
2. Ejecuta `pnpm build` y `pnpm start`. Abre `http://127.0.0.1:8787`.
3. En desarrollo inicia también `pnpm dev`; Vite conecta con ese servidor.
4. Para Pages, aloja el servidor en HTTPS, configura `HOST=0.0.0.0` y `ALLOWED_ORIGINS=https://alejandropico.github.io`, y añade su URL en «Fuentes → Servidor TMB para datos en directo».

Las claves permanecen en el servidor. Se limitan consultas y recursos y se cachean respuestas. iBus solo se consulta en paradas TMB y con respuestas recientes. El planificador oficial se utiliza entre paradas TMB; el cálculo local es la alternativa. Estas APIs autenticadas en directo no se han podido verificar con las claves de GitHub, que no son legibles después de guardarlas.

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

Actions renueva, valida, compila y publica con cada subida a `main`, los lunes a las 04:23 UTC y manualmente. Si una ciudad falla conserva su copia publicada. No genera commits automáticos. Descargar hoy un archivo no garantiza que su calendario esté vigente: se muestran sus fechas reales.

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
