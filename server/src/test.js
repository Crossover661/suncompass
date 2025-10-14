import { DateTime, Duration } from "luxon";
import {find} from "geo-tz";
import * as suncalc from "./suncalc.js";
import SunTime from "./SunTime.js";
import {direction} from "./mathfuncs.js";

let [lat, long] = [34.42, -119.85];
let date = DateTime.fromISO("2025-01-01T00:00:00.000", {zone: "America/Los_Angeles"});
for (let i=1; i<=12; i++) {
    // prints the difference between calculated solar noon and actual solar noon, in seconds
    console.log(date.toFormat("yyyy-MM-dd") + " " + 
        (suncalc.solarTime(long, suncalc.solarNoon(lat, long, date)[0].time) - 720)*60);
    date = date.plus({months: 1});
}