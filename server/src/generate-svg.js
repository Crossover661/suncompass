import {allSunEvents, intervals, lengths} from "./suncalc.js";
import {find} from "geo-tz";
import {daylength_svg} from "./gen-svg.js";
import { DateTime } from "luxon";
import fs from "fs";

const daylength_file_name = "day-lengths.svg";

let args = process.argv;
if (args.length != 4 && args.length != 5) {
    console.log("Syntax: node generate-svg.js <lat> <long> [year]");
    process.exit(1);
}

let [lat, long] = [Number(args[2]), Number(args[3])];
let time_zone = find(lat, long)[0];
let year = DateTime.now().setZone(time_zone).year;
if (args.length == 6) {year = Number(args[4]);}

let sunEventsYear = [];
let date = DateTime.fromISO(`${year}-01-01`, {zone: time_zone});
while (date.year == year) {
    sunEventsYear.push(allSunEvents(lat, long, date));
    date = date.plus({days: 1});
}

let durations = [];
for (let i of sunEventsYear) {durations.push(lengths(i));}
let svg_text = daylength_svg(durations); // other settings are default
fs.writeFileSync(daylength_file_name, svg_text, "utf8");
console.log(`File written to ${daylength_file_name}`);