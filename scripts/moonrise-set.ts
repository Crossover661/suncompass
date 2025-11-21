import * as mc from "../src/core/mooncalc.ts";
import {DateTime} from "luxon";
import * as mf from "../src/core/mathfuncs.ts";
import {find} from "geo-tz";

const [lat, long] = [34.42, -119.85];
const zone = find(lat, long)[0];
const date = DateTime.now().setZone(zone);
console.log(date.toISO());
const unix = mf.ms(date);
const [moonLat, moonLong] = mc.sublunarPoint(unix);
const [elev, az] = mc.moonPosition(lat, long, unix);
const elevR = mf.refract(elev);

console.log(`Sublunar point: ${moonLat.toFixed(4)}, ${moonLong.toFixed(4)}`);
console.log(`Moon position: ${elevR.toFixed(4)}, ${az.toFixed(4)}`);