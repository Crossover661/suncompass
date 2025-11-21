import * as fs from "node:fs";
import {calcSolstEq} from "../src/core/suncalc.ts";
import {DateTime} from "luxon";

const data = [];

const [startYear, endYear] = [0, 2500];
for (let year=startYear; year<=endYear; year++) {
    const [me, js, se, ds] = [calcSolstEq(year, 3), calcSolstEq(year, 6), calcSolstEq(year, 9), calcSolstEq(year, 12)];
    const obj = {year: year, marEquinox: me, junSolstice: js, sepEquinox: se, decSolstice: ds};
    data.push(obj);
}

const jsonContent = JSON.stringify(data, null, 2);
fs.writeFile("public/data/solstices_equinoxes.json", jsonContent, "utf8", function (err) {
    if (err) {
        console.log("Error occurred - file not saved");
        throw err;
    }
    else {console.log("File saved successfully");}
});