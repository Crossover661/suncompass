import { DateTime, Duration } from "luxon";
import {find} from "geo-tz";
import * as suncalc from "./suncalc.js";
import SunTime from "./SunTime.js";
import {direction} from "./mathfuncs.js";

let [lat, long] = [34.42, -119.85];
let date = suncalc.junSolstice(2025, find(lat, long));
const start = Date.now();
const iterations = 1;
for (let i=0; i<iterations; i++) {suncalc.allSunEvents(lat + i/iterations, long + i/iterations, date);}
const end = Date.now();
console.log(end - start);