import { DateTime, Duration } from "luxon";
import * as mf from "./mathfuncs.js";
import {find} from "geo-tz";
import {allSunEvents} from "./suncalc.js";

const start = performance.now()
const sunEvents = [];
const [lat, long] = [34.42, -119.85];
const zone = find(lat, long)[0];
const ecef = mf.latLongEcef(lat, long);
const [startDate, endDate] = [DateTime.fromObject({year: 2025}, {zone: zone}), DateTime.fromObject({year: 2026}, {zone: zone})];
const allDates = mf.dayStarts(startDate, endDate);
const lookupTable = mf.timeZoneLookupTable(allDates);
for (let i=0; i<allDates.length-1; i++) {
    const t0 = mf.ms(allDates[i]), t1 = mf.ms(allDates[i+1]);
    const evts = allSunEvents(lat, long, t0, t1, ecef);
    sunEvents.push(evts);
}
const end = performance.now();
console.log(`Took ${(end/1000).toFixed(3)} seconds`);