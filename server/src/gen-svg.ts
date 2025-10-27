/**
 * This TypeScript file contains code to generate SVG chart of day length and sunrise/sunset/twilight times for an entire year.
 * "daylength_svg" generates an SVG file showing (from top to bottom) the lengths of day, civil twilight, nautical twilight, astronomical
 * twilight and night for an entire year
 */

import SunTime from "./SunTime.js";
import {intervals_svg, lengths} from "./suncalc.js";

const svg_close = "</svg>";
const DAY_LENGTH = 86400000; // milliseconds in a day

/** Generates the opening of an SVG */
function svg_open(width: number, height: number) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
}

/**
 * Generates SVG code for a polygon from an array of points, with the specified fill color, stroke color and stroke width
 * @param points An array of [x, y] points, ex: [[0, 0], [0, 100], [100, 0]]
 * @param fill_color Fill color of polygon.
 * @param stroke_color Stroke color of polygon.
 * @param stroke_width Stroke width of polygon.
 * @param precision Number of digits after the decimal point to round pixel coordinates.
 * @returns SVG string for the given polygon.
 */
function polygon_from_array(
    points: number[][],
    fill_color: string = "none",
    stroke_color: string = "none",
    stroke_width: number = 0,
    precision: number = 2,
): string
{
    const ptsAttr = points.map(([x,y]) => `${x.toFixed(precision)},${y.toFixed(precision)}`).join(" "); // format the "x,y x,y ..." string
    return `<polygon points="${ptsAttr}" fill="${fill_color}" stroke="${stroke_color}" stroke-width="${stroke_width}"/>\n`;
}

/** Generates SVG code for a rectangle with the top-left corner at the given x and y cordinates, and the given width, height,
 * fill and stroke colors. */
function rectangle_svg(x: number, y: number, width: number, height: number, fill_color: string = "none", stroke_color: string = "none",
    stroke_width: number = 0
) {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill_color}" stroke="${stroke_color}" stroke-width="${stroke_width}"/>\n`
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
    alignment_baseline: string,
    precision: number = 2
) {
    return `<text x="${x.toFixed(precision)}" y="${y.toFixed(precision)}" font-family="${font}" font-size="${font_size}"`
    + ` text-anchor="${text_anchor}" alignment-baseline="${alignment_baseline}" fill="${text_color}">${text}</text>\n`;
}

/** Generates an SVG line from (x1, y1) to (x2, y2) with the given color and width. */
function line_svg(x1: number, y1: number, x2: number, y2: number, color: string, width: number, precision: number = 2) {
    return `<line x1="${x1.toFixed(precision)}" y1="${y1.toFixed(precision)}" x2="${x2.toFixed(precision)}" y2="${y2.toFixed(precision)}"`
    + ` stroke="${color}" stroke-width="${width}" />\n`;
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

/**
 * Returns a string containing an SVG diagram for either day/twilight/night lengths throughout the year, or the times of day in which
 * day, night, and each stage of twilight occur.
 * @param sun_events Values of "allSunEvents" for each day of the year.
 * @param type Set to "length" to generate a day/night/twilight length chart, or "rise-set" to generate a chart with times of day.
 * @param svg_width Width of the chart (not the entire SVG file). Defaults to 1000.
 * @param svg_height Height of the chart (not the entire SVG file). Defaults to 500.
 * @param language The language used for month abbreviations, represented as a 2-letter code for example "en" for English, "es" for Spanish
 * or "zh" for Mandarin Chinese. Defaults to "en" (English).
 * @param background_color The background color of the SVG file. Defaults to #ffffff (white).
 * @param text_size The font size to use for the axis labels. Defaults to 12.
 * @param font The font family to use for the axis labels. Defaults to Arial.
 * @param text_color Color of text in axis labels. Defaults to #000000 (black).
 * @param show_gridlines Whether to show the gridlines overlaid on the carpet plot. Defaults to "true".
 * @param grid_interval Y axis interval. Defaults to 2 (i.e. 2 hours between gridlines)
 * @param grid_color Colors of gridlines. Defaults to #808080 (medium gray).
 * @param gridline_width Width of gridlines. Defaults to 0.5 (pixels).
 * @param colors An array of 5 strings with the hex colors to use for daylight, civil twilight, nautical twilight, astronomical twilight
 * and night respectively. Defaults to ["#80c0ff", "#0060c0", "#004080", "#002040", "#000000"].
 * @param left_padding Padding to the left of the carpet plot. Defaults to 25 pixels.
 * @param right_padding Padding to the right of the carpet plot. Defaults to 10 pixels.
 * @param top_padding Padding above the carpet plot. Defaults to 10 pixels.
 * @param bottom_padding Padding below the carpet plot. Defaults to 25 pixels.
 * @returns A string for the carpet plot, with gridlines and axis labels, that can be saved into an SVG file.
 * The total width of the SVG file is equal to svg_width + left_padding + right_padding. The height is equal to svg_height + top_padding +
 * bottom_padding.
 */
export function generate_svg(
    sun_events: SunTime[][],
    type: string,
    svg_width: number = 1000,
    svg_height: number = 500,
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
    const days = sun_events.length; // 365 days for common years, 366 for leap years

    /** x-coordinate representing given day */
    function xCoord(dayNumber: number) {return left_padding + svg_width * (dayNumber / (days - 1));}

    /** y-coordinate representing day length */
    function yCoord(dayLength: number) {return top_padding + svg_height * (1 - dayLength / DAY_LENGTH);}

    /** Determines whether two time intervals are contiguous (with DST adjustment) */
    function interval_contiguous([a1, a2]: number[], [b1, b2]: number[]) {
        return ((a1 <= b2 && b1 <= a2) || (a1+DAY_LENGTH/24 <= b2 && b1 <= a2+DAY_LENGTH/24) || 
        (a1-DAY_LENGTH/24 <= b2 && b1 <= a2-DAY_LENGTH/24));
    }

    function durations_to_array(durations: number[]): number[][][] {
        let p: number[][][] = [[]]; // p is short for polygons
        for (let i=0; i<days; i++) {
            if (durations[i] > 0) {
                if (i == 0) {p[0].push([left_padding, top_padding+svg_height], [left_padding, yCoord(durations[0])]);}
                else if (durations[i-1] == 0) {p.push([[xCoord(i-0.5), top_padding+svg_height], [xCoord(i), yCoord(durations[i])]]);}
                else {p[p.length-1].push([xCoord(i), yCoord(durations[i])]);}
                if (i == days-1) {p[p.length-1].push([left_padding+svg_width, top_padding+svg_height]);}
            }
            else if (i != 0 && durations[i-1] > 0) {
                p[p.length-1].push([xCoord(i+0.5), top_padding+svg_height]);
            }
        }
        return p;
    }

    // generate SVG diagram background
    let image_width = svg_width + left_padding + right_padding;
    let image_height = svg_height + top_padding + bottom_padding;
    let svg_string = svg_open(image_width, image_height);
    svg_string += rectangle_svg(0, 0, image_width, image_height, background_color); // white background
    svg_string += rectangle_svg(left_padding, top_padding, svg_width, svg_height, colors[4]); // night

    if (type == "length") { // day/twilight/night length plot
        let dLengths: number[] = []; // day lengths
        let cLengths: number[] = []; // day + civil twilight lengths
        let nLengths: number[] = []; // day + civil + nautical twilight lengths
        let aLengths: number[] = []; // day + civil + nautical + astronomical twilight lengths
        for (let e of sun_events) {
            let dur = lengths(e);
            dLengths.push(dur[0]);
            cLengths.push(dur[1]);
            nLengths.push(dur[2]);
            aLengths.push(dur[3]);
        }
        let dp = durations_to_array(dLengths); // day polygons
        let cp = durations_to_array(cLengths); // civil twilight polygons
        let np = durations_to_array(nLengths); // nautical twilight polygons
        let ap = durations_to_array(aLengths); // astronomical twilight polygons
        
        // construct SVG day length diagram
        for (let polygon of ap) {svg_string += polygon_from_array(polygon, colors[3]);} // astronomical twilight
        for (let polygon of np) {svg_string += polygon_from_array(polygon, colors[2]);} // nautical twilight
        for (let polygon of cp) {svg_string += polygon_from_array(polygon, colors[1]);} // civil twilight
        for (let polygon of dp) {svg_string += polygon_from_array(polygon, colors[0]);} // daylight
    }
    else { // sunrise, sunset, dusk, dawn plot
    }

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
        svg_string += text_svg(months(language)[i], xText, top_padding+svg_height+12, text_size, font, text_color, "middle", "middle");
        svg_string += line_svg(x, y1, x, y2, grid_color, gridline_width);
    }
    svg_string += line_svg(left_padding+svg_width, y1, left_padding+svg_width, y2, grid_color, gridline_width);

    // complete SVG diagram
    svg_string += svg_close;
    return svg_string;
}