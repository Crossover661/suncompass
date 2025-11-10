import {allSunEvents, intervals, lengths, getSolsticeEquinox} from "./suncalc.js";
import {find} from "geo-tz";
import {generate_svg} from "./gen-svg.js";
import { DateTime } from "luxon";
import fs from "fs";
import { setUncaughtExceptionCaptureCallback } from "process";

const daylength_file_name = "day-lengths.svg";
const riseset_file_name = "sunrise-sunset.svg";

let args = process.argv;
if (args.length != 4 && args.length != 5) {
    console.log("Syntax: node generate-svg.js <lat> <long> [year]");
    process.exit(1);
}

let [lat, long] = [Number(args[2]), Number(args[3])];
if (Math.abs(lat) >= 90) {
    console.log("Latitude must be between -89.9999 and 89.9999");
    process.exit(1);
}
else if (Math.abs(long) > 180) {
    console.log("Longitude must be between -180 and 180");
    process.exit(1);
}
let time_zone = find(lat, long)[0];
let year = DateTime.now().setZone(time_zone).year;
if (args.length == 5) {year = Number(args[4]);}

let sun_events = [];
let date = DateTime.fromISO(`${year}-01-01`, {zone: time_zone});
while (date.year == year) {
    sun_events.push(allSunEvents(lat, long, date));
    date = date.plus({days: 1});
}

let solstices_equinoxes = [
    getSolsticeEquinox(year, 3, time_zone),
    getSolsticeEquinox(year, 6, time_zone),
    getSolsticeEquinox(year, 9, time_zone),
    getSolsticeEquinox(year, 12, time_zone)
];
let daylength_svg = generate_svg(sun_events, "length", solstices_equinoxes);
fs.writeFileSync(daylength_file_name, daylength_svg, "utf8");
console.log(`File written to ${daylength_file_name}`);

let riseset_svg = generate_svg(sun_events, "rise-set", solstices_equinoxes);
fs.writeFileSync(riseset_file_name, riseset_svg, "utf8");
console.log(`File written to ${riseset_file_name}`);