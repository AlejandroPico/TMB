import config from "../app.config.json";

// One name for the interface, browser title and deployment. GitHub's APP_NAME
// repository variable can override the file without changing source code.
export const APP_NAME = import.meta.env.VITE_APP_NAME || config.name;
export const APP_DESCRIPTION = config.description;
export const DEFAULT_CITY = config.defaultCity;
