import { DateTime, Duration } from "luxon";
import {find} from "geo-tz";
import * as suncalc from "./suncalc.js";
import {direction, displayTime, displayDuration} from "./mathfuncs.js";

var args = process.argv;
var zone, date;
if (args.length == 2) {
    var [lat, long] = [34.42,-119.85]; // the location around the University of California, Santa Barbara
    zone = find(lat, long)[0];
    date = DateTime.now().setZone(zone);   
}
else if (args.length == 4) { // Accepts coordinates. Example: "node rise-set 38.9 -77.02" gives rise-set times for Washington, D.C. in Eastern Time.
    var [lat, long] = [Number(args[2]), Number(args[3])];
    zone = find(lat, long)[0];
    date = DateTime.now().setZone(zone);
}
else if (args.length == 5) {
    // Coordinates and date. Example: "node rise-set 38.9 -77.02 2024-06-20" gives times for June 20, 2024 in Washington, D.C. in EDT
    // The date argument can be replaced with "me" for March equinox, "js" for June solstice, "se" for Sep equinox, "ds" for Dec solstice
    // The specific time can also be specified in the date. Example: "2024-05-23T19:44:17" = May 23, 2024 at 7:44:17 PM. Time must be specified in 24-hour format.
    var [lat, long] = [Number(args[2]), Number(args[3])];
    zone = find(lat, long)[0];
    var curYear = DateTime.now().setZone(zone).year;
    if (args[4] == "me") {date = suncalc.marEquinox(curYear, zone);}
    else if (args[4] == "js") {date = suncalc.junSolstice(curYear, zone);}
    else if (args[4] == "se") {date = suncalc.sepEquinox(curYear, zone);}
    else if (args[4] == "ds") {date = suncalc.decSolstice(curYear, zone);}
    else {date = DateTime.fromISO(args[4], {zone: zone});}
}
else {
    console.log("Invalid argument");
    process.exit(1);
}

var subsolarPoint = suncalc.subsolarPoint(date);
var [elev, az] = suncalc.sunPosition(lat, long, date);
var apparentElev = suncalc.refract(elev);

var dawn = [suncalc.civilDawn(lat,long,date), suncalc.nauticalDawn(lat,long,date), suncalc.astroDawn(lat,long,date)];
var sunrise = suncalc.sunrise(lat,long,date);
var solarNoon = suncalc.solarNoon(long,date);
var sunset = suncalc.sunset(lat,long,date);
var dusk = [suncalc.civilDusk(lat,long,date), suncalc.nauticalDusk(lat,long,date), suncalc.astroDusk(lat,long,date)];
var dayLength = suncalc.dayLength(lat,long,date);

console.log(zone);
console.log(date.toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS));
console.log("Current sun elevation: " + elev.toFixed(4) + "°" + " (After refraction: " + apparentElev.toFixed(4) + "°)");
console.log("Current sun azimuth: " + az.toFixed(4) + "° (" + direction(az) + ")");
console.log("Subsolar point: " + subsolarPoint[0].toFixed(4) + ", " + subsolarPoint[1].toFixed(4));
console.log();

console.log("Sunrise: " + displayTime(sunrise));
console.log("Solar noon: " + displayTime(solarNoon));
console.log("Sunset: " + displayTime(sunset));
console.log("Day length: " + displayDuration(dayLength));
console.log();

console.log("Civil dawn/dusk: " + displayTime(dawn[0]) + ", " + displayTime(dusk[0]));
console.log("Nautical dawn/dusk: " + displayTime(dawn[1]) + ", " + displayTime(dusk[1]));
console.log("Astronomical dawn/dusk: " + displayTime(dawn[2]) + ", " + displayTime(dusk[2]));