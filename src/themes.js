import {
  cityThemes,
  accentText,
  andalusianCities,
  urbanThemeForCity,
} from "./city-themes.js";
import { solarTheme } from "./solar-theme.js";
const lightThemes = {
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
};
export const themes = {
  auto: { ...lightThemes.morning, name: "Automático" },
  ...lightThemes,
  ...cityThemes,
};
export const resolveTheme = (id, city = "barcelona") =>
  id === "operator"
    ? urbanThemeForCity(city)
    : andalusianCities.has(id)
      ? "andalucia"
      : themes[id]
        ? id
        : "auto";
export function themeOnCityLoad(id, city) {
  const normalized = resolveTheme(id, city);
  return cityThemes[normalized] ? urbanThemeForCity(city) : normalized;
}
export function displayedTheme(id, position, date = new Date()) {
  return id === "auto" ? solarTheme(date, position) : id;
}
export function applyTheme(id, city, position = { lat: 41.391, lon: 2.165 }) {
  id = resolveTheme(id, city);
  const effective = displayedTheme(id, position);
  const theme = themes[effective];
  document.documentElement.dataset.theme = id;
  document.documentElement.dataset.light = effective;
  document.documentElement.style.colorScheme =
    effective === "night" ? "dark" : "light";
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
