import { cityThemes, accentText } from "./city-themes.js";
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
  ...cityThemes,
};
export const resolveTheme = (id, city = "barcelona") =>
  id === "operator"
    ? cityThemes[city]
      ? city
      : "barcelona"
    : themes[id]
      ? id
      : "night";
export function applyTheme(id, city) {
  id = resolveTheme(id, city);
  const theme = themes[id];
  document.documentElement.dataset.theme = id;
  document.documentElement.style.colorScheme =
    id === "night" ? "dark" : "light";
  document.documentElement.style.setProperty(
    "--ui-on-accent",
    accentText(theme.accent),
  );
  for (const name of ["bg", "surface", "text", "muted", "border", "accent"])
    document.documentElement.style.setProperty("--ui-" + name, theme[name]);
  document.documentElement.style.setProperty(
    "--ui-secondary",
    theme.secondary || theme.accent,
  );
  return theme.style;
}
