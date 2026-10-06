const FGC =
  "https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets/posicionament-dels-trens";
export const FGC_SOURCE =
  "https://dadesobertes.fgc.cat/explore/dataset/posicionament-dels-trens/";

export function fgcSnapshot(records, metadata, now = Date.now()) {
  const timestamp = Date.parse(metadata.metas?.default?.data_processed);
  if (
    !Number.isFinite(timestamp) ||
    now - timestamp > 180000 ||
    timestamp - now > 30000
  )
    throw new Error("La publicación de FGC no está actualizada.");
  const vehicles = records.results.flatMap((r) => {
    const { lat, lon } = r.geo_point_2d || {};
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < 39 ||
      lat > 44 ||
      lon < -1 ||
      lon > 4
    )
      return [];
    const occupancy = ["mi", "ri", "m1", "m2"]
      .map((car) => r["ocupacio_" + car + "_percent"])
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map(Number)
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
    return [
      {
        id: String(r.id),
        line: String(r.lin || ""),
        lat,
        lon,
        destination: r.desti || "",
        trainType: r.tipus_unitat || "",
        station: r.estacionat_a || "",
        onTime:
          r.en_hora === "True" ? true : r.en_hora === "False" ? false : null,
        occupancy: occupancy.length
          ? Math.round(occupancy.reduce((a, b) => a + b, 0) / occupancy.length)
          : null,
        timestamp,
      },
    ];
  });
  return { timestamp, vehicles };
}

export async function fetchFGC() {
  const responses = await Promise.all([
    fetch(FGC + "/records?limit=100", { signal: AbortSignal.timeout(10000) }),
    fetch(FGC, { signal: AbortSignal.timeout(10000) }),
  ]);
  if (responses.some((r) => !r.ok))
    throw new Error("FGC no está disponible ahora.");
  const [records, metadata] = await Promise.all(responses.map((r) => r.json()));
  return fgcSnapshot(records, metadata);
}
