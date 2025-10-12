import { DateTime, Duration } from "luxon";
import {find} from "geo-tz";
import * as suncalc from "./suncalc.js";
import SunTime from "./SunTime.js";
import {direction} from "./mathfuncs.js";

let args = process.argv;
let lat, long, zone, date;
if (args.length == 2) {
    [lat, long] = [34.42,-119.85]; // the location around the University of California, Santa Barbara
    zone = find(lat, long)[0];
    date = DateTime.now().setZone(zone);   
}
else if (args.length == 4) { // Accepts coordinates. Example: "node rise-set 40.75 -73.99" gives rise-set times for Manhattan, New York City in Eastern Time.
    [lat, long] = [Number(args[2]), Number(args[3])];
    zone = find(lat, long)[0];
    date = DateTime.now().setZone(zone);
}
else if (args.length == 5) {
    /* Coordinates and date. Example: "node rise-set 40.75 -73.99" gives times for June 20, 2024 in New York City in EDT
    The date argument can be replaced with "me" for March equinox, "js" for June solstice, "se" for Sep equinox, "ds" for Dec solstice
    The specific time can also be specified in the date. Examples:
    "2022-02-22T02:22:22" --> February 22, 2022 at 2:22:22 AM
    "2024-12-25T19:12:06" --> December 25, 2024 at 7:12:06 PM (19:12:06)
    */
    [lat, long] = [Number(args[2]), Number(args[3])];
    zone = find(lat, long)[0];
    let curYear = DateTime.now().setZone(zone).year;
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

// Print subsolar point, sun's apparent elevation, and subsolar point

let subsolarPoint = suncalc.subsolarPoint(date);
let [elev, az] = suncalc.sunPosition(lat, long, date);
let apparentElev = suncalc.refract(elev);
let dist = suncalc.sunDistance(date);

console.log(zone);
console.log(date.toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS));
console.log("Current sun elevation: " + elev.toFixed(4) + "°" + " (After refraction: " + apparentElev.toFixed(4) + "°)");
console.log("Current sun bearing: " + az.toFixed(4) + "° (" + direction(az) + ")");
console.log("Subsolar point: " + subsolarPoint[0].toFixed(4) + ", " + subsolarPoint[1].toFixed(4));
console.log("Sun-earth distance: " + dist.toFixed(0) + " km (" + (dist/1.609344).toFixed(0) + " mi)");

// Print day length
let dayLength = Math.round(suncalc.dayLength(lat, long, date));
if (dayLength == -1) {console.log("Day length: undefined");}
else {console.log("Day length: " + Duration.fromObject({seconds: dayLength}).toFormat("h:mm:ss"));}
console.log("");

// Print sunrise, sunset, solar noon, solar midnight, and twilight times
let solarEvents = suncalc.allSunEvents(lat, long, date);
console.log("         Event |        Time | Elevation |       Bearing"); // header
for (let event of solarEvents) {
    let bold = false;
    if (event.eventType == "Sunrise" || event.eventType == "Sunset" || event.eventType == "Solar Noon") {bold = true};
    let [r, g, b] = [128, 128, 128];
    if (event.eventType == "Sunrise" || event.eventType == "Sunset") {[r, g, b] = [255, 255, 0];}
    else if (event.solarElevation >= -5/6) {[r, g, b] = [255, 255, 255];}
    console.log(event.toStringFormatted(bold, r, g, b));
}