/**
 * This TypeScript file contains code to generate SVG chart of day length and sunrise/sunset/twilight times for an entire year.
 * "generateSvg" generates an SVG file showing (from top to bottom) the lengths of day, civil twilight, nautical twilight, astronomical
 * twilight and night for an entire year
 */

import { constants } from "buffer";
import { isNullishCoalesce, ScriptSnapshot } from "../../node_modules/typescript/lib/typescript.js";
import SunTime from "./SunTime.js";
import {clamp, convertToMS, isCollinear, toFixedS} from "./mathfuncs.js";
import {intervalsSvg, lengths, getSolstEq} from "./suncalc.js";
import {DateTime} from "luxon";

const svgClose = "</svg>";
const sunColors = ["#80c0ff", "#0060c0", "#004080", "#002040", "#000000"];
const DAY_LENGTH = 86400000; // milliseconds in a day

/** Generates the opening of an SVG */
function svgOpen(width: number, height: number) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
}

/**
 * Generates SVG code for a polygon from an array of points, with the specified fill color, stroke color and stroke width
 * @param points An array of [x, y] points, ex: [[0, 0], [0, 100], [100, 0]]
 * @param fillColor Fill color of polygon.
 * @param strokeColor Stroke color of polygon.
 * @param strokeWidth Stroke width of polygon.
 * @param precision Number of digits after the decimal point to round pixel coordinates.
 * @returns SVG string for the given polygon.
 */
function polygonFromArray(
    points: number[][],
    fillColor: string = "none",
    strokeColor: string = "none",
    strokeWidth: number = 0,
    precision: number = 2,
): string
{
    const simplifiedPoints = simplifyCollinear(points); 
    const ptsAttr = simplifiedPoints.map(([x,y]) => `${toFixedS(x,precision)},${toFixedS(y,precision)}`).join(" "); // format the "x,y x,y ..." string
    return `<polygon points="${ptsAttr}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>\n`;
}

/** Generates SVG code for a polyline from an array of points with the specified stroke color, width, and precision (digits after the
 * decimal point in the coordinates). */
function polylineFromArray(points: number[][], color: string = "#000000", width: number = 1, precision: number = 2): string {
    const ptsAttr = points.map(([x,y]) => `${toFixedS(x,precision)},${toFixedS(y,precision)}`).join(" "); // format the "x,y x,y ..." string
    return `<polyline points="${ptsAttr}" fill="none" stroke="${color}" stroke-width="${width}"/>\n`;
}

/** Generates SVG code for a rectangle with the top-left corner at the given x and y cordinates, and the given width, height,
 * fill and stroke colors. */
function rectangleSvg(x: number, y: number, width: number, height: number, fillColor: string = "none", strokeColor: string = "none",
    strokeWidth: number = 0
) {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>\n`
}

/** Generates SVG code for a text box with the given text, centered at the given x and y coordinate, with the given font and font size. 
 * Text anchor can be "start" (left-aligned), "middle" (centered), or "end" (right-aligned). Alignment baseline can be either 
 * "text-before-edge" (top-aligned), "middle" (centered), or "text-after-edge" (bottom-aligned). */
function textSvg(
    text: string, 
    x: number, 
    y: number, 
    fontSize: number, 
    font: string, 
    textColor: string, 
    textAnchor: string,
    alignmentBaseline: string,
    precision: number = 2
) {
    return `<text x="${toFixedS(x,precision)}" y="${toFixedS(y,precision)}" font-family="${font}" font-size="${fontSize}pt"`
    + ` text-anchor="${textAnchor}" alignment-baseline="${alignmentBaseline}" fill="${textColor}">${text}</text>\n`;
}

/** Generates an SVG line from (x1, y1) to (x2, y2) with the given color and width. */
function lineSvg(x1: number, y1: number, x2: number, y2: number, color: string, width: number, precision: number = 2) {
    return `<line x1="${toFixedS(x1,precision)}" y1="${toFixedS(y1,precision)}" x2="${toFixedS(x2,precision)}" y2="${toFixedS(y2,precision)}"`
    + ` stroke="${color}" stroke-width="${width}"/>\n`;
}

/** Returns an array of month abbreviations in the given language (represented by a language code, such as "en" for English, "es" for
 * Spanish, or "zh" for Mandarin Chinese). So far, there is only English - I plan to add more when I localize the site. */
function months(language: string = "en") {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

/** Edges of the months, used for drawing gridlines. */
function monthEdges(leapYear: boolean = false) {
    if (leapYear) {return [0,31,60,91,121,152,182,213,244,274,305,335,366];}
    else {return [0,31,59,90,120,151,181,212,243,273,304,334,365];}
}

/** Simplifies a polygon or polyline (represented as points) to remove collinear points. */
function simplifyCollinear(points: number[][]) {
    if (points.length <= 2) {return points;}
    let newPoints = [points[0], points[1]];
    for (let i=2; i<points.length; i++) {
        let prev = newPoints[newPoints.length-2];
        let cur = newPoints[newPoints.length-1];
        let next = points[i];
        if (isCollinear(prev, cur, next)) {newPoints[newPoints.length-1] = next;}
        else {newPoints.push(next);}
    }
    return newPoints;
}

type Seg = { a: number[]; b: number[] };

// EPS for key-stability with fractional coords
const SNAP = 1e-6;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Convert a series of intervals into sets of points representing polygons. */
function intervalsToPolygon(intervals: number[][][]): number[][][] {
    const normalizeSpans = (spans: number[][]): number[][] => {
        if (!spans || spans.length === 0) return [];
        const s = spans.map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]).sort((u, v) => (u[0]-v[0]) || (u[1]-v[1]));
        const out: number[][] = [];
        for (const [a, b] of s) {
            if (out.length === 0 || a > out[out.length-1][1]) {out.push([a, b]);} 
            else {out[out.length - 1][1] = Math.max(out[out.length-1][1], b);}
        }
        return out;
    };
    // symmetric difference of two disjoint, sorted span lists
    const xorSpans = (A: number[][], B: number[][]): number[][] => {
        const evts: {y: number; d: number}[] = [];
        for (const [a, b] of A) {evts.push({ y: a, d: +1 }, { y: b, d: -1 });}
        for (const [a, b] of B) {evts.push({ y: a, d: +1 }, { y: b, d: -1 });}
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
        return (ux < vx || (ux === vx && uy <= vy)) ? `${ux}:${uy}->${vx}:${vy}` : `${vx}:${vy}->${ux}:${uy}`;
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
        for (const [a, b] of diff) {vertical.push({ a: [x, a], b: [x, b] });}
    }
    const segs: Seg[] = vertical.concat(horizontal).map(({ a, b }) => ({a: [snap(a[0]), snap(a[1])], b: [snap(b[0]), snap(b[1])]}));

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
 * @param sunEvents Values of "allSunEvents" for each day of the year.
 * @param type Set to "length" to generate a day/night/twilight length chart, or "rise-set" to generate a chart with times of day.
 * @param solsticesEquinoxes Solstices and equinoxes for the given year, as an array of four DateTimes. They will appear as green lines on the diagram.
 * @param svgWidth Width of the chart (not the entire SVG file) in pixels. Defaults to 1000.
 * @param svgHeight Height of the chart (not the entire SVG file) in pixels. Defaults to 500.
 * @param leftPadding Padding to the left of the carpet plot in pixels. Defaults to 25.
 * @param rightPadding Padding to the right of the carpet plot in pixels. Defaults to 10.
 * @param topPadding Padding above the carpet plot in pixels. Defaults to 10.
 * @param bottomPadding Padding below the carpet plot in pixels. Defaults to 25.
 * @param textSize The font size to use for the axis labels, in points. Defaults to 11.
 * @param font The font family to use for the axis labels. Defaults to Arial.
 * @param textColor Color of text in axis labels. Defaults to #000000 (black).
 * @param backgroundColor The background color of the SVG file. Defaults to #ffffff (white).
 * @param language The language used for month abbreviations, represented as a 2-letter code for example "en" for English, "es" for Spanish
 * or "zh" for Mandarin Chinese. Defaults to "en" (English).
 * @param gridInterval Y axis interval. Defaults to 2 (i.e. 2 hours between gridlines).
 * @param gridlineWidth Width of gridlines. Defaults to 0.5 (pixels).
 * @returns A string for the carpet plot, with gridlines and axis labels, that can be saved into an SVG file.
 * The total width of the SVG file is equal to svgWidth + leftPadding + rightPadding. The height is equal to svgHeight + topPadding +
 * bottomPadding.
 */
export function generateSvg(
    sunEvents: SunTime[][],
    type: string,
    svgWidth: number = 1100,
    svgHeight: number = 550,
    leftPadding: number = 25,
    rightPadding: number = 10,
    topPadding: number = 10,
    bottomPadding: number = 25,
    textSize: number = 11,
    font: string = "Arial",
    textColor: string = "#000000",
    backgroundColor: string = "#ffffff",
    language: string = "en",
    gridInterval: number = 2,
    gridlineWidth: number = 0.5,
): string
{
    const days = sunEvents.length; // 365 days for common years, 366 for leap years
    const gridColor: string = (type == "moon") ? "#000000" : "#808080"; // gridline color

    /** x-coordinate representing given day */
    function xCoord(dayNumber: number) {return leftPadding + svgWidth * (dayNumber / days);}

    /** y-coordinate representing day length */
    function yCoord(dayLength: number) {return topPadding + svgHeight * (1 - dayLength / DAY_LENGTH);}

    /** Converts a set of durations into an array of points representing a polyon. */
    function durationsToArray(durations: number[]): number[][][] {
        let p: number[][][] = [[]]; // p is short for polygons
        for (let i=0; i<days; i++) {
            if (durations[i] > 0) {
                if (i == 0 || durations[i-1] == 0) {p[0].push(
                    [xCoord(i), yCoord(0)], 
                    [xCoord(i), yCoord(durations[i])],
                    [xCoord(i+1), yCoord(durations[i])]);
                }
                else {p[p.length-1].push([xCoord(i), yCoord(durations[i])], [xCoord(i+1), yCoord(durations[i])]);}
                if (i == days-1) {p[p.length-1].push([xCoord(days), yCoord(0)]);}
            }
            else if (i != 0 && durations[i-1] > 0) {
                p[p.length-1].push([xCoord(i), yCoord(0)]);
            }
        }
        return p;
    }

    /** Used to draw lines representing solar noon on the graph. */
    function solarNoonLines() {
        let solarNoons: number[][] = [];
        for (let events of sunEvents) {
            let curDay: number[] = [];
            for (let event of events) {
                if (event.eventType == "Solar Noon") {curDay.push(convertToMS(event.time));}
            }
            solarNoons.push(curDay);
        }
        
        let groups: number[][][] = []; // a group of multiple lines (number[][]), each representing a cluster of solar noons
        for (let solarNoon of solarNoons[0]) {groups.push([[0, solarNoon]]);}
        for (let i=1; i<days; i++) { // for each day of the year
            for (let noon of solarNoons[i]) { // for each solar noon of the day (may be more than 1)
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
                point[0] = xCoord(point[0]+0.5);
                point[1] = yCoord(point[1]);
            }
        }
        let lines: string[] = [];
        for (let line of groups) {lines.push(polylineFromArray(line, "#ff0000"));}
        return lines;
    }

    /** Used to draw lines representing solar midnight on the graph. */
    function solarMidnightLines() {
        let solarMidnights: number[][] = [];
        for (let events of sunEvents) {
            let curDay: number[] = [];
            for (let event of events) {
                if (event.eventType == "Solar Midnight") {curDay.push(convertToMS(event.time));}
            }
            solarMidnights.push(curDay);
        }
        
        let groups: number[][][] = []; // a group of multiple lines (number[][]), each representing a cluster of solar midnights
        for (let solarMidnight of solarMidnights[0]) {
            groups.push([[0, solarMidnight]]);
        }
        for (let i=1; i<days; i++) { // for each day of the year
            for (let midnight of solarMidnights[i]) { // for each solar midnight of the day (may be more than 1)
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
                point[0] = xCoord(point[0]+0.5);
                point[1] = yCoord(point[1]);
            }
        }
        let lines: string[] = [];
        for (let line of groups) {lines.push(polylineFromArray(line, "#0000ff"));}
        return lines;
    }

    function toPolygons(intervals: number[][][], color: string): string[] {
        let polygons = intervalsToPolygon(intervals);
        for (let polygon of polygons) {
            for (let point of polygon) {
                point[0] = xCoord(point[0]);
                point[1] = yCoord(point[1]);
            }
        }
        let strings: string[] = [];
        for (let polygon of polygons) {strings.push(polygonFromArray(polygon, color));}
        return strings;
    }

    // generate SVG opening and background
    let imageWidth = svgWidth + leftPadding + rightPadding;
    let imageHeight = svgHeight + topPadding + bottomPadding;
    let svgString = svgOpen(imageWidth, imageHeight);
    svgString += rectangleSvg(0, 0, imageWidth, imageHeight, backgroundColor); // white background

    if (type == "length") { // day/twilight/night length plot
        let dLengths: number[] = []; // day lengths
        let cLengths: number[] = []; // day + civil twilight lengths
        let nLengths: number[] = []; // day + civil + nautical twilight lengths
        let aLengths: number[] = []; // day + civil + nautical + astronomical twilight lengths
        for (let e of sunEvents) {
            let dur = lengths(e);
            dLengths.push(dur[0]);
            cLengths.push(dur[1]);
            nLengths.push(dur[2]);
            aLengths.push(dur[3]);
        }
        let dp = durationsToArray(dLengths); // day polygons
        let cp = durationsToArray(cLengths); // civil twilight polygons
        let np = durationsToArray(nLengths); // nautical twilight polygons
        let ap = durationsToArray(aLengths); // astronomical twilight polygons
        
        // construct SVG day length diagram
        svgString += rectangleSvg(leftPadding, topPadding, svgWidth, svgHeight, sunColors[4]); // night
        for (let polygon of ap) {svgString += polygonFromArray(polygon, sunColors[3]);} // astronomical twilight
        for (let polygon of np) {svgString += polygonFromArray(polygon, sunColors[2]);} // nautical twilight
        for (let polygon of cp) {svgString += polygonFromArray(polygon, sunColors[1]);} // civil twilight
        for (let polygon of dp) {svgString += polygonFromArray(polygon, sunColors[0]);} // daylight
    }
    else if (type == "rise-set") { // sunrise, sunset, dusk, dawn plot
        let aIntervals: number[][][] = []; // intervals of astronomical twilight or brighter
        let nIntervals: number[][][] = []; // intervals of nautical twilight or brighter
        let cIntervals: number[][][] = []; // intervals of civil twilight or brighter
        let dIntervals: number[][][] = []; // intervals of daylight

        for (let event of sunEvents) {
            let int = intervalsSvg(event);
            aIntervals.push(int[3]);
            nIntervals.push(int[2]);
            cIntervals.push(int[1]);
            dIntervals.push(int[0]);
        }
        
        let aPolygons = toPolygons(aIntervals, sunColors[3]); // astronomical twilight
        let nPolygons = toPolygons(nIntervals, sunColors[2]); // nautical twilight
        let cPolygons = toPolygons(cIntervals, sunColors[1]); // civil twilight
        let dPolygons = toPolygons(dIntervals, sunColors[0]); // daylight

        let allPolygons = [...aPolygons, ...nPolygons, ...cPolygons, ...dPolygons];

        svgString += rectangleSvg(leftPadding, topPadding, svgWidth, svgHeight, sunColors[4]); // night
        for (let polygon of allPolygons) {svgString += polygon;} // twilight + daylight

        let noonMidnightLines = [...solarMidnightLines(), ...solarNoonLines()];
        for (let line of noonMidnightLines) {svgString += line;}
    }
    
    // draw solstices and equinoxes as green lines
    if (type != "moon") {
        const zone = typeof(sunEvents[0][0].time.zoneName) == "string" ? sunEvents[0][0].time.zoneName : "utc";
        const year = sunEvents[0][0].time.year;
        const solsticesEquinoxes = getSolstEq(year, zone);
        for (const date of Object.values(solsticesEquinoxes)) {
            const newYear = DateTime.fromISO(`${date.year}-01-01`, {zone: date.zone});
            const x = xCoord(date.diff(newYear, ['days', 'hours']).days + 0.5);
            svgString += lineSvg(x, topPadding, x, topPadding+svgHeight, "#00c000", 1);
        }
    }

    // draw y-axis and gridlines
    for (let i=0; i<=24; i+=gridInterval) {
        let y = yCoord((i/24)*DAY_LENGTH);
        svgString += textSvg(String(i), leftPadding-5, y, textSize, font, textColor, "end", "middle");
        svgString += lineSvg(leftPadding, y, leftPadding+svgWidth, y, gridColor, gridlineWidth);
    }

    // draw x-axis and gridlines
    for (let i=0; i<12; i++) {
        let x = xCoord(monthEdges(days != 365)[i]);
        let xText = (x + xCoord(monthEdges(days != 365)[i+1]))/2;
        svgString += textSvg(months(language)[i], xText, topPadding+svgHeight+12, textSize, font, textColor, "middle", "middle");
        svgString += lineSvg(x, topPadding, x, topPadding+svgHeight, gridColor, gridlineWidth);
    }
    svgString += lineSvg(leftPadding+svgWidth, topPadding, leftPadding+svgWidth, topPadding+svgHeight, gridColor, gridlineWidth);

    // complete SVG diagram
    svgString += svgClose;
    return svgString;
}