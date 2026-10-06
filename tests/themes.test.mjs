import { test } from "node:test";
import assert from "node:assert/strict";
import { getTimes } from "suncalc";
import { solarTheme } from "../src/solar-theme.js";
import { cityThemes, andalusianCities } from "../src/city-themes.js";
import {
  resolveTheme,
  themeOnCityLoad,
  displayedTheme,
} from "../src/themes.js";

test("all former consortium palettes migrate to one Andalucía theme", () => {
  for (const city of andalusianCities) {
    assert.equal(resolveTheme(city), "andalucia");
    assert.equal(themeOnCityLoad("madrid", city), "andalucia");
    assert.ok(!cityThemes[city]);
  }
  assert.equal(themeOnCityLoad("andalucia", "sevilla"), "sevilla");
});
test("urban appearance follows newly loaded cities but manual overrides are allowed", () => {
  assert.equal(themeOnCityLoad("barcelona", "madrid"), "madrid");
  assert.equal(themeOnCityLoad("sevilla", "espana"), "espana");
  assert.equal(themeOnCityLoad("espana", "cadiz"), "andalucia");
  assert.equal(resolveTheme("andalucia", "madrid"), "andalucia");
  assert.equal(resolveTheme("sevilla", "madrid"), "sevilla");
  for (const id of ["auto", "morning", "afternoon", "night"])
    for (const city of ["madrid", "barcelona", "cadiz", "espana"])
      assert.equal(themeOnCityLoad(id, city), id);
});
const barcelona = { lat: 41.391, lon: 2.165 };
test("automatic appearance follows sunrise, solar noon and sunset", () => {
  const day = new Date("2026-10-06T12:00:00Z");
  const { sunrise, solarNoon, sunset } = getTimes(
    day,
    barcelona.lat,
    barcelona.lon,
  );
  const phase = (instant) => solarTheme(new Date(instant), barcelona);
  assert.equal(phase(+sunrise - 1000), "night");
  assert.equal(phase(+sunrise + 1000), "morning");
  assert.equal(phase(+solarNoon - 1000), "morning");
  assert.equal(phase(+solarNoon + 1000), "afternoon");
  assert.equal(phase(+sunset - 1000), "afternoon");
  assert.equal(phase(+sunset + 1000), "night");
});
test("the same clock time has different sunlight in summer and winter", () => {
  assert.equal(
    solarTheme(new Date("2026-06-21T17:00:00Z"), barcelona),
    "afternoon",
  );
  assert.equal(
    solarTheme(new Date("2026-12-21T17:00:00Z"), barcelona),
    "night",
  );
});
test("automatic appearance uses location rather than a national fixed schedule", () => {
  const date = new Date("2026-12-21T16:40:00Z");
  assert.equal(solarTheme(date, barcelona), "night");
  assert.equal(solarTheme(date, { lat: 42.24, lon: -8.72 }), "afternoon");
  for (const manual of ["morning", "afternoon", "night", "madrid"])
    assert.equal(displayedTheme(manual, barcelona, date), manual);
});
test("polar locations with no sunrise or sunset still have usable automatic themes", () => {
  const north = { lat: 78.2, lon: 15.6 };
  assert.equal(solarTheme(new Date("2026-12-21T12:00:00Z"), north), "night");
  assert.match(
    solarTheme(new Date("2026-06-21T12:00:00Z"), north),
    /morning|afternoon/,
  );
});
