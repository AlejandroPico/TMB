// Colours observed on the operators' own websites, checked 6 October 2026.
// These are references for EnRuta's interface, not official city design systems.
const references = {
  barcelona: [
    "Barcelona",
    "TMB",
    "#cc0018",
    "#323232",
    "https://www.tmb.cat/",
    "https://static-web.tmb.cat/o/tmb-theme/css/main.css",
  ],
  madrid: [
    "Madrid",
    "CRTM",
    "#0066b3",
    "#e2001a",
    "https://www.crtm.es/tu-transporte-publico/metro/",
    "https://www.crtm.es/css/impresora.min.css?v=1000",
  ],
  sevilla: [
    "Sevilla",
    "TUSSAM",
    "#b40129",
    "#f6a704",
    "https://www.tussam.es/",
    "https://www.tussam.es/themes/icemagic/css/personalizado.css",
  ],
  zaragoza: [
    "Zaragoza",
    "Avanza Zaragoza",
    "#da291c",
    "#5f2167",
    "https://zaragoza.avanzagrupo.com/",
    "https://zaragoza.avanzagrupo.com/wp-content/themes/avanza-zaragoza/style.css",
  ],
  bilbao: [
    "Bilbao",
    "Metro Bilbao",
    "#d93e14",
    "#242324",
    "https://www.metrobilbao.eus/",
    "https://www.metrobilbao.eus/_next/static/css/02bb03ce0c88c0f3.css",
  ],
  donostia: [
    "Donostia",
    "Euskotren",
    "#004494",
    "#007fc0",
    "https://www.euskotren.eus/",
    "https://www.euskotren.eus/themes/custom/euskotren/css/style.css",
  ],
  vitoria: [
    "Vitoria-Gasteiz",
    "Euskotren · tranvía",
    "#58ab27",
    "#009036",
    "https://www.euskotren.eus/es/tranvia",
    "https://www.euskotren.eus/themes/custom/euskotren/css/style.css",
  ],
  espana: [
    "Renfe",
    "Renfe",
    "#81005e",
    "#d62d61",
    "https://www.renfe.com/es/es",
    "https://www.renfe.com/etc.clientlibs/renfe/clientlibs/clientlib-renfewebcomponents/resources/renfe-web-components-1761738998422.css",
  ],
  andalucia: [
    "Andalucía",
    "Consorcios de transporte",
    "#007a35",
    "#d7c500",
    "https://www.cmtbc.es/",
    "https://www.cmtbc.es/css/custom.css",
  ],
};
export const andalusianCities = new Set([
  "cadiz",
  "granada",
  "malaga",
  "gibraltar",
  "almeria",
  "jaen",
  "cordoba",
  "huelva",
]);
export const urbanThemeForCity = (city) =>
  andalusianCities.has(city)
    ? "andalucia"
    : references[city]
      ? city
      : "barcelona";
export const cityThemes = Object.fromEntries(
  Object.entries(references).map(
    ([id, [name, reference, accent, secondary, source, evidence]]) => [
      id,
      {
        name,
        reference,
        accent,
        secondary,
        source,
        evidence,
        family: "city",
        style: "positron",
        bg: "#f3f4f6",
        surface: "#ffffff",
        text: "#20252b",
        muted: "#59636e",
        border: "#d6dadd",
      },
    ],
  ),
);
export function accentText(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((c) => parseInt(c, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const light = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return 1.05 / (light + 0.05) >= 4.5 ? "#ffffff" : "#17201d";
}
