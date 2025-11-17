/** Formulas derived from "Astronomical Algorithms" by Jean Meeus. */

import {clamp, mod, jCentury, rotateZ, latLongEcef, elevAzimuth} from "./mathfuncs.js";
import {meanSunAnomaly, longNutation, obliquity, gast} from "./suncalc.js";
import {DateTime} from "luxon";
import {degToRad, earthERadius, flattening, moonPtl, moonPtld} from "./constants.js";
import { couldStartTrivia } from "../../node_modules/typescript/lib/typescript.js";

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
    let [a1, a2, a3] = a(JC);
    a1 *= degToRad; a2 *= degToRad; a3 *= degToRad;
    const meanLong = moonMeanLongitude(JC) * degToRad;
    const meanAnomaly = moonMeanAnomaly(JC) * degToRad;
    const argLat = moonArgLat(JC) * degToRad;
    return -2235*Math.sin(meanLong) + 382*Math.sin(a3) + 175*Math.sin(a1-argLat) +
    175*Math.sin(a1+argLat) + 127*Math.sin(meanLong-meanAnomaly) - 115*Math.sin(meanLong+meanAnomaly);
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
export function moonDistance(date: number | DateTime) {
    if (typeof(date) == "number") {return 385000.56 + r(date)/1000;}
    else {return moonDistance(jCentury(date));}
}

/** Returns the rectangular coordinates [x, y, z] in Earth-centered, Earth-fixed coordinates (ECEF) in kilometers. */
export function moonEcef(date: DateTime) {
    let [eLat, eLong] = moonLatLong(date);
    const ob = obliquity(date) * degToRad;
    eLat *= degToRad; eLong *= degToRad;
    const [sinB,cosB,sinL,cosL,sinE,cosE] = [Math.sin(eLat),Math.cos(eLat),Math.sin(eLong),Math.cos(eLong),Math.sin(ob),Math.cos(ob)];
    
    // xq, yq, zq are geocentric equatorial (Earth-centered inertial) coordinates
    const dist = moonDistance(date);
    const xeci = dist * cosB * cosL;
    const yeci = dist * (cosB * sinL * cosE - sinB * sinE);
    const zeci = dist * (cosB * sinL * sinE + sinB * cosE);

    // convert to ECEF coordinates
    const rectCoords = rotateZ(xeci, yeci, zeci, -gast(date));
    return rectCoords;
}

/** Returns the sublunar point [latitude, longitude].
 * The latitude is given as geodetic latitude.
 */
export function sublunarPoint(date: DateTime) {
    const [xecef, yecef, zecef] = moonEcef(date);

    // reduce ECEF to unit direction vector
    const r = Math.hypot(xecef, yecef, zecef);
    const [ux, uy, uz] = [xecef/r, yecef/r, zecef/r];

    // convert to point on WGS84 ellipsoid
    const b = earthERadius * (1-flattening);
    const k = 1 / Math.sqrt((ux**2 + uy**2) / (earthERadius**2) + (uz**2) / (b**2));
    const [Xs, Ys, Zs] = [k*ux, k*uy, k*uz];

    // convert point to geodetic latitude/longitude
    const e2 = 2*flattening - flattening**2;
    const ep2 = (earthERadius**2 - b**2) / b**2;
    const p = Math.hypot(Xs, Ys);
    const th = Math.atan2(earthERadius*Zs, b*p);
    const long = Math.atan2(Ys, Xs);
    const lat = Math.atan2(Zs+ep2*b*Math.sin(th)**3, p-e2*earthERadius*Math.cos(th)**3);
    return [lat/degToRad, mod(long/degToRad+180,360)-180]; // normalize lat/long
}

export function moonAngularRadius(date: number | DateTime) {
    return (1737.4 / moonDistance(date)) / degToRad;
}

/** Returns the moon's position: [elevation, azimuth] in degrees. Optionally, the observer's ECEF can be specified in order
 * to avoid repeatedly computing it.
*/
export function moonPosition(lat: number, long: number, date: DateTime, ecefO?: number[]) {
    if (ecefO === undefined) {return elevAzimuth(lat, long, latLongEcef(lat, long), moonEcef(date));}
    else {return elevAzimuth(lat, long, ecefO, moonEcef(date));}
}