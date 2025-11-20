import {sunEventsDay, allSunEvents, intervals, lengths, getSolstEq} from "../dist/suncalc.js";
import {find} from "geo-tz";
import {generateSvg} from "../dist/gen-svg.js";
import { DateTime } from "luxon";
import fs from "fs";
import * as mf from "../dist/mathfuncs.js";
import { timeZoneLookupTable, longDistLookupTable } from "../dist/lookup-tables.js";

const start = performance.now();

const daylengthFileName = "./diagrams/day-lengths.svg";
const risesetFileName = "./diagrams/sunrise-sunset.svg";

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
const ecef = mf.latLongEcef(lat, long);
const year = DateTime.now().setZone(timeZone).year;
if (args.length == 5) {year = Number(args[4]);}

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

const solsticesEquinoxes = getSolstEq(year, timeZone);

const daylengthSvg = generateSvg(sunEvents, "length", tzLookupTable, solsticesEquinoxes);
fs.writeFileSync(daylengthFileName, daylengthSvg, "utf8");
console.log(`File written to ${daylengthFileName}`);

const risesetSvg = generateSvg(sunEvents, "rise-set", tzLookupTable, solsticesEquinoxes);
fs.writeFileSync(risesetFileName, risesetSvg, "utf8");
console.log(`File written to ${risesetFileName}`);
const end = performance.now();
console.log(`Took ${((end-start)/1000).toFixed(3)} seconds`);