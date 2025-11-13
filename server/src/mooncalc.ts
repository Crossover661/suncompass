/** Formulas derived from "Astronomical Algorithms" by Jean Meeus. */

import {clamp, mod, mins, jCentury} from "./mathfuncs.js";
import {meanSunAnomaly} from "./suncalc.js";
import {DateTime} from "luxon";
import {degToRad, moon_ptl, moon_ptld} from "./constants.js";

export function moonMeanLongitude(JC: number) {
    return 218.3164591 + 481267.88134236*JC - 0.0013268*JC**2 + JC**3/538841 - JC**4/65194000;
}

export function moonMeanElongation(JC: number) {
    return 297.8502042 + 445267.1115168*JC - 0.00163*JC**2 + JC**3/545868 - JC**4/113065000;
}

export function moonMeanAnomaly(JC: number) {
    return 134.9634114 + 477198.8676313*JC + 0.008997*JC**2 + JC**3/69699 - JC**4/14712000;
}

/** Moon argument of latitude */
export function moonArgLat(JC: number) {
    return 93.2720993 + 483202.0175273*JC - 0.0034029*JC**2 - JC**3/3526000 + JC**4/863310000;
}

/** Sum of all longitude terms in moon_ptld (periodic terms for longitude and distance) */
function l(JC: number) {
    let l = 0;
    for (let i=0; i<moon_ptld.length; i++) {
        let curRow = moon_ptld[i];
        let curSum = curRow[4] * Math.sin((curRow[0]*moonMeanElongation(JC) + curRow[1]*meanSunAnomaly(JC) + curRow[2]*moonMeanAnomaly(JC) + curRow[3]*moonArgLat(JC))*degToRad);
        if (curRow[1] != 0) {
            // Multiply terms which contain -M or M by E, and terms which contain 2M or -2M by E^2.
            let E = 1 - 0.002516*JC - 7.4e-6*JC**2;
            curSum *= (E ** Math.abs(curRow[1]));
        }
        l += curSum;
    }
    return l;
}

/** Sum of all distance terms in moon_ptld (periodic terms for longitude and distance) */
function r(JC: number) {
    let r = 0;
    for (let i=0; i<moon_ptld.length; i++) {
        let curRow = moon_ptld[i];
        let curSum = curRow[5] * Math.sin((curRow[0]*moonMeanElongation(JC) + curRow[1]*meanSunAnomaly(JC) + curRow[2]*moonMeanAnomaly(JC) + curRow[3]*moonArgLat(JC))*degToRad);
        if (curRow[1] != 0) {
            // Multiply terms which contain -M or M by E, and terms which contain 2M or -2M by E^2.
            let E = 1 - 0.002516*JC - 7.4e-6*JC**2;
            curSum *= (E ** Math.abs(curRow[1]));
        }
        r += curSum;
    }
    return r;
}

/** Sum of all latitude terms in moon_ptl (periodic terms for latitude) */
function b(JC: number) {
    let b = 0;
    for (let i=0; i<moon_ptl.length; i++) {
        let curRow = moon_ptl[i];
        let curSum = curRow[4] * Math.sin((curRow[0]*moonMeanElongation(JC) + curRow[1]*meanSunAnomaly(JC) + curRow[2]*moonMeanAnomaly(JC) + curRow[3]*moonArgLat(JC))*degToRad);
        if (curRow[1] != 0) {
            // Multiply terms which contain -M or M by E, and terms which contain 2M or -2M by E^2.
            let E = 1 - 0.002516*JC - 7.4e-6*JC**2;
            curSum *= (E ** Math.abs(curRow[1]));
        }
        b += curSum;
    }
    return b;
}

function a(JC: number) {
    let a1 = 119.75 + 131.849*JC;
    let a2 = 53.09 + 479264.29*JC;
    let a3 = 313.45 + 481266.484*JC;
    return [a1, a2, a3];
}

/** Variations in longitude due to the actions of Venus, Jupiter, and the flattening of Earth. */
function deltaL(JC: number) {
    let A = a(JC);
    return 3958*Math.sin(A[0]*degToRad) + 1962*Math.sin((moonMeanLongitude(JC)-moonArgLat(JC))*degToRad) + 318*Math.sin(A[1]*degToRad);
}

/** Variations in latitude due to the actions of Venus, Jupiter, and the flattening of Earth. */
function deltaB(JC: number) {
    let A = a(JC);
    return -2235*Math.sin(moonMeanLongitude(JC)*degToRad) + 382*Math.sin(A[2]*degToRad) + 175*Math.sin((A[0]-moonArgLat(JC))*degToRad) + 175*Math.sin((A[0]+moonArgLat(JC))*degToRad) + 127*Math.sin((moonMeanLongitude(JC)-moonMeanAnomaly(JC))*degToRad) - 115*Math.sin((moonMeanLongitude(JC)+moonMeanAnomaly(JC))*degToRad);
}

/** The nutation for the moon's longitude, derived from page 132 of Astronomical Algorithms. */
function nutation(JC: number) {
    let L = (280.4665 + 36000.7698*JC)*degToRad;
    let Lprime = (218.3165 + 481267.8813*JC)*degToRad;
    let omega = (125.04452 - 1934.136261*JC + 0.0020708*JC**2 + JC**3/450000)*degToRad;
    return (-17.2*Math.sin(omega) - 1.32*Math.sin(2*L) - 0.23*Math.sin(2*Lprime) + 0.21*Math.sin(2*omega))/3600;
}

/** Returns the ecliptic latitude and longitude of the moon. Return value is an array: [latitude, longitude], 
 * both measured in degrees. */
export function moonLatLong(date: number | DateTime) {
    if (typeof(date) == "number") {
        let long = moonMeanLongitude(date) + (l(date)+deltaL(date))/1e6 + nutation(date);
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