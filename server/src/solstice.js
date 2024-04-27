import {DateTime} from "luxon";
import {find} from "geo-tz";
import {marEquinox, junSolstice, sepEquinox, decSolstice, subsolarPoint, solstEq} from "./suncalc.js";

var year;
var zone = "utc";

var args = process.argv;
if (args.length == 2) {year = DateTime.now().year;}
else {year = args[2];}
var dates = solstEq(year, true);
var mar = dates.marEquinox;
var jun = dates.junSolstice;
var sep = dates.sepEquinox;
var dec = dates.decSolstice;
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