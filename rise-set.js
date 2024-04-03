import { DateTime, Duration } from "luxon";
import {find} from "geo-tz";
import * as suncalc from "./suncalc.js";
import {direction} from "./mathfuncs.js";

var lat = 34.415;
var long = -119.848;
var zone = find(lat, long)[0];
console.log(zone);

var date = DateTime.now().setZone(zone);
var subsolarPoint = suncalc.subsolarPoint(date);
var sunrise = suncalc.sunrise(lat, long, date);
var sunset = suncalc.sunset(lat, long, date);
var dawn = suncalc.civilDawn(lat, long, date);
var dusk = suncalc.civilDusk(lat, long, date);
var dayLength = suncalc.dayLength(lat, long, date);
var sunAngle = suncalc.sunPosition(lat, long, date);
var solarNoon = suncalc.solarNoon(long, date);
var noonSunAngle = suncalc.sunPosition(lat, long, solarNoon)[0];

console.log(date.toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS));
console.log("Current sun elevation: " + sunAngle[0].toFixed(4) + "°");
console.log("Current sun azimuth: " + sunAngle[1].toFixed(4) + "° (" + direction(sunAngle[1]) + ")");
console.log("Subsolar point: " + subsolarPoint[0].toFixed(4) + ", " + subsolarPoint[1].toFixed(4));
console.log();

console.log("Dawn: " + dawn[0].toLocaleString(DateTime.TIME_WITH_SECONDS));
console.log("Sunrise: " + sunrise[0].toLocaleString(DateTime.TIME_WITH_SECONDS) + ", " + sunrise[1].toFixed(4) + "° (" + direction(sunrise[1]) + ")");
console.log("Solar noon: " + solarNoon.toLocaleString(DateTime.TIME_WITH_SECONDS) + ", " + noonSunAngle.toFixed(4) + "°");
console.log("Sunset: " + sunset[0].toLocaleString(DateTime.TIME_WITH_SECONDS) + ", " + sunset[1].toFixed(4) + "° (" + direction(sunset[1]) + ")");
console.log("Dusk: " + dusk[0].toLocaleString(DateTime.TIME_WITH_SECONDS));
console.log("Day length: " + dayLength.toFormat("hh:mm:ss"));