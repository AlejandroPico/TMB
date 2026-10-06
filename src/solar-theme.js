import { getTimes, getPosition } from "suncalc";

// Absolute instants avoid device time zone / daylight saving assumptions.
// The real clock drives appearance, independently of the transport replay clock.
export function solarTheme(date, { lat, lon }) {
  const times = getTimes(date, lat, lon);
  const daylight =
    times.alwaysUp ||
    (times.sunrise &&
      times.sunset &&
      date >= times.sunrise &&
      date < times.sunset);
  if (!daylight) return "night";
  if (times.alwaysUp) {
    const rising =
      getPosition(new Date(+date + 60000), lat, lon).altitude >
      getPosition(date, lat, lon).altitude;
    return rising ? "morning" : "afternoon";
  }
  return date < times.solarNoon ? "morning" : "afternoon";
}
