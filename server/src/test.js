import { DateTime, Duration } from "luxon";
import {find} from "geo-tz";
import * as suncalc from "./suncalc.js";
import SunTime from "./SunTime.js";
import {direction} from "./mathfuncs.js";

let [lat, long] = [34.42, -119.85];
let date = suncalc.junSolstice(2025, find(lat, long));
const curDate = DateTime.now();
let ints = suncalc.intervals_svg(suncalc.allSunEvents(lat, long, curDate));
console.log("[");
for (let int of ints[0]) {
    console.log(`[ ${int[0]} ${int[1]}]`);
}
console.log("]");