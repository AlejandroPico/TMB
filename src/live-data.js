// Timetables never create map or diagram vehicles, even during a timetable query.
export function displayVehicles(mode, published, now = Date.now()) {
  if (mode !== "live") return [];
  return published.filter((f) => {
    const p = f.properties;
    const age = now - p.measured;
    const coordinates = f.geometry?.coordinates;
    return (
      p.actual &&
      f.geometry?.type === "Point" &&
      Array.isArray(coordinates) &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1]) &&
      Math.abs(coordinates[0]) <= 180 &&
      Math.abs(coordinates[1]) <= 90 &&
      Number.isFinite(age) &&
      age >= -30000 &&
      age <= (p.maxAge || 90000)
    );
  });
}

export function epochMilliseconds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 1000000000
    ? n < 100000000000
      ? n * 1000
      : n
    : NaN;
}

export function ibusSnapshot(data, now = Date.now()) {
  const timestamp = epochMilliseconds(data.timestamp);
  if (
    !Number.isFinite(timestamp) ||
    now - timestamp > 90000 ||
    timestamp - now > 30000
  )
    throw new Error("La previsión iBus no está actualizada.");
  const arrivals = (data.parades || [])
    .flatMap((p) =>
      (p.linies_trajectes || []).flatMap((l) =>
        (l.propers_busos || []).flatMap((b) => {
          const time = epochMilliseconds(b.temps_arribada);
          if (!Number.isFinite(time) || time < now - 30000) return [];
          return [
            {
              name: String(l.nom_linia),
              destination: l.desti_trajecte || "",
              time,
              vehicle: b.id_bus,
              feed: l.transit_namespace === "amb" ? "amb" : "tmb",
            },
          ];
        }),
      ),
    )
    .sort((a, b) => a.time - b.time);
  return { timestamp, arrivals };
}

export function liveBoardState(board, mode, now = Date.now()) {
  if (mode === "schedule") return "schedule";
  if (
    board.source === "live" &&
    Number.isFinite(board.timestamp) &&
    now - board.timestamp <= 90000 &&
    board.timestamp - now <= 30000
  )
    return "live";
  return "unavailable";
}

export function fgcVehicleName(vehicle) {
  return vehicle.line ? "Tren " + vehicle.line : "Tren FGC";
}
