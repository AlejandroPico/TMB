export function operatorIdentity(route) {
  if (route.feed === "tmb" && route.mode === "metro")
    return {
      key: "tmb",
      name: "Metro de Barcelona",
      asset: "metro-barcelona.svg",
      className: "logo-square",
    };
  if (route.feed === "tmb") return { key: "tmb", name: "TMB" };
  if (route.feed?.startsWith("tram-"))
    return { key: "tram", name: "TRAM", asset: "tram.png" };
  if (route.feed?.startsWith("euskotren-"))
    return { key: "euskotren", name: "Euskotren", asset: "euskotren.svg" };
  const identity = {
    fgc: ["FGC", "fgc.png"],
    "metro-madrid": ["Metro de Madrid", "metro-madrid.gif"],
    "metro-sevilla": ["Metro de Sevilla", "metro-sevilla.png", "logo-dark"],
    tussam: ["TUSSAM", "tussam.png", "logo-tussam"],
  }[route.feed];
  return identity
    ? {
        key: route.feed,
        name: identity[0],
        asset: identity[1],
        className: identity[2] || "",
      }
    : {
        key: route.operator || route.feed,
        name: route.operator || route.feed || "Transporte",
      };
}
export function stationOperators(routes) {
  const operators = new Map();
  for (const route of routes) {
    const identity = operatorIdentity(route),
      previous = operators.get(identity.key);
    if (!previous || (identity.asset && !previous.asset))
      operators.set(identity.key, identity);
  }
  return [...operators.values()];
}
