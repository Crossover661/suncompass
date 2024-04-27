/* 
This program creates a JSON file containing an array of objects, each representing the equinoxes and solstices for a particular
year. Since solstices and equinoxes occur at fixed UTC times and are not affected by geographic location, this JSON file allows
them to be queried quickly rather than repeatedly calculated.
*/

import * as fs from "node:fs";
import {marEquinox, junSolstice, sepEquinox, decSolstice} from "./suncalc.js";

var data = [];

var [startYear, endYear] = [0, 2500];
for (var year=startYear; year<=endYear; year++) {
    var me = marEquinox(year).toISO();
    var js = junSolstice(year).toISO();
    var se = sepEquinox(year).toISO();
    var ds = decSolstice(year).toISO();
    var obj = {year: year, marEquinox: me, junSolstice: js, sepEquinox: se, decSolstice: ds};
    data.push(obj);
}

const jsonContent = JSON.stringify(data, null, 2);
fs.writeFile("solstices_equinoxes.json", jsonContent, "utf8", function (err) {
    if (err) {
        console.log("Error occurred - file not saved");
        throw err;
    }
    else {console.log("File saved successfully");}
});