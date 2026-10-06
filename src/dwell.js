// Visual pauses never change GTFS arrival/departure data or journey planning.
export function motionSpeedLimit(route) {
  if (route.feed === "cercanias") return 200;
  if (route.feed === "renfe")
    return /AVE|AVLO|AVANT|ALVIA|EUROMED|INTERCITY/i.test(route.name)
      ? 360
      : 220;
  return (
    { bus: 90, metro: 100, tram: 80, rail: 200, ferry: 70, funicular: 40 }[
      route.mode
    ] || 90
  );
}

export function stationTiming(pattern, positions, route) {
  const departures = [...pattern[2]],
    sources = departures.map((t, i) => (t > pattern[1][i] ? "schedule" : null));
  const desired =
    { bus: 18, metro: 25, tram: 20, rail: 40, ferry: 45, funicular: 20 }[
      route.mode
    ] || 18;
  for (let i = 1; i < departures.length - 1; i++) {
    if (sources[i] || (pattern[3]?.[i] === 1 && pattern[4]?.[i] === 1))
      continue;
    const gap = pattern[1][i + 1] - departures[i];
    const travel =
      (Math.max(0, positions[i + 1] - positions[i]) * 3.6) /
      motionSpeedLimit(route);
    // Keep every published arrival. Never insert a pause that forces excess speed.
    const pause = Math.floor(Math.min(desired, gap / 4, gap - travel));
    if (pause < 3) continue;
    departures[i] += pause;
    sources[i] = "simulated";
  }
  return { departures, sources };
}

export function motionState(pattern, timing, local) {
  let segment = 0;
  while (segment < pattern[0].length - 1 && local >= pattern[1][segment + 1])
    segment++;
  const next = Math.min(segment + 1, pattern[0].length - 1);
  const departure = timing.departures[segment],
    arrival = pattern[1][next];
  const stopped = local >= pattern[1][segment] && local < departure;
  const fraction =
    local <= departure
      ? 0
      : Math.min(1, (local - departure) / Math.max(1, arrival - departure));
  return {
    segment,
    next,
    fraction,
    stopped,
    departure,
    dwellSource: stopped ? timing.sources[segment] : null,
  };
}
