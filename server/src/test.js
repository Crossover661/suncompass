import { DateTime, Duration } from "luxon";
import {mod} from "./mathfuncs.js";
import {find} from "geo-tz";
import * as suncalc from "./suncalc.js";
import SunTime from "./SunTime.js";
import {direction} from "./mathfuncs.js";

let [lat, long] = [34.42, -119.85];
let zone = find(lat, long)[0];
let dates = [
    DateTime.fromISO("2025-01-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-02-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-03-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-04-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-05-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-06-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-07-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-08-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-09-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-10-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-11-01T00:00:00", {zone: zone}),
    DateTime.fromISO("2025-12-01T00:00:00", {zone: zone}),
]

console.log("Noon differences:");
for (let date of dates) {
    let noon = suncalc.solarNoon(lat, long, date)[0].time;
    let solarTime = suncalc.solarTime(long, noon);
    let diff = (solarTime - 720) * 60000; // difference between calculated solar noon and real solar noon, in ms
    console.log(`${diff.toFixed(4)} ms`);
}

console.log("Midnight differences");
for (let date of dates) {
    let midnight = suncalc.solarMidnight(lat, long, date)[0].time;
    let solarTime = mod(suncalc.solarTime(long, midnight)+720, 1440) - 720;
    let diff = solarTime * 60000;
    console.log(`${diff.toFixed(4)} ms`);
}