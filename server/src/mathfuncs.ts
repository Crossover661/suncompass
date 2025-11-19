const degToRad = Math.PI/180;

import { DateTime } from 'luxon';
import {DAY_LENGTH, earthERadius, earthPRadius, flattening, J2000UTC} from "./constants.js";

/** Object representing the change in a location's time zone. 
 * @param unix: the Unix timestamp at which the change occurs.
 * @param offset: the time zone's new offset, in minutes from UTC
 * @param change: True if the time zone changes, false if it's just the initial time zone for the year.
*/
export type TimeChange = {unix: number; offset: number; change: boolean};

/** Divide x by y, rounding the output to the nearest integer with smaller absolute value. */
export function intDiv(x: number, y: number) {
    if (x<0) {return Math.ceil(x/y);}
    else {return Math.floor(x/y);}
}

/** Same as the toMillis() method in Luxon, but truncated to the nearest integer. */
export function ms(date: DateTime) {return Math.trunc(date.toMillis());}

/** Converts Unix milliseconds to approximate "fractional year" for Delta T calculation. */
function fractionalYear(t: number) {
    return t / (365.2425 * 86400 * 1000) + 1970;
}

/** This function finds the approximate value of ΔT, which is calculated using the formula ΔT = TT - UT1. 
 * 
 * TT is terrestrial time (based on atomic clocks) and UT1 is mean solar time at 0° longitude.
 * 
 * This function's margin of error is 4.8 seconds in 2024, based on the value this function returns (73.8 seconds) versus the
 * real value (69 seconds). The margin of error increases for years before 1800 and after 2100, as the Earth's rotation 
 * varies unpredictably.
 * 
 * Source: https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html
 * @param t Unix time in milliseconds. */
export function approxDeltaT(t: number) {
    const y = fractionalYear(t);
    if (y < 500) {
        const u = y/100;
        return 10583.6 - 1014.41 * u + 33.78311 * u**2 - 5.952053 * u**3 - 0.1798452 * u**4 + 0.022174192 * u**5 + 0.0090316521 * u**6;
    }
    else if (y < 1600) {
        const u = (y-1000)/100;
        return 1574.2 - 556.01*u + 71.23472*u**2 + 0.319781*u**3 - 0.853463*u**4 - 0.005050998*u**5 + 0.0083572073*u**6;
    }
    else if (y < 1700) {
        const t = y - 1600;
        return 120 - 0.9808*t - 0.01532*t**2 + t**3/7129;
    }
    else if (y < 1800) {
        const t = y - 1700;
        return 8.83 + 0.1603*t - 0.0059285*t**2 + 0.00013336*t**3 - t**4/1174000;
    }
    else if (y < 1860) {
        const t = y - 1800;
        return 13.72 - 0.332447 * t + 0.0068612 * t**2 + 0.0041116 * t**3 - 0.00037436 * t**4 + 0.0000121272 * t**5 - 0.0000001699 * t**6 + 0.000000000875 * t**7;
    }
    else if (y < 1900) {
        const t = y - 1860;
        return 7.62 + 0.5737 * t - 0.251754 * t**2 + 0.01680668 * t**3 - 0.0004473624 * t**4 + t**5 / 233174;
    }
    else if (y < 1920) {
        const t = y - 1900;
        return -2.79 + 1.494119 * t - 0.0598939 * t**2 + 0.0061966 * t**3 - 0.000197 * t**4;
    }
    else if (y < 1941) {
        const t = y - 1920;
        return 21.20 + 0.84493*t - 0.076100 * t**2 + 0.0020936 * t**3;
    }
    else if (y < 1961) {
        const t = y - 1950;
        return 29.07 + 0.407*t - t**2/233 + t**3 / 2547;
    }
    else if (y < 1986) {
        const t = y - 1975;
        return 45.45 + 1.067*t - t**2/260 - t**3 / 718;
    }
    else if (y < 2005) {
        const t = y - 2000;
        return 63.86 + 0.3345 * t - 0.060374 * t**2 + 0.0017275 * t**3 + 0.000651814 * t**4 + 0.00002373599 * t**5;
    }
    else if (y < 2050) {
        const t = y - 2000;
        return 62.92 + 0.32217 * t + 0.005589 * t**2;
    }
    else if (y < 2150) {return 32 * ((y-1820)/100)**2 - 0.5628 * (2150 - y) - 20;}
    else {
        const u = (y-1820)/100;
        return 32*u**2-20;
    }
}

/** Clamps a number to the range [min, max]. 
 * If min and max are not specified, they default to -1 and 1 respectively.*/
export function clamp(x: number, min=-1, max=1) {
    if (x <= min) {return min;}
    else if (x >= max) {return max;}
    else {return x;}
}

/** Calculates x modulo y, where the output is in the range [0, y). */
export function mod(x: number, y: number) {return ((x % y) + y) % y;}

/** Calculates the Julian century given the Unix timestamp in milliseconds, corrected for delta T. 
 * Note that there is a maximum error of 1 second due to the difference between UT1 and UTC, known as DUT1.
*/
export function jCentury(unix: number) {
    const deltaT0 = Math.round(approxDeltaT(J2000UTC) * 1000);
    let epoch = J2000UTC - deltaT0;

    const deltaT = Math.round(approxDeltaT(unix)*1000) - deltaT0;
    const millis = unix - epoch + deltaT;
    return millis / 3.15576e12; // There are 3.15576e12 milliseconds in a Julian century.
}

/** Calculates Julian day from Unix milliseconds. */
export function jdUTC(unix: number) {return unix / DAY_LENGTH + 2440587.5;}

/**
 * Returns the compass point (ex: NE, SSW) given a compass bearing in degrees.
 * @param bearing Compass bearing, in degrees clockwise from north.
 * @returns Compass point (either N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, or NNW)
 */
export function direction(bearing: number) {
    if (bearing < 0 || bearing >= 360) {bearing = mod(bearing, 360);}
    if (bearing < 11.25) {return "N";}
    else if (bearing < 33.75) {return "NNE";}
    else if (bearing < 56.25) {return "NE";}
    else if (bearing < 78.75) {return "ENE";}
    else if (bearing < 101.25) {return "E";}
    else if (bearing < 123.75) {return "ESE";}
    else if (bearing < 146.25) {return "SE";}
    else if (bearing < 168.75) {return "SSE";}
    else if (bearing < 191.25) {return "S";}
    else if (bearing < 213.75) {return "SSW";}
    else if (bearing < 236.25) {return "SW";}
    else if (bearing < 258.75) {return "WSW";}
    else if (bearing < 281.25) {return "W";}
    else if (bearing < 303.75) {return "WNW";}
    else if (bearing < 326.25) {return "NW";}
    else if (bearing < 348.75) {return "NNW";}
    else {return "N";}
}

export function displayTime(date: any, twelveHourFormat = false) {
    if (date == Number.POSITIVE_INFINITY) {return "∞";}
    else if (date == Number.NEGATIVE_INFINITY) {return "-∞";}
    else if (isNaN(date)) {return NaN;}
    else if (twelveHourFormat) {return date.toFormat("h:mm:ss a");}
    else {return date.toFormat("HH:mm:ss");}
}

export function displayDuration(duration: any) {
    if (duration == Number.POSITIVE_INFINITY) {return "∞";}
    else if (duration == Number.NEGATIVE_INFINITY) {return "-∞";}
    else if (isNaN(duration)) {return NaN;}
    else {return duration.toFormat("h:mm:ss");}
}

/** Returns the time of day in the DateTime as a number of milliseconds, from 0 (00:00:00.000) to 86399999 (23:59:59.999). */
export function convertToMS(date: DateTime) {
    return 1000 * (date.hour * 3600 + date.minute * 60 + date.second) + date.millisecond;
}

/** Returns a Luxon DateTime corresponding to the beginning of the given day. */
export function startOfDay(date: DateTime) {
    return date.set({hour: 0, minute: 0, second: 0, millisecond: 0});
}

/** Returns a Luxon DateTime corresponding to the beginning of the next day. */
export function startNextDay(date: DateTime) {
    return date.plus({days: 1}).set({hour: 0, minute: 0, second: 0, millisecond: 0});
}

/** Signed "twice area" of triangle p0,p1,p2 (zero -> collinear). Helper function for isCollinear */
function cross(p0: number[], p1: number[], p2: number[]): number {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1];
    return ax * by - ay * bx;
}

/** Distance from p1 to the infinite line through p0–p2. Helper function for isCollinear. */
function pointLineDistance(p0: number[], p1: number[], p2: number[]): number {
    const area2 = Math.abs(cross(p0, p1, p2));
    const len = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]);
    return len === 0 ? Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) : area2 / len;
}

/** True if p1 is collinear with p0–p2 within epsilon (absolute distance in same units as coords) */
export function isCollinear(p0: number[], p1: number[], p2: number[], epsilon = 1e-6): boolean {
    return pointLineDistance(p0, p1, p2) <= epsilon;
}

/** Like toFixed() function in JavaScript/TypeScript, but removes trailing zeroes. */
export function toFixedS(n: number, precision: number) {
    if (precision == 0) {return n.toFixed(0);}
    else {return n.toFixed(precision).replace(/\.?0+$/, "");}
}

/** Rotate x, y, z around z-axis by theta degrees using right hand rule.
 * Used to convert ECI coordinates to ECEF. Returns an array [x, y, z]
 */
export function rotateZ(x: number, y: number, z: number, theta: number) {
    const [cosT, sinT] = [Math.cos(theta*degToRad), Math.sin(theta*degToRad)];
    const x2 = x * cosT - y * sinT;
    const y2 = x * sinT + y * cosT;
    return [x2, y2, z];
}

/** Converts geodetic latitude and longitude to rectangular ECEF coordinates in km: [x, y, z] */
export function latLongEcef(lat: number, long: number): number[] {
    const e2 = 2*flattening - flattening**2;
    lat *= degToRad; long *= degToRad;
    const [sinLat, cosLat, sinLong, cosLong] = [Math.sin(lat),Math.cos(lat),Math.sin(long),Math.cos(long)];
    const N = earthERadius / Math.sqrt(1 - e2 * sinLat**2); // radius of curvature in prime vertical
    const [X, Y, Z] = [N*cosLat*cosLong, N*cosLat*sinLong, N*(1-e2)*sinLat]; // observer's ECEF coords
    return [X, Y, Z];
}

/** Converts geocentric latitude (lat) to geodetic latitude. When giving geographic coordinates, latitude is always
 * given as geodetic.
*/
export function geocentric2geodetic(lat: number): number {
    const e2 = 1 - (earthPRadius / earthERadius) ** 2;
    return Math.atan(Math.tan(lat*degToRad) / (1 - e2)) / degToRad;
}

/** Converts geodetic latitude (lat) to geocentric latitude. When giving geographic coordinates, latitude is always
 * given as geodetic.
*/
export function geodetic2geocentric(lat: number): number {
    const e2 = 1 - (earthPRadius / earthERadius) ** 2;
    return Math.atan(Math.tan(lat*degToRad) * (1 - e2)) / degToRad;
}

/** Converts geocentric latitude, longitude, and distance (in kilometers) to rectangular ECEF coordinates.
 * @param lat Geocentric latitude. (To convert from geodetic, use geodetic2geocentric)
 * @param long Longitude.
 * @param dist Distance from Earth's center in kilometers.
 * @returns ECEF coordinate array: [x, y, z]
 */
export function toEcef(lat: number, long: number, dist: number): number[] {
    lat *= degToRad; long *= degToRad;
    const [cosLat, sinLat, cosLong, sinLong] = [Math.cos(lat), Math.sin(lat), Math.cos(long), Math.sin(long)];
    const [x, y, z] = [dist*cosLat*cosLong, dist*cosLat*sinLong, dist*sinLat];
    return [x, y, z];
}

/** Given the geodetic latitude, longitude, and ECEF of an observer, and the ECEF coordinates of a celestial object, find the
 * elevation and azimuth of the object.
 * @param lat Geodetic latitude of observer.
 * @param long Longitude of observer.
 * @param ecefO ECEF coordinates of observer.
 * @param ecefC ECEF coordinates of celestial object (planet, moon, star).
 * @returns [elevation, azimuth] of celestial object as seen from observer. Both are given in degrees. Elevation is in degrees
 * above the horizon, and azimuth is in degrees clockwise from north (range 0 <= a < 360).
 */
export function elevAzimuth(lat: number, long: number, ecefO: number[], ecefC: number[]): number[] {
    const [xe, ye, ze] = ecefC; // celestial body's ECEF
    const [xo, yo, zo] = ecefO; // observer's ECEF
    const [dx, dy, dz] = [xe-xo, ye-yo, ze-zo];

    // rotate ECEF coordinates to local ENU (east, north, up) at observer
    const [latR, longR] = [lat*degToRad, long*degToRad];
    const [sinLat, cosLat, sinLong, cosLong] = [Math.sin(latR), Math.cos(latR), Math.sin(longR), Math.cos(longR)];
    const E = -sinLong * dx + cosLong * dy;
    const N = -sinLat * cosLong * dx - sinLat * sinLong * dy + cosLat * dz;
    const U =  cosLat * cosLong * dx + cosLat * sinLong * dy + sinLat * dz;

    // convert ENU to elevation and azimuth
    const R = Math.hypot(E, N, U);
    const elev = Math.asin(clamp(U / R)) / degToRad; // elevation above horizon
    const az = mod(Math.atan2(E, N) / degToRad, 360); // degrees clockwise from north
    return [elev, az];
}

/** Given a start date and an end date, both with the same IANA time zone identifier, return an array of Luxon DateTimes with
 * the start of each day within the interval. */
export function dayStarts(start: DateTime, end: DateTime): DateTime[] {
    if (start.zoneName != end.zoneName) {
        console.log("Start and end must have same time zone");
        return [];
    }
    const dayStarts = [];
    let cur = start.startOf("day");
    while (ms(cur) <= ms(end)) {
        dayStarts.push(cur);
        cur = cur.plus({days: 1}).startOf("day");
    }
    return dayStarts;
}

/** Given the value returned by dayStarts, create a "lookup table" showing when the time offsets change during the given period. */
export function timeZoneLookupTable(dayStarts: DateTime[]): TimeChange[] {
    const changeAtStart = (dayStarts[0].offset != dayStarts[0].minus(1).offset);
    const firstChange: TimeChange = {unix: ms(dayStarts[0]), offset: dayStarts[0].offset, change: changeAtStart};
    const table: TimeChange[] = [firstChange];

    for (let i=1; i<dayStarts.length; i++) {
        const prevDay = dayStarts[i-1], curDay = dayStarts[i];
        if (prevDay.offset != curDay.offset) {
            // If the time changes during this day, use binary search to find where it changes.
            let t0 = ms(prevDay), t1 = ms(curDay);
            while (t1 - t0 > 1) {
                const avg = Math.floor((t0 + t1)/2);
                const avgTime = DateTime.fromMillis(avg, {zone: curDay.zone});
                if (avgTime.offset == prevDay.offset) {t0 = avg;}
                else {t1 = avg;}
            }
            table.push({unix: t1, offset: curDay.offset, change: true});
        }
    }
    return table;
}

/** Get UTC offset (minutes) from a Unix timestamp and a time zone lookup table (see mathfuncs.timeZoneLookupTable()) */
export function getOffsetFromTable(unix: number, table: TimeChange[]): number {
    let offset = 0;
    for (const change of table) {
        if (unix >= change.unix) {offset = change.offset;}
        else {break;}
    }
    return offset;
}