// Returns the time of solstices and equinoxes for a given year and time zone. If the year and/or time zone are unspecified, it defaults to the current year and local time zone of the computer.
// Example queries:
// "node solstice.js" returns solstices and equinoxes for current year and local time zone.
// "node solstice.js 2025" returns solstices and equinoxes for 2025 in the local time zone.
// "node solstice.js 2026 utc" returns solstices and equinoxes for 2026 in UTC.
// "node solstice.js 2025 America/Los_Angeles" returns solstices and equinoxes for 2025 in Pacific Time.

import {DateTime} from "luxon";
import {subsolarPoint, getSolsticeEquinox} from "./suncalc.js";

var year;
var zone;

var args = process.argv;
if (args.length == 2) {year = DateTime.now().year;}
else {year = args[2];}
if (args.length <= 3) {zone = "local";}
else {zone = args[3];}

var mar = getSolsticeEquinox(year, 3, zone);
var jun = getSolsticeEquinox(year, 6, zone);
var sep = getSolsticeEquinox(year, 9, zone);
var dec = getSolsticeEquinox(year, 12, zone);
var marSSP = subsolarPoint(mar);
var junSSP = subsolarPoint(jun);
var sepSSP = subsolarPoint(sep);
var decSSP = subsolarPoint(dec);

console.log("March equinox: " + mar.toFormat("MMM d, y HH:mm:ss ZZZZ"));
console.log("Subsolar point: " + marSSP[0].toFixed(4) + ", " + marSSP[1].toFixed(4));
console.log();

console.log("June solstice: " + jun.toFormat("MMM d, y HH:mm:ss ZZZZ"));
console.log("Subsolar point: " + junSSP[0].toFixed(4) + ", " + junSSP[1].toFixed(4));
console.log();

console.log("September equinox: " + sep.toFormat("MMM d, y HH:mm:ss ZZZZ"));
console.log("Subsolar point: " + sepSSP[0].toFixed(4) + ", " + sepSSP[1].toFixed(4));
console.log();

console.log("December solstice: " + dec.toFormat("MMM d, y HH:mm:ss ZZZZ"));
console.log("Subsolar point: " + decSSP[0].toFixed(4) + ", " + decSSP[1].toFixed(4));
console.log();