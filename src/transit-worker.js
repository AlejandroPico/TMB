import {
  dayTrips,
  buildDepartures,
  buildTransfers,
  nextDepartures,
  planJourney,
} from "./transit.js";
let network, schedule, trips, departures, transfers, date;
onmessage = async ({ data: m }) => {
  try {
    if (m.type === "init") {
      network = m.network;
      schedule = m.schedule;
      transfers = buildTransfers(network);
      date = null;
    }
    if (m.date && m.date !== date) {
      date = m.date;
      trips = dayTrips(schedule, date);
      departures = buildDepartures(schedule, trips);
    }
    let result;
    if (m.type === "init" || m.type === "day") result = { trips };
    if (m.type === "departures")
      result = nextDepartures(departures, m.stop, m.time, 12);
    if (m.type === "station")
      result = m.stops.flatMap((stop) =>
        nextDepartures(departures, stop, m.time, 96).map((d) => ({
          ...d,
          stop,
        })),
      );
    if (m.type === "plan")
      result = planJourney(
        network,
        schedule,
        departures,
        transfers,
        m.from,
        m.to,
        m.time,
        m.options,
      );
    if (m.type === "reach")
      result = planJourney(
        network,
        schedule,
        departures,
        transfers,
        m.from,
        null,
        m.time,
        { minutes: m.minutes },
      );
    postMessage({ id: m.id, result });
  } catch (e) {
    postMessage({ id: m.id, error: e.message });
  }
};
