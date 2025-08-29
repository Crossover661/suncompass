/* 
This program creates a JSON file containing an array of objects, each representing the equinoxes and solstices for a particular
year. Since solstices and equinoxes occur at fixed UTC times and are not affected by geographic location, this JSON file allows
them to be queried quickly rather than repeatedly calculated. Solstices and equinoxes need only be calculated once.
*/

import * as fs from "node:fs";
import {marEquinox, junSolstice, sepEquinox, decSolstice} from "./suncalc.js";

let data = [];

let [startYear, endYear] = [0, 2500];
for (let year=startYear; year<=endYear; year++) {
    let me = marEquinox(year).toISO();
    let js = junSolstice(year).toISO();
    let se = sepEquinox(year).toISO();
    let ds = decSolstice(year).toISO();
    let obj = {year: year, marEquinox: me, junSolstice: js, sepEquinox: se, decSolstice: ds};
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