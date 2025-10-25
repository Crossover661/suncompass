function polygon_from_array(points, // array of points
fill_color = "", // hexadecimal value representing fill color (empty if no fill)
stroke_color = "" // hexadecimal value representing stroke color (empty if no stroke)
) {
    return ""; // placeholder
}
function daylength_svg(svg_width, // width of the chart (not the entire SVG file)
svg_height, // height of the chart (not the entire SVG file)
font_size, grid, grid_interval, lengths, // lengths from "lengths" function in suncalc.ts
colors, // hex colors of day, civil, nautical, astronomical twilight, and night respectively
left_padding, right_padding, top_padding, bottom_padding) {
    const days = lengths.length; // 365 days for common years, 366 for leap years
    const DAY_LENGTH = 86400000; // milliseconds in a day
    /** sum of first n values of array */
    function array_sum(array, n = array.length) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += array[i];
        }
        return sum;
    }
    /** x-coordinate representing given day */
    function xCoord(dayNumber) {
        return svg_width * (dayNumber / (days - 1));
    }
    /** y-coordinate representing day length */
    function yCoord(dayLength) {
        return svg_height * (dayLength / DAY_LENGTH);
    }
    let dLengths = []; // day lengths
    let cLengths = []; // day + civil twilight lengths
    let nLengths = []; // day + civil + nautical twilight lengths
    let aLengths = []; // day + civil + nautical + astronomical twilight lengths
    for (let l of lengths) {
        dLengths.push(l[0]);
        cLengths.push(array_sum(l, 2));
        nLengths.push(array_sum(l, 3));
        aLengths.push(array_sum(l, 4));
    }
    let dp = [[]]; // day polygons
    let cp = [[]]; // civil twilight polygons
    let np = [[]]; // nautical twilight polygons
    let ap = [[]]; // astronomical twilight polygons
    // generate polygons
    for (let i = 0; i < days; i++) {
        // generate day polygons
        if (dLengths[i] > 0) {
            if (i == 0) {
                dp[0].push([0, 0], [0, xCoord(dLengths[0])]);
            }
            else if (dLengths[i - 1] == 0) {
                dp.push([[xCoord(i - 0.5), 0], [xCoord(i), yCoord(dLengths[i])]]);
            }
            else {
                dp[dp.length - 1].push([xCoord(i), yCoord(dLengths[i])]);
            }
            if (i == days - 1) {
                dp[dp.length - 1].push([svg_width, 0]);
            }
        }
        else if (i != 0 && dLengths[i - 1] > 0) {
            dp[dp.length - 1].push([xCoord(i + 0.5), 0]);
        }
        // generate civil twilight polygons
        if (cLengths[i] > 0) {
            if (i == 0) {
                cp[0].push([0, 0], [0, xCoord(cLengths[0])]);
            }
            else if (cLengths[i - 1] == 0) {
                cp.push([[xCoord(i - 0.5), 0], [xCoord(i), yCoord(cLengths[i])]]);
            }
            else {
                cp[cp.length - 1].push([xCoord(i), yCoord(cLengths[i])]);
            }
            if (i == days - 1) {
                cp[cp.length - 1].push([svg_width, 0]);
            }
        }
        else if (i != 0 && cLengths[i - 1] > 0) {
            cp[cp.length - 1].push([xCoord(i + 0.5), 0]);
        }
        // generate nautical twilight polygons
        if (nLengths[i] > 0) {
            if (i == 0) {
                np[0].push([0, 0], [0, xCoord(nLengths[0])]);
            }
            else if (nLengths[i - 1] == 0) {
                np.push([[xCoord(i - 0.5), 0], [xCoord(i), yCoord(nLengths[i])]]);
            }
            else {
                np[np.length - 1].push([xCoord(i), yCoord(nLengths[i])]);
            }
            if (i == days - 1) {
                np[np.length - 1].push([svg_width, 0]);
            }
        }
        else if (i != 0 && nLengths[i - 1] > 0) {
            np[np.length - 1].push([xCoord(i + 0.5), 0]);
        }
        // generate astronomical twilight polygons
        if (aLengths[i] > 0) {
            if (i == 0) {
                ap[0].push([0, 0], [0, xCoord(aLengths[0])]);
            }
            else if (aLengths[i - 1] == 0) {
                ap.push([[xCoord(i - 0.5), 0], [xCoord(i), yCoord(aLengths[i])]]);
            }
            else {
                ap[ap.length - 1].push([xCoord(i), yCoord(aLengths[i])]);
            }
            if (i == days - 1) {
                ap[ap.length - 1].push([svg_width, 0]);
            }
        }
        else if (i != 0 && aLengths[i - 1] > 0) {
            ap[ap.length - 1].push([xCoord(i + 0.5), 0]);
        }
    }
    return ""; // placeholder
}
export {};
