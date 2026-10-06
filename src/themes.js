export const themes = {
  morning: {
    name: "Mañana",
    style: "positron",
    bg: "#f4f5f1",
    surface: "#ffffff",
    text: "#182520",
    muted: "#536259",
    border: "#cbd2c9",
    accent: "#276a56",
  },
  afternoon: {
    name: "Tarde",
    style: "liberty",
    bg: "#f5ecdf",
    surface: "#fff8ed",
    text: "#352b22",
    muted: "#75614e",
    border: "#d9c7ae",
    accent: "#9e4c25",
  },
  night: {
    name: "Noche",
    style: "dark",
    bg: "#101817",
    surface: "#16201d",
    text: "#e5e9df",
    muted: "#9ba9a1",
    border: "#34413b",
    accent: "#d7eaa1",
  },
  operator: {
    name: "Ciudad",
    style: "positron",
    bg: "#f5f5f5",
    surface: "#ffffff",
    text: "#20252b",
    muted: "#59636e",
    border: "#d6dadd",
    accent: "#d71920",
  },
};
// Operator references are listed in docs/operator-identities.json. This is an
// independent interface using their identifying colours, not an official service.
export const cityAccents = {
  barcelona: "#cc0018",
  madrid: "#005aa9",
  sevilla: "#cf202e",
  zaragoza: "#bf1727",
  cadiz: "#005e72",
  granada: "#007749",
  malaga: "#00704a",
  gibraltar: "#005f83",
  almeria: "#16783b",
  jaen: "#257640",
  cordoba: "#3f7652",
  huelva: "#126f54",
  espana: "#8b0053",
  bilbao: "#c34e04",
  donostia: "#005a8b",
  vitoria: "#347515",
};
export function applyTheme(id, city) {
  const theme = themes[id] || themes.night;
  document.documentElement.dataset.theme = id;
  document.documentElement.style.colorScheme =
    id === "night" ? "dark" : "light";
  document.documentElement.style.setProperty(
    "--ui-on-accent",
    id === "night" ? "#17201d" : "#fff",
  );
  for (const [name, value] of Object.entries({
    ...theme,
    accent: id === "operator" ? cityAccents[city] || "#005e72" : theme.accent,
  }))
    if (name !== "name" && name !== "style")
      document.documentElement.style.setProperty("--ui-" + name, value);
  return theme.style;
}
