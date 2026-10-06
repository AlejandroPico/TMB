# Paletas y símbolos — comprobación del 6 de octubre de 2026

Los nueve temas urbanos toman colores de las webs de los operadores, no una supuesta identidad municipal común a todas las empresas. Al cargar una ciudad, una selección urbana cambia al tema de esa red. Después se permite elegir cualquier otro tema urbano manualmente. Mañana, Tarde y Noche conservan la elección al cambiar de ciudad. La configuración está en [src/city-themes.js](../src/city-themes.js).

Cádiz, Granada, Málaga, Campo de Gibraltar, Almería, Jaén, Córdoba y Huelva comparten ahora una sola opción **Andalucía**, con la paleta verde y amarilla de los consorcios. Se agrupan las pequeñas variaciones de tonos de Granada y Málaga por decisión de diseño solicitada; Sevilla mantiene su tema diferenciado de TUSSAM. Las preferencias guardadas con los nombres antiguos se migran.

**Automático** es la opción inicial para nuevas preferencias. Calcula cada minuto Mañana desde la salida del sol, Tarde desde el mediodía solar y Noche desde la puesta del sol. Utiliza [SunCalc](https://github.com/mourner/suncalc) con la fecha y hora reales, independientemente de la fecha de reproducción del transporte. La ubicación, cuando se autoriza al navegador, se mantiene únicamente en memoria y el cálculo se realiza localmente. Si no está disponible se usa el centro de la red seleccionada y se indica en Temas. La interfaz muestra la fase actual y permite volver a solicitar ubicación. No utiliza un sensor de iluminación ni meteorología.

Referencias de las paletas antes de agruparlas:

| Tema                                                      | Referencia                                                 | Colores observados                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Barcelona                                                 | [TMB](https://www.tmb.cat/)                                | Rojo `#cc0018`, blanco y gris `#323232`                                                     |
| Madrid                                                    | [CRTM](https://www.crtm.es/tu-transporte-publico/metro/)   | Azul `#0066b3`, rojo `#e2001a` y blanco                                                     |
| Sevilla                                                   | [TUSSAM](https://www.tussam.es/)                           | Granate `#b40129`, amarillo `#f6a704` y blanco                                              |
| Zaragoza                                                  | [Avanza Zaragoza](https://zaragoza.avanzagrupo.com/)       | Rojo `#da291c`, violeta `#5f2167` y blanco                                                  |
| Bilbao                                                    | [Metro Bilbao](https://www.metrobilbao.eus/)               | Rojo anaranjado `#d93e14`, gris oscuro `#242324` y blanco                                   |
| Donostia                                                  | [Euskotren](https://www.euskotren.eus/)                    | Azul `#004494`, azul `#007fc0` y blanco                                                     |
| Vitoria-Gasteiz                                           | [Euskotren, tranvía](https://www.euskotren.eus/es/tranvia) | Verde `#58ab27`, verde `#009036` y blanco                                                   |
| Renfe                                                     | [Renfe](https://www.renfe.com/es/es)                       | Morado `#81005e`, rosa `#d62d61` y blanco                                                   |
| Cádiz, Campo de Gibraltar, Almería, Jaén, Córdoba, Huelva | Web de cada consorcio, enlazada en la configuración        | Comparten el verde `#007a35`, amarillo `#d7c500` y blanco; no se inventan paletas distintas |
| Granada                                                   | [Consorcio de Granada](https://ctagr.es/)                  | Verde `#007932`, amarillo claro `#f6ff95` y blanco                                          |
| Málaga                                                    | [Consorcio de Málaga](https://ctmam.es/)                   | Verde `#017a38`, verde claro `#65bc7b` y blanco                                             |

Los grises de superficies, bordes y texto son de EnRuta. El texto sobre el acento cambia entre claro y oscuro según contraste; por ejemplo, el verde claro de Vitoria lleva texto oscuro. Los colores de las líneas permanecen independientes del tema.

Los símbolos proceden de los recursos de [docs/operator-identities.json](operator-identities.json). El símbolo de Metro Madrid se obtiene de CRTM: el recurso SVG anterior de Metro devolvía una página HTML de bloqueo con HTTP 200. Se ha sustituido por el GIF auténtico publicado por CRTM. Las pruebas verifican los formatos de todos los recursos, y la ficha ofrece el nombre del operador si una imagen no carga.

En las fichas de estación cada operador aparece una vez en el encabezado. Los códigos de línea y las filas de llegada ya no repiten ese símbolo. Los transbordos del diagrama utilizan grupos de estación, andenes ferroviarios con el mismo nombre a menos de 350 metros y transferencias permitidas explícitamente por GTFS. La mera proximidad de una parada de autobús no implica correspondencia. No se anuncian conexiones ausentes del conjunto cargado.
