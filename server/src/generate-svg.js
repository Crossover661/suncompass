import {allSunEvents, intervals, lengths} from "./suncalc.js";
import {find} from "geo-tz";
import {generateSvg} from "./gen-svg.js";
import { DateTime } from "luxon";
import fs from "fs";
import { setUncaughtExceptionCaptureCallback } from "process";

const daylengthFileName = "day-lengths.svg";
const risesetFileName = "sunrise-sunset.svg";

const args = process.argv;
if (args.length != 4 && args.length != 5) {
    console.log("Syntax: node generate-svg.js <lat> <long> [year]");
    process.exit(1);
}

const [lat, long] = [Number(args[2]), Number(args[3])];
if (Math.abs(lat) >= 90) {
    console.log("Latitude must be between -90 and 90, exclusive (use ±89.9999 for poles)");
    process.exit(1);
}
else if (Math.abs(long) > 180) {
    console.log("Longitude must be between -180 and 180");
    process.exit(1);
}
const timeZone = find(lat, long)[0];
const year = DateTime.now().setZone(timeZone).year;
if (args.length == 5) {year = Number(args[4]);}

const sunEvents = [];
let date = DateTime.fromISO(`${year}-01-01`, {zone: timeZone});
while (date.year == year) {
    sunEvents.push(allSunEvents(lat, long, date));
    date = date.plus({days: 1});
}

const daylengthSvg = generateSvg(sunEvents, "length");
fs.writeFileSync(daylengthFileName, daylengthSvg, "utf8");
console.log(`File written to ${daylengthFileName}`);

const risesetSvg = generateSvg(sunEvents, "rise-set");
fs.writeFileSync(risesetFileName, risesetSvg, "utf8");
console.log(`File written to ${risesetFileName}`);