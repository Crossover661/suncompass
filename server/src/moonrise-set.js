import * as mc from "./mooncalc.js";
import {refract, getSolstEq} from "./suncalc.js"
import {DateTime} from "luxon";
import {find} from "geo-tz";

const [lat, long] = [34.42, -119.85];
const zone = find(lat, long)[0];
const date = DateTime.fromISO("2025-06-21T02:42:07", {zone: "utc"});
console.log(date.toISO());
const [moonLat, moonLong] = mc.sublunarPoint(date);
const [elev, az] = mc.moonPosition(lat, long, date);
const elevR = refract(elev);

console.log(`Sublunar point: ${moonLat.toFixed(4)}, ${moonLong.toFixed(4)}`);
console.log(`Moon position: ${elevR.toFixed(4)}, ${az.toFixed(4)}`);