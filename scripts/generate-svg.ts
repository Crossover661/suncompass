import {sunEventsDay, allSunEvents, intervals, lengths} from "../src/core/suncalc.ts";
import {find} from "geo-tz";
import {generateSvg} from "../src/core/gen-svg.ts";
import { DateTime } from "luxon";
import fs from "fs";
import * as mf from "../src/core/mathfuncs.ts";
import { timeZoneLookupTable, longDistLookupTable } from "../src/core/lookup-tables.ts";
import path from "path";

type RawSeasonRecord = {year: number; marEquinox: number; junSolstice: number; sepEquinox: number; decSolstice: number;};
function solsticesEquinoxes(): RawSeasonRecord[] {
  const jsonPath = path.join("public", "data", "solstices_equinoxes.json");
  const raw = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(raw) as RawSeasonRecord[];
}

const start = performance.now();

const args = process.argv;
if (args.length < 4 || args.length > 6) {
    console.log("Syntax: node generate-svg.js <lat> <long> [year] [location-name]");
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
const ecef = mf.latLongEcef(lat, long);
let year = DateTime.now().setZone(timeZone).year;
if (args.length == 5) {year = Number(args[4]);}

const daylengthFileName = 
(args.length == 6) ? `./public/diagrams/${args[5]}-day-lengths-${year}.svg` : `./public/diagrams/day-lengths.svg`;
const risesetFileName = 
(args.length == 6) ? `./public/diagrams/${args[5]}-sunrise-sunset-${year}.svg` : `./public/diagrams/sunrise-sunset.svg`;

const sunEvents = [];
const startDate = DateTime.fromObject({year: year}, {zone: timeZone});
const endDate = DateTime.fromObject({year: year+1}, {zone: timeZone});
const dateList = mf.dayStarts(startDate, endDate);
const tzLookupTable = timeZoneLookupTable(dateList);
const lodLookupTable = longDistLookupTable(dateList);

for (let i=0; i<dateList.length-1; i++) {
    const startLOD = lodLookupTable[i], endLOD = lodLookupTable[i+1];
    const curDaySunEvents = allSunEvents(lat, long, startLOD, endLOD, ecef);
    sunEvents.push(curDaySunEvents);
}

const solstEq = solsticesEquinoxes();
const solstEqDT = [
    DateTime.fromMillis(solstEq[year].marEquinox, {zone: timeZone}),
    DateTime.fromMillis(solstEq[year].junSolstice, {zone: timeZone}),
    DateTime.fromMillis(solstEq[year].sepEquinox, {zone: timeZone}),
    DateTime.fromMillis(solstEq[year].decSolstice, {zone: timeZone}),
]

const daylengthSvg = generateSvg({events: sunEvents, type: "length", timeZone: tzLookupTable, solsticesEquinoxes: solstEqDT});
fs.writeFileSync(daylengthFileName, daylengthSvg, "utf8");
console.log(`File written to ${daylengthFileName}`);

const risesetSvg = generateSvg({events: sunEvents, type: "rise-set", timeZone: tzLookupTable, solsticesEquinoxes: solstEqDT});
fs.writeFileSync(risesetFileName, risesetSvg, "utf8");
console.log(`File written to ${risesetFileName}`);
const end = performance.now();
console.log(`Took ${((end-start)/1000).toFixed(3)} seconds`);