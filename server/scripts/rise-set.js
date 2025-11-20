import { DateTime, Duration } from "luxon";
import {find} from "geo-tz";
import * as sc from "../dist/suncalc.js";
import SunTime from "../dist/SunTime.js";
import * as mf from "../dist/mathfuncs.js";
import { generateLODProfile } from "../dist/lookup-tables.js";

const args = process.argv;
let lat, long, zone, date;
if (args.length == 2) {
    [lat, long] = [34.42,-119.85]; // the location around the University of California, Santa Barbara
    zone = find(lat, long)[0];
    date = DateTime.now().setZone(zone);   
}
else if (args.length == 4) { 
    /* Accepts coordinates. Example: "node rise-set 40.75 -73.99" gives rise-set times for Manhattan, New York City in Eastern Time. */
    [lat, long] = [Number(args[2]), Number(args[3])];
    zone = find(lat, long)[0];
    date = DateTime.now().setZone(zone);
}
else if (args.length == 5) {
    /* Coordinates and date. Example: "node rise-set 40.75 -73.99" gives times for June 20, 2024 in New York City in EDT
    The date argument can be replaced with "me" for March equinox, "js" for June solstice, "se" for Sep equinox, "ds" for 
    Dec solstice, or "continuous" for a continuously-updating display.
    The specific time can also be specified in the date. Examples:
    "2022-02-22T02:22:22" --> February 22, 2022 at 2:22:22 AM
    "2024-12-25T19:12:06" --> December 25, 2024 at 7:12:06 PM (19:12:06)
    */
    [lat, long] = [Number(args[2]), Number(args[3])];
    zone = find(lat, long)[0];
    const curYear = DateTime.now().setZone(zone).year;
    if (args[4] == "me") {date = sc.getSolstEq(curYear, zone).marEquinox;}
    else if (args[4] == "js") {date = sc.getSolstEq(curYear, zone).junSolstice;}
    else if (args[4] == "se") {date = sc.getSolstEq(curYear, zone).sepEquinox;}
    else if (args[4] == "ds") {date = sc.getSolstEq(curYear, zone).decSolstice;}
    else if (args[4] != "continuous") {date = DateTime.fromISO(args[4], {zone: zone});}
}
else {
    console.log("Invalid argument");
    process.exit(1);
}

// Print subsolar point, sun's apparent elevation, and solar noon/midnight/sunrise/sunset/twilight times.
function printSunInfo(lat, long, zone, date, ecef) {
    const lod = generateLODProfile(mf.ms(date));
    const subsolarPoint = sc.subsolarPoint(lod);
    const [elev, az] = sc.sunPosition(lat, long, lod, ecef);
    const apparentElev = sc.refract(elev);
    const dist = lod.distance;

    process.stdout.write(`\r${zone}\n`);
    process.stdout.write(`\r${date.toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)}\n`);
    process.stdout.write(`\rCurrent sun elevation: ${elev.toFixed(4)}° (After refraction: ${apparentElev.toFixed(4)}°)\n`);
    process.stdout.write(`\rCurrent sun bearing: ${az.toFixed(4)}° (${mf.direction(az)})\n`);
    process.stdout.write(`\rSubsolar point: ${subsolarPoint[0].toFixed(4)}, ${subsolarPoint[1].toFixed(4)}\n`);
    process.stdout.write(`\rSun-earth distance: ${dist.toFixed(0)} km (${(dist/1.609344).toFixed(0)} mi)\n`);

    // Print day length
    const dayLength = -1; // placeholder
    if (dayLength == -1) {process.stdout.write("\rDay length: undefined\n\r\n");}
    else {process.stdout.write(`\rDay length: ${Duration.fromObject({seconds: dayLength}).toFormat("h:mm:ss")}\n\r\n`);}

    // Print sunrise, sunset, solar noon, solar midnight, and twilight times
    const solarEvents = sc.sunEventsDay(lat, long, date, ecef);
    process.stdout.write(`\r         Event |        Time | Elevation |       Bearing\n`); // header
    for (const event of solarEvents) {
        let bold = false;
        if (event.eventType == "Sunrise" || event.eventType == "Sunset" || event.eventType == "Solar Noon") {bold = true};
        let [r, g, b] = [128, 128, 128];
        if (event.eventType == "Sunrise" || event.eventType == "Sunset") {[r, g, b] = [255, 255, 0];}
        else if (event.solarElevation >= -5/6) {[r, g, b] = [255, 255, 255];}
        process.stdout.write(`\r${event.toStringFormatted(bold, r, g, b, zone)}\n`);
    }

    return 9 + solarEvents.length; // number of lines in output
}

function printEverySecond(lat, long, zone, ecef, lines = 0) {
    const date = DateTime.now().setZone(zone);
    if (lines > 0) {process.stdout.write(`\x1b[${lines}A`);}
    const l = printSunInfo(lat, long, zone, date.set({millisecond: 0}), ecef);
    setTimeout(printEverySecond(lat, long, zone, ecef, l), 1000 - date.millisecond); // delay until next full second
}

const ecef = mf.latLongEcef(lat, long);
if (Math.abs(lat) >= 90) {console.log("Latitude must be between -90 and 90, exclusive (use ±89.9999 for poles)");}
else if (Math.abs(long) > 180) {console.log("Longitude must be between -180 and 180");}
else if (date == null) {printEverySecond(lat, long, zone, ecef);}
else {printSunInfo(lat, long, zone, date, ecef);}