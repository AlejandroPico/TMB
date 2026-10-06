# EnRuta

Transporte público de España: mapa en 3D, horarios, viajes e historias con fuentes. **[Abrir la aplicación](https://alejandropico.github.io/TMB/)**.

## Nombre y favicon

Edita `name` en **[app.config.json](app.config.json)**. Alimenta la marca, el título y los textos de la aplicación. También contiene la descripción y la ciudad inicial. El nombre no depende del nombre del repositorio.

También puedes cambiarlo en GitHub → Settings → Secrets and variables → Actions → **Variables** → New repository variable: nombre `APP_NAME`, valor el nuevo nombre. Ejecuta Actions para publicarlo. Esa variable tiene prioridad sobre el fichero. Es información pública, no un secreto.

**[favicon.svg](favicon.svg)** está en la raíz de `main`. Es el único original: la compilación lo utiliza como icono del navegador y lo publica además como `/TMB/favicon.svg`.

## Cobertura inicial

| Vista          | Operadores                                            |
| -------------- | ----------------------------------------------------- |
| Barcelona      | TMB y FGC, incluidas sus líneas regionales publicadas |
| Madrid         | Metro, EMT y Metro Ligero                             |
| Sevilla        | TUSSAM, Metro y Consorcio del Área de Sevilla         |
| Zaragoza       | Avanza urbana y tranvía                               |
| España · Renfe | AVE, Larga y Media Distancia, Cercanías y Rodalies    |

Cinco vistas y 12 fuentes dentro de una misma aplicación. No cubre todavía todos los operadores de España. Cercanías se explora en la vista nacional; no se planifican enlaces entre vistas. Las líneas GTFS pueden representar variantes de un servicio, no números comerciales únicos. Los datos se cargan al seleccionar cada vista. Puedes compartirla con `?city=madrid`, `sevilla`, `zaragoza`, `barcelona` o `espana`.

**El calendario público consultado de Metro de Madrid termina el 27 de mayo de 2026, y el de Avanza Zaragoza el 5 de octubre de 2026.** Se conservan sus redes y horarios archivados con un aviso visible. No se extienden las fechas. El resto de operadores tiene calendarios independientes. «Datos» muestra procedencia, licencia, versión, vigencia y SHA-256 por operador.

## Funciones

- Mapas con trazados, paradas y edificios 3D donde hay cartografía disponible; filtros de buses o transporte sobre raíles.
- Búsqueda, salidas por parada, accesibilidad publicada, accesos y favoritos locales.
- Calendario y reloj con pausa y reproducción a 1×, 10× y 60×.
- Planificación entre paradas y alcance en 15, 30 y 45 minutos. Horizonte de tres horas en ciudades y 24 horas en Renfe.
- Historias documentadas de Barcelona, Madrid, Sevilla y Zaragoza; tres recorridos editoriales en Barcelona.
- Selector de ciudad y catálogo de cobertura y fuentes.

## GPS, horarios y límites

En Barcelona, los **puntos azules** son coordenadas de la [API pública de FGC](https://dadesobertes.fgc.cat/explore/dataset/posicionament-dels-trens/). Al pulsarlos aparecen línea, serie del tren, códigos de destino, puntualidad publicada y ocupación cuando existe. La ocupación es la media de los coches con información, no una medición de todo el tren. Licencia CC BY 4.0.

Se consulta cada 30 segundos con el reloj en «Ahora», movimiento activado y página visible. Se ocultan publicaciones de más de tres minutos. La hora corresponde a la actualización del **conjunto** de FGC, no a la medición individual de cada tren. Al cambiar fecha, acelerar o pausar desaparece GPS. Con GPS vigente se omiten los vehículos estimados de FGC para evitar duplicaciones.

Los demás puntos son **interpolaciones por horario, no GPS**. Los recorridos sin geometría son esquemas entre estaciones, señalados en la ficha de línea. Las horas intermedias vacías se estiman; los servicios por frecuencia también. Se contemplan viajes del día anterior después de medianoche.

EMT publica itinerarios completos en `stop_times` y ventanas de frecuencia asociadas a esos mismos viajes. Su adaptador conserva las horas individuales y evita expandir repetidamente ventanas, que multiplicarían artificialmente los vehículos. La política específica figura en `tools/providers.json` y los metadatos.

No se incluyen incidencias, cancelaciones ni ascensores fuera de servicio. Los enlaces peatonales entre paradas próximas son aproximados y no siguen calles. Se respetan los transbordos prohibidos y restricciones de embarque/desembarque. El filtro accesible exige `wheelchair_boarding=1`; no garantiza todo el itinerario. El alcance muestra puntos por horario, no una isócrona peatonal.

## Claves TMB

La descarga oficial GTFS con los secretos de GitHub se ha comprobado en Actions. **GitHub Pages es estático:** `TMB_APP_ID` y `TMB_APP_KEY` renuevan los horarios durante la compilación. Para Transit, iBus y Planner en directo hay que alojar el servidor incluido con las claves. El catálogo completo está en [docs/api-catalog.json](docs/api-catalog.json).

1. Copia `.env.example` a `.env` en el servidor y rellena las claves.
2. Ejecuta `pnpm build` y `pnpm start`. Abre `http://127.0.0.1:8787`.
3. En desarrollo inicia también `pnpm dev`; Vite conecta con ese servidor.
4. Para Pages, aloja el servidor en HTTPS, configura `HOST=0.0.0.0` y `ALLOWED_ORIGINS=https://alejandropico.github.io`, y añade su URL en «Datos → Servidor TMB para datos en directo».

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

## Expandir la cobertura

[tools/providers.json](tools/providers.json) separa operadores y vistas. Añade una fuente GTFS con ID, URL, web, licencia y caché; después una vista con fuentes, centro, zoom y descripción de cobertura. El importador normaliza tipos estándar y extendidos y aísla los IDs por operador. Las APIs en directo se incorporan como adaptadores independientes, con procedencia y control de antigüedad.

El [Punto de Acceso Nacional](https://nap.transportes.gob.es/) reúne GTFS, GTFS-RT y NeTEx; sus descargas autenticadas requieren credenciales propias. Los operadores tienen distintos formatos y requisitos: no hay una única API universal. Las consultas de llegadas probadas de la API municipal de Zaragoza devolvieron errores del proveedor; no se muestran como datos en directo operativos.

## Atribuciones

- [TMB](https://developer.tmb.cat/) y [condiciones](https://developer.tmb.cat/docs/terms-conditions).
- [FGC](https://dadesobertes.fgc.cat/), [CRTM](https://datos.crtm.es/) y [EMT](https://datos.emtmadrid.es/).
- [Consorcios de Andalucía](https://api.ctan.es/), [TUSSAM](https://www.tussam.es/) y [Metro de Sevilla](https://www.metro-sevilla.es/).
- [Zaragoza](https://www.zaragoza.es/web/espacio-de-datos/servicio/catalogo/335), [Tranvía de Zaragoza](https://www.tranviasdezaragoza.es/) y [Renfe](https://data.renfe.com/).
- Powered by [MIMTRANS](https://www.transportes.gob.es/). Archivos públicos conservados por [Mobility Database](https://mobilitydatabase.org/).
- Cartografía © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), OpenMapTiles y OpenFreeMap. MapLibre, iconos Lucide, fuentes DM Sans y Manrope.

La cartografía, fuentes y APIs requieren conexión. Proyecto independiente de los operadores.
