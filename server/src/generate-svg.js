import {allSunEvents, intervals, lengths, getSolsticeEquinox} from "./suncalc.js";
import {find} from "geo-tz";
import {generateSvg} from "./gen-svg.js";
import { DateTime } from "luxon";
import fs from "fs";
import { setUncaughtExceptionCaptureCallback } from "process";

const daylengthFileName = "day-lengths.svg";
const risesetFileName = "sunrise-sunset.svg";

let args = process.argv;
if (args.length != 4 && args.length != 5) {
    console.log("Syntax: node generate-svg.js <lat> <long> [year]");
    process.exit(1);
}

let [lat, long] = [Number(args[2]), Number(args[3])];
if (Math.abs(lat) >= 90) {
    console.log("Latitude must be between -90 and 90, exclusive (use ±89.9999 for poles)");
    process.exit(1);
}
else if (Math.abs(long) > 180) {
    console.log("Longitude must be between -180 and 180");
    process.exit(1);
}
let timeZone = find(lat, long)[0];
let year = DateTime.now().setZone(timeZone).year;
if (args.length == 5) {year = Number(args[4]);}

let sunEvents = [];
let date = DateTime.fromISO(`${year}-01-01`, {zone: timeZone});
while (date.year == year) {
    sunEvents.push(allSunEvents(lat, long, date));
    date = date.plus({days: 1});
}

let solsticesEquinoxes = [
    getSolsticeEquinox(year, 3, timeZone),
    getSolsticeEquinox(year, 6, timeZone),
    getSolsticeEquinox(year, 9, timeZone),
    getSolsticeEquinox(year, 12, timeZone)
];
let daylengthSvg = generateSvg(sunEvents, "length", solsticesEquinoxes);
fs.writeFileSync(daylengthFileName, daylengthSvg, "utf8");
console.log(`File written to ${daylengthFileName}`);

let risesetSvg = generateSvg(sunEvents, "rise-set", solsticesEquinoxes);
fs.writeFileSync(risesetFileName, risesetSvg, "utf8");
console.log(`File written to ${risesetFileName}`);