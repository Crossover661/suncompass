import { DateTime, Duration } from "luxon";
import {mod, approxDeltaT} from "./mathfuncs.js";
import {find} from "geo-tz";
import {degToRad} from "./constants.js"
import * as suncalc from "./suncalc.js";
import SunTime from "./SunTime.js";
import {direction, jCentury} from "./mathfuncs.js";

const junSolstice = suncalc.getSolsticeEquinox(2025,6);
console.log(junSolstice.toISO());
const m = jCentury(junSolstice) / 10;
const u = m / 10;
const long1 = suncalc.sunTrueLong(junSolstice);
console.log(`Sun longitude: ${long1}`);
const long2 = mod((280.4664567 + 360007.6982779*m + 0.03032028*m**2 + m**3/49931 - m**4/15299 - m**5/1988000), 360);
console.log(`Mean sun longitude: ${long2}`);
console.log(mod((long1-long2)+180, 360) - 180);