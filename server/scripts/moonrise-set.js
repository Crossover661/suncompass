import * as mc from "../dist/mooncalc.js";
import {getSolstEq} from "../dist/suncalc.js"
import {DateTime} from "luxon";
import * as mf from "../dist/mathfuncs.js";
import {find} from "geo-tz";

const [lat, long] = [34.42, -119.85];
const date = DateTime.now().setZone("America/Los_Angeles");
console.log(date.toISO());
const unix = mf.ms(date);
const [moonLat, moonLong] = mc.sublunarPoint(unix);
const [elev, az] = mc.moonPosition(lat, long, unix);
const elevR = mf.refract(elev);

console.log(`Sublunar point: ${moonLat.toFixed(4)}, ${moonLong.toFixed(4)}`);
console.log(`Moon position: ${elevR.toFixed(4)}, ${az.toFixed(4)}`);