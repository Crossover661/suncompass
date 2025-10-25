/**
 * This TypeScript file contains code to generate SVG chart of day length and sunrise/sunset/twilight times for an entire year.
 * "daylength_svg" generates an SVG file showing (from top to bottom) the lengths of day, civil twilight, nautical twilight, astronomical
 * twilight and night for an entire year
 */

/** Generates the opening of an SVG */
function svg_open(width: number, height: number) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
}

const svg_close = "</svg>";

/** Generates SVG code for a polygon from an array of points, with the given fill and stroke colors. */
function polygon_from_array(
    points: number[][], // array of points
    fill_color: string = "none", // hexadecimal value representing fill color ("none" if no fill)
    stroke_color: string = "none", // hexadecimal value representing stroke color ("none" if no stroke)
    stroke_width: number = 0
): string
{
    const ptsAttr = points.map(([x,y]) => `${x},${y}`).join(" "); // format the "x,y x,y ..." string
    return `<polygon points="${ptsAttr}" fill="${fill_color}" stroke="${stroke_color}" stroke-width="${stroke_width}"/>\n`;
}

/** Generates SVG code for a rectangle with the top-left corner at the given x and y cordinates, and the given width, height,
 * fill and stroke colors. */
function rectangle_svg(x: number, y: number, width: number, height: number, fill_color: string = "none", stroke_color: string = "none",
    stroke_width: number = 0
) {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill_color}" stroke="${stroke_color}"` +
    ` stroke-width="${stroke_width}"/>\n`
}

/** Generates SVG code for a text box with the given text, centered at the given x and y coordinate, with the given font and font size. 
 * Text anchor can be "start" (left-aligned), "middle" (centered), or "end" (right-aligned). Alignment baseline can be either 
 * "text-before-edge" (top-aligned), "middle" (centered), or "text-after-edge" (bottom-aligned). */
function text_svg(
    text: string, 
    x: number, 
    y: number, 
    font_size: number, 
    font: string, 
    text_color: string, 
    text_anchor: string,
    alignment_baseline: string
) {
    return `<text x="${x}" y="${y}" font-family="${font}" font-size="${font_size}" text-anchor="${text_anchor}"`
    + ` alignment-baseline="${alignment_baseline}" fill="${text_color}">` + text + `</text>\n`;
}

/** Generates an SVG line from (x1, y1) to (x2, y2) with the given color and width. */
function line_svg(x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" />\n`;
}

/** Returns an array of month abbreviations in the given language (represented by a language code, such as "en" for English, "es" for
 * Spanish, or "zh" for Mandarin Chinese). So far, there is only English - I plan to add more when I localize the site. */
function months(language: string = "en") {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

/** Edges of the months, used for drawing gridlines. */
function month_edges(leap_year: boolean = false) {
    if (leap_year) {return [0,30.5,59.5,90.5,120.5,151.5,181.5,212.5,243.5,273.5,304.5,334.5,365];}
    else {return [0,30.5,58.5,89.5,119.5,150.5,180.5,211.5,242.5,272.5,303.5,333.5,364];}
}

export function daylength_svg(
    lengths: number[][], // lengths from "lengths" function in suncalc.ts
    svg_width: number = 1000, // width of the chart (not the entire SVG file)
    svg_height: number = 500, // height of the chart (not the entire SVG file)
    language: string = "en",
    background_color: string = "#ffffff",
    text_size: number = 12,
    font: string = "Arial",
    text_color: string = "#000000",
    show_gridlines: boolean = true,
    grid_interval: number = 2,
    grid_color: string = "#808080",
    gridline_width: number = 0.5,
    colors: string[] = ["#80c0ff", "#0060c0", "#004080", "#002040", "#000000"],
    left_padding: number = 25,
    right_padding: number = 10,
    top_padding: number = 10,
    bottom_padding: number = 25
): string
{
    const days = lengths.length; // 365 days for common years, 366 for leap years
    const DAY_LENGTH = 86400000; // milliseconds in a day

    /** sum of first n values of array */
    function array_sum(array: number[], n: number = array.length) {
        let sum = 0;
        for (let i=0; i<n; i++) {sum += array[i];}
        return sum;
    }

    /** x-coordinate representing given day */
    function xCoord(dayNumber: number) {return left_padding + svg_width * (dayNumber / (days - 1));}

    /** y-coordinate representing day length */
    function yCoord(dayLength: number) {return top_padding + svg_height * (1 - dayLength / DAY_LENGTH);}

    let dLengths = []; // day lengths
    let cLengths = []; // day + civil twilight lengths
    let nLengths = []; // day + civil + nautical twilight lengths
    let aLengths = []; // day + civil + nautical + astronomical twilight lengths

    for (let l of lengths) {
        dLengths.push(l[0]);
        cLengths.push(l[1]);
        nLengths.push(l[2]);
        aLengths.push(l[3]);
    }

    let dp: number[][][] = [[]]; // day polygons
    let cp: number[][][] = [[]]; // civil twilight polygons
    let np: number[][][] = [[]]; // nautical twilight polygons
    let ap: number[][][] = [[]]; // astronomical twilight polygons

    // generate polygons
    for (let i=0; i<days; i++) {
        // generate day polygons
        if (dLengths[i] > 0) {
            if (i == 0) {dp[0].push([left_padding, top_padding+svg_height], [left_padding, yCoord(dLengths[0])]);}
            else if (dLengths[i-1] == 0) {dp.push([[xCoord(i-0.5), top_padding+svg_height], [xCoord(i), yCoord(dLengths[i])]]);}
            else {dp[dp.length-1].push([xCoord(i), yCoord(dLengths[i])]);}
            if (i == days-1) {dp[dp.length-1].push([left_padding+svg_width, top_padding+svg_height]);}
        }
        else if (i != 0 && dLengths[i-1] > 0) {
            dp[dp.length-1].push([xCoord(i+0.5), top_padding+svg_height]);
        }

        // generate civil twilight polygons
        if (cLengths[i] > 0) {
            if (i == 0) {cp[0].push([left_padding, top_padding+svg_height], [left_padding, yCoord(cLengths[0])]);}
            else if (cLengths[i-1] == 0) {cp.push([[xCoord(i-0.5), top_padding+svg_height], [xCoord(i), yCoord(cLengths[i])]]);}
            else {cp[cp.length-1].push([xCoord(i), yCoord(cLengths[i])]);}
            if (i == days-1) {cp[cp.length-1].push([left_padding+svg_width, top_padding+svg_height]);}
        }
        else if (i != 0 && cLengths[i-1] > 0) {
            cp[cp.length-1].push([xCoord(i+0.5), top_padding+svg_height]);
        }

        // generate nautical twilight polygons
        if (nLengths[i] > 0) {
            if (i == 0) {np[0].push([left_padding, top_padding+svg_height], [left_padding, yCoord(nLengths[0])]);}
            else if (nLengths[i-1] == 0) {np.push([[xCoord(i-0.5), top_padding+svg_height], [xCoord(i), yCoord(nLengths[i])]]);}
            else {np[np.length-1].push([xCoord(i), yCoord(nLengths[i])]);}
            if (i == days-1) {np[np.length-1].push([left_padding+svg_width, top_padding+svg_height]);}
        }
        else if (i != 0 && nLengths[i-1] > 0) {
            np[np.length-1].push([xCoord(i+0.5), top_padding+svg_height]);
        }

        // generate astronomical twilight polygons
        if (aLengths[i] > 0) {
            if (i == 0) {ap[0].push([left_padding, top_padding+svg_height], [left_padding, yCoord(aLengths[0])]);}
            else if (aLengths[i-1] == 0) {ap.push([[xCoord(i-0.5), top_padding+svg_height], [xCoord(i), yCoord(aLengths[i])]]);}
            else {ap[ap.length-1].push([xCoord(i), yCoord(aLengths[i])]);}
            if (i == days-1) {ap[ap.length-1].push([left_padding+svg_width, top_padding+svg_height]);}
        }
        else if (i != 0 && aLengths[i-1] > 0) {
            ap[ap.length-1].push([xCoord(i+0.5), top_padding+svg_height]);
        }
    }

    // construct SVG diagram
    let image_width = svg_width + left_padding + right_padding;
    let image_height = svg_height + top_padding + bottom_padding;
    let svg_string = svg_open(image_width, image_height);
    svg_string += rectangle_svg(0, 0, image_width, image_height, background_color); // white background
    svg_string += rectangle_svg(left_padding, top_padding, svg_width, svg_height, colors[4]); // night
    for (let polygon of ap) {svg_string += polygon_from_array(polygon, colors[3]);} // astronomical twilight
    for (let polygon of np) {svg_string += polygon_from_array(polygon, colors[2]);} // nautical twilight
    for (let polygon of cp) {svg_string += polygon_from_array(polygon, colors[1]);} // civil twilight
    for (let polygon of dp) {svg_string += polygon_from_array(polygon, colors[0]);} // daylight

    // draw y-axis and gridlines
    let x1 = show_gridlines ? left_padding : left_padding - 5;
    let x2 = show_gridlines ? left_padding + svg_width : left_padding;
    for (let i=0; i<=24; i+=grid_interval) {
        let y = yCoord((i/24)*DAY_LENGTH);
        svg_string += text_svg(String(i), x1-5, y, text_size, font, text_color, "end", "middle");
        svg_string += line_svg(x1, y, x2, y, grid_color, gridline_width);
    }

    // draw x-axis and gridlines
    let y1 = show_gridlines ? top_padding : top_padding + svg_height;
    let y2 = show_gridlines ? top_padding + svg_height : top_padding + svg_height + 5;
    for (let i=0; i<12; i++) {
        let x = xCoord(month_edges(days != 365)[i]);
        let xText = (x + xCoord(month_edges(days != 365)[i+1]))/2;
        svg_string += text_svg(months(language)[i], xText, top_padding+svg_height+5, text_size, font, text_color, "middle", "text-before-edge");
        svg_string += line_svg(x, y1, x, y2, grid_color, gridline_width);
    }
    svg_string += line_svg(left_padding+svg_width, y1, left_padding+svg_width, y2, grid_color, gridline_width);

    // complete SVG diagram
    svg_string += svg_close;
    return svg_string;
}