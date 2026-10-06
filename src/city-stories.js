import { stories, tours } from "./stories.js";
export const cityStories = {
  barcelona: stories,
  madrid: [
    {
      id: "madrid-1919",
      year: "1919",
      tag: "EL PRIMER VIAJE",
      title: "Ocho estaciones que cambiaron Madrid.",
      subtitle: "De Sol a Cuatro Caminos, el comienzo de una red.",
      lat: 40.4168,
      lon: -3.7038,
      body: "El 17 de octubre de 1919 se inauguró la primera línea del metro de Madrid. Unía Sol y Cuatro Caminos con seis estaciones intermedias. El trayecto original permite leer la ciudad que empezaba a moverse bajo tierra.",
      source:
        "https://www.comunidad.madrid/infraestructuras/linea-1-metro-madrid",
    },
  ],
  sevilla: [
    {
      id: "sevilla-2009",
      year: "2009",
      tag: "UNA RED METROPOLITANA",
      title: "El viaje cruza la ciudad.",
      subtitle: "Una línea que une Sevilla con su área metropolitana.",
      lat: 37.3784,
      lon: -5.993,
      body: "La Línea 1 del metro de Sevilla abrió parcialmente el 2 de abril de 2009. Desde el 23 de noviembre de ese año funciona el recorrido completo. Sus estaciones conectan la ciudad con los municipios del área metropolitana.",
      source: "https://www.metro-sevilla.es/quienes_somos",
    },
  ],
  zaragoza: [
    {
      id: "zaragoza-2011",
      year: "2011",
      tag: "EL REGRESO DEL TRANVÍA",
      title: "Una ciudad vuelve a los raíles.",
      subtitle: "Del tranvía histórico al eje norte-sur.",
      lat: 41.6437,
      lon: -0.885,
      body: "Zaragoza estrenó su primer tranvía en 1885. Más de un siglo después, el 19 de abril de 2011 abrió la primera fase del tranvía moderno, entre Valdespartera y la plaza de Basilio Paraíso. Su recorrido vuelve a coser barrios a través del espacio público.",
      source:
        "https://www.zaragoza.es/sede/portal/usic/servicio/noticia/220428",
    },
  ],
  espana: [],
};
export const cityTours = { barcelona: tours };
