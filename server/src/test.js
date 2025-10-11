import { DateTime, Duration } from "luxon";
import {find} from "geo-tz";
import * as suncalc from "./suncalc.js";
import SunTime from "./SunTime.js";
import {direction} from "./mathfuncs.js";

/*let date1 = DateTime.fromISO("2025-10-11T12:45:57.375", {zone: "America/Los_Angeles"})
let date2 = date1.plus(2);
let sp1 = suncalc.sunPosition(34.42, -119.85, date2)[0];
let sp2 = suncalc.sunPosition(34.42, -119.85, date1)[0];
let diff = sp2 - sp1;
console.log(sp1);
console.log(sp2);
console.log(diff);*/

let date = DateTime.fromISO("2025-06-20T00:00:00.000", {zone: "utc"});
let newDate = date.plus(1000);
let minElevDiff = Number.POSITIVE_INFINITY;
let [lat, long] = [89.9999,0];

while (newDate.day == date.day) {
    let diff = suncalc.sunPosition(lat, long, newDate)[0] - suncalc.sunPosition(lat, long, date)[0];
    if (Math.abs(diff) < minElevDiff) {minElevDiff = Math.abs(diff);}
    date = newDate;
    newDate = newDate.plus(1000);
}
console.log(minElevDiff);