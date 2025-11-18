import { DateTime, Duration } from "luxon";

console.log(DateTime.fromISO("2000-01-01T12:00:00", {zone: "utc"}).toMillis());