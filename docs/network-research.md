# Redes adicionales — comprobación del 6 de octubre de 2026

## Incorporadas en 1.2.0

- TRAM Barcelona: Trambaix y Trambesòs, seis líneas. [Portal oficial](https://opendata.tram.cat/), paquetes TBX.zip y TBS.zip. La T4 contiene Verdaguer, Sicília, Monumental y Glòries. Se mantienen las variantes y afectaciones incluidas en el archivo, sin inventar extensiones a partir de un plano antiguo. El API de posiciones, previsiones y ocupación necesita credenciales OAuth propias de TRAM; las claves de TMB no lo habilitan. [Manual oficial](https://opendata.tram.cat/manual_en.pdf).
- Bilbao: Metro Bilbao y Euskotren (incluye L3, tren, tranvía y funicular). El paquete de Metro Bilbao agrupa L1/L2 bajo una ruta; no se inventan códigos de línea adicionales. [API oficial](https://www.metrobilbao.eus/es/open-data/dataset/api-guide).
- Donostia: E1 y E2 de Euskotren. La E1 recorre Bilbao–Donostia; es una línea interurbana.
- Vitoria-Gasteiz: tranvías de Euskotren.

Los tres últimos usan paquetes GTFS de [Moveuskadi, Gobierno Vasco](https://www.euskadi.eus/contenidos/ds_movilidad/md_ideeu_moveuskadi/es_def/index.shtml), con geometrías del operador y calendario vigente en la fecha de comprobación. Se filtran las líneas antes de normalizar para no presentar tranvías de otra ciudad como urbanos locales. No se incluyen todos sus autobuses ni todos los operadores.

## Tiempo real: límites comprobados

- TMB iBus: predicciones oficiales con marca temporal en milisegundos. El contador se actualiza cada segundo y vuelve a consultar a través del servidor cada 20 segundos. Caduca la previsión tras 90 segundos. GitHub Pages no ejecuta ese servidor ni puede mantener claves secretas en el navegador. Los secretos de Actions sirven para importar GTFS, no para responder a consultas en directo.
- Metro TMB: los tres API documentados en el portal (Transit, iBus y Planner) no incluyen un endpoint documentado de previsiones de metro. Por ello los paneles de metro se identifican como **horario estimado**; un reloj que descuenta segundos no convierte un horario en una medición real.
- FGC: posiciones y ocupación publicadas por su conjunto abierto, con control de antigüedad. La ficha permite inspeccionar todos los campos públicos del registro; no se deduce la vía ni una serie si no existe el dato.
- Moveuskadi publica GTFS-RT de Euskotren y Metro Bilbao. En las comprobaciones HTTP no incluyó `Access-Control-Allow-Origin`, incluso enviando el origen de GitHub Pages. Se requiere un servidor intermedio para consumirlo en la aplicación web. No se etiqueta el movimiento GTFS de estas redes como GPS.
- La vista lineal representa viajes del horario, no convoyes físicos identificados por número de turno. Los viajes sin trazado válido se excluyen también de esa vista.

## Otras redes investigadas, todavía sin incorporar

- Valencia: el [catálogo municipal FGV Estaciones](https://opendata.vlci.valencia.es/dataset/fgv-estacions-estaciones) publica estaciones, líneas y enlaces de próximas llegadas. Se necesita validar un paquete completo de horarios, geometrías y permisos de consulta antes de integrarlo.
- Málaga: existe [licencia oficial de datos abiertos de Metro Málaga](https://metromalaga.es/GTFS/ACCESO%20A%20DATOS%20P%C3%9ABLICOS%20DE%20METRO%20M%C3%81LAGA%20LICENCIA%20Y%20CONDICIONES%20DE%20USO.pdf). La vista actual del consorcio no equivale a cubrir el metro.
- Tenerife: el operador remite al portal [Datos Tenerife](https://www.datostenerife.es/) en su [comunicación oficial de transparencia](https://metrotenerife.com/wp-content/uploads/2023/04/20230418-transparencia.pdf). No se ha validado todavía una integración de horarios y vías.

La lista es una investigación de fuentes, no una promesa de cobertura completa. La aplicación solo ofrece como seleccionables redes que ya tienen datos importados.
