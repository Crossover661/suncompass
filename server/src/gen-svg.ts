/**
 * This TypeScript file contains code to generate SVG chart of day length and sunrise/sunset/twilight times for an entire year.
 * "daylength_svg" generates an SVG file showing (from top to bottom) the lengths of day, civil twilight, nautical twilight, astronomical
 * twilight and night for an entire year
 */

import { isNullishCoalesce, ScriptSnapshot } from "../../node_modules/typescript/lib/typescript.js";
import SunTime from "./SunTime.js";
import {clamp, convertToMS} from "./mathfuncs.js";
import {intervals_svg, lengths} from "./suncalc.js";
import {DateTime} from "luxon";

const svg_close = "</svg>";
const sun_colors = ["#80c0ff", "#0060c0", "#004080", "#002040", "#000000"];
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

/** Generates SVG code for a polyline from an array of points with the specified stroke color, width, and precision (digits after the
 * decimal point in the coordinates). */
function polyline_from_array(points: number[][], color: string = "#000000", width: number = 1, precision: number = 2): string {
    const ptsAttr = points.map(([x,y]) => `${x.toFixed(precision)},${y.toFixed(precision)}`).join(" "); // format the "x,y x,y ..." string
    return `<polyline points="${ptsAttr}" fill="none" stroke="${color}" stroke-width="${width}"/>\n`;
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
    if (leap_year) {return [0,31,60,91,121,152,182,213,244,274,305,335,366];}
    else {return [0,31,59,90,120,151,181,212,243,273,304,334,365];}
}

type Seg = { a: number[]; b: number[] };

// EPS for key-stability with fractional coords
const SNAP = 1e-6;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

function intervals_to_polygon(intervals: number[][][]): number[][][] {
    const normalizeSpans = (spans: number[][]): number[][] => {
        if (!spans || spans.length === 0) return [];
        const s = spans
            .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number])
            .sort((u, v) => (u[0] - v[0]) || (u[1] - v[1]));
        const out: number[][] = [];
        for (const [a, b] of s) {
            if (out.length === 0 || a > out[out.length - 1][1]) {
                out.push([a, b]);
            } else {
                out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
            }
        }
        return out;
    };

    // symmetric difference of two disjoint, sorted span lists
    const xorSpans = (A: number[][], B: number[][]): number[][] => {
        const evts: { y: number; d: number }[] = [];
        for (const [a, b] of A) { evts.push({ y: a, d: +1 }, { y: b, d: -1 }); }
        for (const [a, b] of B) { evts.push({ y: a, d: +1 }, { y: b, d: -1 }); }
        evts.sort((u, v) => (u.y - v.y) || (v.d - u.d)); // starts before ends at same y
        const out: number[][] = [];
        let inside = 0;
        let y0 = 0;
        for (const { y, d } of evts) {
            if (inside === 1) out.push([y0, y]);
            inside = (inside + d) & 1;
            y0 = y;
        }
        return out;
    };

    const keyOf = (p: number[]) => `${snap(p[0])}:${snap(p[1])}`;

    const segKey = (u: number[], v: number[]) => {
        const ux = snap(u[0]), uy = snap(u[1]);
        const vx = snap(v[0]), vy = snap(v[1]);
        return (ux < vx || (ux === vx && uy <= vy))
            ? `${ux}:${uy}->${vx}:${vy}`
            : `${vx}:${vy}->${ux}:${uy}`;
    };

    const addAdj = (adj: Map<string, number[][]>, u: number[], v: number[]) => {
        const ku = keyOf(u), kv = keyOf(v);
        if (!adj.has(ku)) adj.set(ku, []);
        if (!adj.has(kv)) adj.set(kv, []);
        adj.get(ku)!.push([snap(v[0]), snap(v[1])]);
        adj.get(kv)!.push([snap(u[0]), snap(u[1])]);
    };

    // ---- build segments ----
    const W = intervals.length;
    const cols = Array.from({ length: W }, (_, x) => normalizeSpans(intervals[x] || []));

    const horizontal: Seg[] = [];
    for (let x = 0; x < W; x++) {
        for (const [a, b] of cols[x]) {
            horizontal.push({ a: [x, a], b: [x + 1, a] }); // bottom cap
            horizontal.push({ a: [x, b], b: [x + 1, b] }); // top cap
        }
    }

    const vertical: Seg[] = [];
    for (let x = 0; x <= W; x++) {
        const L = x > 0 ? cols[x - 1] : [];
        const R = x < W ? cols[x] : [];
        const diff = xorSpans(L, R);
        for (const [a, b] of diff) {
            vertical.push({ a: [x, a], b: [x, b] });
        }
    }

    const segs: Seg[] = vertical.concat(horizontal).map(({ a, b }) => ({
        a: [snap(a[0]), snap(a[1])],
        b: [snap(b[0]), snap(b[1])]
    }));

    // ---- stitch into rings ----
    const adj = new Map<string, number[][]>();
    for (const { a, b } of segs) addAdj(adj, a, b);

    const used = new Set<string>();
    const polygons: number[][][] = [];

    for (const { a, b } of segs) {
        const startEdge = segKey(a, b);
        if (used.has(startEdge)) continue;

        // seed walk with the exact edge (a -> b)
        used.add(startEdge);

        const polygon: number[][] = [];
        polygon.push([snap(a[0]), snap(a[1])]);

        let prev = [snap(a[0]), snap(a[1])];
        let curr = [snap(b[0]), snap(b[1])];

        while (true) {
            polygon.push(curr);

            const nbrs = adj.get(keyOf(curr)) || [];
            // choose neighbor that's NOT prev, prefer the one whose edge isn't used yet
            let next: number[] | undefined;
            for (const cand of nbrs) {
                if (cand[0] === prev[0] && cand[1] === prev[1]) continue;
                const k = segKey(curr, cand);
                if (!used.has(k)) { next = cand; break; }
            }
            if (!next) break; // should not happen if all loops are closed

            used.add(segKey(curr, next));
            prev = curr;
            curr = next;

            if (curr[0] === polygon[0][0] && curr[1] === polygon[0][1]) break; // closed
        }

        if (polygon.length >= 4) {polygons.push(polygon);}
    }

    return polygons;
}

/**
 * Returns a string containing an SVG diagram for either day/twilight/night lengths throughout the year, or the times of day in which
 * day, night, and each stage of twilight occur.
 * @param sun_events Values of "allSunEvents" for each day of the year.
 * @param type Set to "length" to generate a day/night/twilight length chart, or "rise-set" to generate a chart with times of day.
 * @param solstices_equinoxes Solstices and equinoxes for the given year, as an array of four DateTimes. They will appear as green lines on the diagram.
 * @param svg_width Width of the chart (not the entire SVG file). Defaults to 1000.
 * @param svg_height Height of the chart (not the entire SVG file). Defaults to 500.
 * @param left_padding Padding to the left of the carpet plot. Defaults to 25 pixels.
 * @param right_padding Padding to the right of the carpet plot. Defaults to 10 pixels.
 * @param top_padding Padding above the carpet plot. Defaults to 10 pixels.
 * @param bottom_padding Padding below the carpet plot. Defaults to 25 pixels.
 * @param text_size The font size to use for the axis labels. Defaults to 12.
 * @param font The font family to use for the axis labels. Defaults to Arial.
 * @param text_color Color of text in axis labels. Defaults to #000000 (black).
 * @param background_color The background color of the SVG file. Defaults to #ffffff (white).
 * @param language The language used for month abbreviations, represented as a 2-letter code for example "en" for English, "es" for Spanish
 * or "zh" for Mandarin Chinese. Defaults to "en" (English).
 * @param show_gridlines Whether to show the gridlines overlaid on the carpet plot. Defaults to "true".
 * @param grid_interval Y axis interval. Defaults to 2 (i.e. 2 hours between gridlines)
 * @param grid_color Colors of gridlines. Defaults to #808080 (medium gray).
 * @param gridline_width Width of gridlines. Defaults to 0.5 (pixels).
 * @returns A string for the carpet plot, with gridlines and axis labels, that can be saved into an SVG file.
 * The total width of the SVG file is equal to svg_width + left_padding + right_padding. The height is equal to svg_height + top_padding +
 * bottom_padding.
 */
export function generate_svg(
    sun_events: SunTime[][],
    type: string,
    solstices_equinoxes: DateTime[] = [],
    svg_width: number = 1000,
    svg_height: number = 500,
    left_padding: number = 25,
    right_padding: number = 10,
    top_padding: number = 10,
    bottom_padding: number = 25,
    text_size: number = 12,
    font: string = "Arial",
    text_color: string = "#000000",
    background_color: string = "#ffffff",
    language: string = "en",
    show_gridlines: boolean = true,
    grid_interval: number = 2,
    grid_color: string = "#808080",
    gridline_width: number = 0.5,
): string
{
    const days = sun_events.length; // 365 days for common years, 366 for leap years

    /** x-coordinate representing given day */
    function xCoord(dayNumber: number) {return left_padding + svg_width * (dayNumber / days);}

    /** y-coordinate representing day length */
    function yCoord(dayLength: number) {return top_padding + svg_height * (1 - dayLength / DAY_LENGTH);}

    function durations_to_array(durations: number[]): number[][][] {
        let p: number[][][] = [[]]; // p is short for polygons
        for (let i=0; i<days; i++) {
            if (durations[i] > 0) {
                if (i == 0) {p[0].push(
                    [left_padding, yCoord(0)], 
                    [left_padding, yCoord(durations[0])],
                    [xCoord(1), yCoord(durations[0])]);
                }
                else if (durations[i-1] == 0) {
                    p.push([[xCoord(i), yCoord(0)], [xCoord(i), yCoord(durations[i])]]);
                }
                else {p[p.length-1].push([xCoord(i), yCoord(durations[i])], [xCoord(i+1), yCoord(durations[i])]);}
                if (i == days-1) {p[p.length-1].push([left_padding+svg_width, top_padding+svg_height]);}
            }
            else if (i != 0 && durations[i-1] > 0) {
                p[p.length-1].push([xCoord(i+1), top_padding+svg_height]);
            }
        }
        return p;
    }

    /** Used to draw lines representing solar noon on the graph. */
    function solar_noon_lines() {
        let solar_noons: number[][] = [];
        for (let events of sun_events) {
            let cur_day: number[] = [];
            for (let event of events) {
                if (event.eventType == "Solar Noon") {cur_day.push(convertToMS(event.time));}
            }
            solar_noons.push(cur_day);
        }
        
        let groups: number[][][] = []; // a group of multiple lines (number[][]), each representing a cluster of solar noons
        for (let solar_noon of solar_noons[0]) {
            groups.push([[0, solar_noon]]);
        }
        for (let i=1; i<days; i++) { // for each day of the year
            for (let noon of solar_noons[i]) {
                let flag: boolean = false;
                for (let group of groups) {
                    if (Math.abs(noon - group[group.length-1][1]) < DAY_LENGTH/48 && group[group.length-1][0] == i-1) {
                        flag = true;
                        group.push([i, noon]);
                        break;
                    }
                }
                if (!flag) {groups.push([[i, noon]]);}
            }
        }
        for (let line of groups) { // convert to SVG coordinates
            for (let point of line) {
                point[0] = xCoord(point[0]);
                point[1] = yCoord(point[1]);
            }
        }
        let lines: string[] = [];
        for (let line of groups) {lines.push(polyline_from_array(line, "#ff0000"));}
        return lines;
    }

    /** Used to draw lines representing solar midnight on the graph. */
    function solar_midnight_lines() {
        let solar_midnights: number[][] = [];
        for (let events of sun_events) {
            let cur_day: number[] = [];
            for (let event of events) {
                if (event.eventType == "Solar Midnight") {cur_day.push(convertToMS(event.time));}
            }
            solar_midnights.push(cur_day);
        }
        
        let groups: number[][][] = []; // a group of multiple lines (number[][]), each representing a cluster of solar midnights
        for (let solar_midnight of solar_midnights[0]) {
            groups.push([[0, solar_midnight]]);
        }
        for (let i=1; i<days; i++) { // for each day of the year
            for (let midnight of solar_midnights[i]) {
                let flag: boolean = false;
                for (let group of groups) {
                    if (Math.abs(midnight - group[group.length-1][1]) < DAY_LENGTH/48 && group[group.length-1][0] == i-1) {
                        flag = true;
                        group.push([i, midnight]);
                        break;
                    }
                }
                if (!flag) {groups.push([[i, midnight]]);}
            }
        }
        for (let line of groups) { // convert to SVG coordinates
            for (let point of line) {
                point[0] = xCoord(point[0]);
                point[1] = yCoord(point[1]);
            }
        }
        let lines: string[] = [];
        for (let line of groups) {lines.push(polyline_from_array(line, "#0000ff"));}
        return lines;
    }

    function to_polygons(intervals: number[][][], color: string): string[] {
        let polygons = intervals_to_polygon(intervals);
        for (let polygon of polygons) {
            for (let point of polygon) {
                point[0] = xCoord(point[0]);
                point[1] = yCoord(point[1]);
            }
        }
        let strings: string[] = [];
        for (let polygon of polygons) {strings.push(polygon_from_array(polygon, color));}
        return strings;
    }

    // generate SVG diagram background
    let image_width = svg_width + left_padding + right_padding;
    let image_height = svg_height + top_padding + bottom_padding;
    let svg_string = svg_open(image_width, image_height);
    svg_string += rectangle_svg(0, 0, image_width, image_height, background_color); // white background

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
        svg_string += rectangle_svg(left_padding, top_padding, svg_width, svg_height, sun_colors[4]); // night
        for (let polygon of ap) {svg_string += polygon_from_array(polygon, sun_colors[3]);} // astronomical twilight
        for (let polygon of np) {svg_string += polygon_from_array(polygon, sun_colors[2]);} // nautical twilight
        for (let polygon of cp) {svg_string += polygon_from_array(polygon, sun_colors[1]);} // civil twilight
        for (let polygon of dp) {svg_string += polygon_from_array(polygon, sun_colors[0]);} // daylight
    }
    else if (type == "rise-set") { // sunrise, sunset, dusk, dawn plot
        let a_intervals: number[][][] = []; // intervals of astronomical twilight or brighter
        let n_intervals: number[][][] = []; // intervals of nautical twilight or brighter
        let c_intervals: number[][][] = []; // intervals of civil twilight or brighter
        let d_intervals: number[][][] = []; // intervals of daylight

        for (let event of sun_events) {
            let int = intervals_svg(event);
            a_intervals.push(int[3]);
            n_intervals.push(int[2]);
            c_intervals.push(int[1]);
            d_intervals.push(int[0]);
        }
        
        let a_polygons = to_polygons(a_intervals, sun_colors[3]); // astronomical twilight
        let n_polygons = to_polygons(n_intervals, sun_colors[2]); // nautical twilight
        let c_polygons = to_polygons(c_intervals, sun_colors[1]); // civil twilight
        let d_polygons = to_polygons(d_intervals, sun_colors[0]); // daylight

        let all_polygons = [...a_polygons, ...n_polygons, ...c_polygons, ...d_polygons];

        svg_string += rectangle_svg(left_padding, top_padding, svg_width, svg_height, sun_colors[4]); // night
        for (let polygon of all_polygons) {svg_string += polygon;} // twilight + daylight

        let noon_midnight_lines = [...solar_midnight_lines(), ...solar_noon_lines()];
        for (let line of noon_midnight_lines) {svg_string += line;}
    }
    
    // draw solstices and equinoxes as green lines
    for (let date of solstices_equinoxes) {
        let new_year = DateTime.fromISO(`${date.year}-01-01`, {zone: date.zone});
        let x = xCoord(date.diff(new_year, ['days', 'hours']).days + 0.5);
        svg_string += line_svg(x, top_padding, x, top_padding+svg_height, "#00c000", 1);
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