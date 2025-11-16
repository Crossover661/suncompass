/** Formulas derived from "Astronomical Algorithms" by Jean Meeus. */

import {clamp, mod, jCentury} from "./mathfuncs.js";
import {meanSunAnomaly, longNutation} from "./suncalc.js";
import {DateTime} from "luxon";
import {degToRad, moonPtl, moonPtld} from "./constants.js";

export function moonMeanLongitude(JC: number) {
    return mod(218.3164591 + 481267.88134236*JC - 0.0013268*JC**2 + JC**3/538841 - JC**4/65194000, 360);
}

export function moonMeanElongation(JC: number) {
    return mod(297.8502042 + 445267.1115168*JC - 0.00163*JC**2 + JC**3/545868 - JC**4/113065000, 360);
}

export function moonMeanAnomaly(JC: number) {
    return mod(134.9634114 + 477198.8676313*JC + 0.008997*JC**2 + JC**3/69699 - JC**4/14712000, 360);
}

/** Moon argument of latitude */
export function moonArgLat(JC: number) {
    return mod(93.2720993 + 483202.0175273*JC - 0.0034029*JC**2 - JC**3/3526000 + JC**4/863310000, 360);
}

/** Sum of all longitude terms in moonPtld (periodic terms for longitude and distance) */
function l(JC: number) {
    let l = 0;
    const D = moonMeanElongation(JC);
    const M = meanSunAnomaly(JC);
    const Mp = moonMeanAnomaly(JC);
    const F = moonArgLat(JC);
    const E = 1 - 0.002516*JC - 7.4e-6*JC**2;
    for (let i=0; i<moonPtld.length; i++) {
        const curRow = moonPtld[i];
        let curSum = curRow[4] * Math.sin((curRow[0]*D + curRow[1]*M + curRow[2]*Mp + curRow[3]*F)*degToRad);
        curSum *= (E ** Math.abs(curRow[1])); // Multiply terms which contain -M or M by E, and terms which contain 2M or -2M by E^2.
        l += curSum;
    }
    return l;
}

/** Sum of all distance terms in moonPtld (periodic terms for longitude and distance) */
function r(JC: number) {
    let r = 0;
    const D = moonMeanElongation(JC);
    const M = meanSunAnomaly(JC);
    const Mp = moonMeanAnomaly(JC);
    const F = moonArgLat(JC);
    const E = 1 - 0.002516*JC - 7.4e-6*JC**2;
    for (let i=0; i<moonPtld.length; i++) {
        const curRow = moonPtld[i];
        let curSum = curRow[5] * Math.cos((curRow[0]*D + curRow[1]*M + curRow[2]*Mp + curRow[3]*F)*degToRad);
        curSum *= (E ** Math.abs(curRow[1])); // Multiply terms which contain -M or M by E, and terms which contain 2M or -2M by E^2.
        r += curSum;
    }
    return r;
}

/** Sum of all latitude terms in moonPtl (periodic terms for latitude) */
function b(JC: number) {
    let b = 0;
    const D = moonMeanElongation(JC);
    const M = meanSunAnomaly(JC);
    const Mp = moonMeanAnomaly(JC);
    const F = moonArgLat(JC);
    const E = 1 - 0.002516*JC - 7.4e-6*JC**2;
    for (let i=0; i<moonPtl.length; i++) {
        const curRow = moonPtl[i];
        let curSum = curRow[4] * Math.sin((curRow[0]*D + curRow[1]*M + curRow[2]*Mp + curRow[3]*F)*degToRad);
        curSum *= (E ** Math.abs(curRow[1])); // Multiply terms which contain -M or M by E, and terms which contain 2M or -2M by E^2.
        b += curSum;
    }
    return b;
}

function a(JC: number) {
    return [119.75 + 131.849*JC, 53.09 + 479264.29*JC, 313.45 + 481266.484*JC];
}

/** Variations in longitude due to the actions of Venus, Jupiter, and the flattening of Earth. */
function deltaL(JC: number) {
    const [a1, a2, a3] = a(JC);
    return 3958*Math.sin(a1*degToRad) + 1962*Math.sin((moonMeanLongitude(JC)-moonArgLat(JC))*degToRad) + 318*Math.sin(a2*degToRad);
}

/** Variations in latitude due to the actions of Venus, Jupiter, and the flattening of Earth. */
function deltaB(JC: number) {
    const [a1, a2, a3] = a(JC);
    const meanLong = moonMeanLongitude(JC);
    const meanAnomaly = moonMeanAnomaly(JC);
    const argLat = moonArgLat(JC);
    return -2235*Math.sin(meanLong*degToRad) + 382*Math.sin(a3*degToRad) + 175*Math.sin((a1-argLat)*degToRad) +
    175*Math.sin((a1+argLat)*degToRad) + 127*Math.sin((meanLong-meanAnomaly)*degToRad) - 115*Math.sin((meanLong+meanAnomaly)*degToRad);
}

/** Returns the ecliptic latitude and longitude of the moon. Return value is an array: [latitude, longitude], 
 * both measured in degrees. */
export function moonLatLong(date: number | DateTime) {
    if (typeof(date) == "number") {
        let long = moonMeanLongitude(date) + (l(date)+deltaL(date))/1e6 + longNutation(date);
        let lat = (b(date) + deltaB(date))/1e6;
        lat = clamp(lat, -90, 90);
        long = mod(long, 360);
        return [lat, long];
    }
    else {return moonLatLong(jCentury(date));}
}

/** Distance from center of earth to center of moon, in kilometers. */
export function moonEarthDistanceKM(date: number | DateTime) {
    if (typeof(date) == "number") {return 385000.56 + r(date)/1000;}
    else {return moonEarthDistanceKM(jCentury(date));}
}

/** Equatorial horizontal parallax of the moon, in degrees. */
export function moonParallax(date: number | DateTime) {
    if (typeof(date) == "number") {return Math.asin(6378.14 / moonEarthDistanceKM(date)) / degToRad;}
    else {return moonParallax(jCentury(date));}
}