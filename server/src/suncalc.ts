/* 
The formulas for eccentricity, earth-sun distance, axial tilt, declination, equation of time, and atmospheric refraction of sunlight 
are borrowed from the book "Astronomical Algorithms" by Jean Meeus. The refraction formula is modified slightly to ensure continuity 
when the sun is below the horizon. The formula for solar ecliptic longitude is from the book "Planetary Programs and Tables from 
-4000 to +2800" by Pierre Bretagnon and Jean-Louis Simon.

The subsolar point is calculated using the declination and equation of time, treating UTC as equivalent to UT1 (mean solar time at 0
degrees longitude), the two are always within 0.9 seconds of each other. Solar noon and midnight are calculated using the equation of 
time. The position of the sun is calculated from the subsolar point through spherical trigonometry.

For the purposes of this calculator, daytime is defined as the period in which the solar elevation angle is greater than -50 
arcminutes, or -5/6 of a degree. This accounts for the sun's angular radius in the sky and refraction of sunlight. It corresponds to 
the definition used by most sources, including NOAA's solar calculator.

This site uses the Luxon library to deal with date/time computations. Luxon is used to simplify computation when dealing with
durations, conversion between different time zones, and complexities such as daylight saving time. The geo-tz library is used to find 
the time zone of a geographic coordinate.
*/

import * as mf from "./mathfuncs.js";
import {degToRad, sunPeriodicTerms, DAY_LENGTH} from "./constants.js";
import * as fs from "fs";
import SunTime from "./SunTime.js";
import {DateTime} from "luxon";

export type SeasonEvents = {marEquinox: DateTime; junSolstice: DateTime; sepEquinox: DateTime; decSolstice: DateTime;};

/** Sun's mean longitude according to formula 27.2 in Astronomical Algorithms. 
 * @param date The timestamp.
 * @param unix If true, date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
*/
export function sunMeanLong(date: number, unix = false): number {
    if (!unix) { // if date is specified as a Julian century
        const m = date / 10; // Julian millennium
        return mf.mod(280.4664567 + 360007.6982779*m + 0.03032028*m**2 + m**3/49931 - m**4/15299 - m**5/1988000, 360);
    }
    else {return sunMeanLong(mf.jCentury(date));}
}

/** Sun's geometric longitude, i.e. longitude excluding aberration and nutation. 
 * @param date The timestamp.
 * @param unix If true, date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
*/
export function sunGeomLong(date: number, unix = false): number {
    if (!unix) {
        const U = date / 100;
        let long = 4.9353929 + 62833.196168*U;
        for (let i=0; i<sunPeriodicTerms.length; i++) {
            const curRow = sunPeriodicTerms[i];
            long += (1e-7*(curRow[0] * Math.sin(curRow[2]+curRow[3]*U)));
        }
        return mf.mod(long / degToRad, 360);
    }
    else {return sunGeomLong(mf.jCentury(date));}
}

/** Formula 45.3, in page 308 of Astronomical Algorithms */
export function meanSunAnomaly(JC: number): number {return mf.mod(357.5291092 + 35999.0502909*JC - 1.536e-4*JC**2 + JC**3/24490000, 360);}
export function eccentricity(JC: number): number {return 0.016708617 - 4.2037e-5*JC - 1.236e-7*JC**2;}
export function equationOfCenter(JC: number): number {
    const anom = meanSunAnomaly(JC) * degToRad;
    return (1.9146 - 0.004817*JC - 1.4e-5*JC**2) * Math.sin(anom) +
    (0.019993 - 1.01e-4*JC) * Math.sin(2*anom) +
    2.9e-4 * Math.sin(3*anom);
}
export function sunAnomaly(JC: number): number {return meanSunAnomaly(JC) + equationOfCenter(JC);}

/** Distance from sun to earth in kilometers. 
 * @param date The timestamp. Can be specified as a Luxon DateTime, a Unix timestamp (if unix = true), or a Julian century (if Unix = false).
 * @param unix If true (and date is a number), date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
*/
export function sunDistance(date: number | DateTime, unix = false): number {
    if (typeof(date) == "number") {
        if (!unix) {
            const ecc = eccentricity(date);
            return (149598023*(1-ecc**2))/(1+ecc*Math.cos(sunAnomaly(date)*degToRad));
        }
        else {return sunDistance(mf.jCentury(date));}
    }
    else {return sunDistance(mf.jCentury(mf.ms(date)));}
}

/**
 * Calculates the sun's apparent ecliptic longitude to within 0.0009 degrees for years 0-3000. This value is 0 at the March equinox,
 * 90 at the June solstice, 180 at the September equinox, and 270 at the December solstice.
 * @param date The timestamp.
 * @param unix If true, date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
 */
export function sunTrueLong(date: number, unix = false): number {
    if (!unix) {
        const U = date / 100;
        const geoLong = sunGeomLong(date);
        const aberration = 1e-7*(17*Math.cos(3.1+62830.14*U)-993)/degToRad;
        const nutation = 1e-7*(-834*Math.sin(2.18-3375.7*U+0.36*U**2)-64*Math.sin(3.51+125666.39*U+0.1*U**2))/degToRad;
        return mf.mod(geoLong + aberration + nutation, 360);
    }
    else {return sunTrueLong(mf.jCentury(date));}
}

/** Nutation in obliquity in degrees 
 * @param date The timestamp.
 * @param unix If true, date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
*/
export function obNutation(date: number, unix = false) {
    if (!unix) {
        const L = mf.mod(280.4665 + 36000.7698*date, 360)*degToRad;
        const Lprime = mf.mod(218.3165 + 481267.8813*date, 360)*degToRad;
        const omega = mf.mod(125.04452 - 1934.136261*date + 0.0020708*date**2 + date**3/450000, 360)*degToRad;
        return (9.2*Math.cos(omega) + 0.57*Math.cos(2*L) + 0.1*Math.cos(2*Lprime) - 0.09*Math.cos(2*omega)) / 3600;
    }
    else {return obNutation(mf.jCentury(date));}
}

/** Nutation in longitude in degrees 
 * @param date The timestamp.
 * @param unix If true, date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
*/
export function longNutation(date: number, unix = false) {
    if (!unix) {
        const L = mf.mod(280.4665 + 36000.7698*date, 360)*degToRad;
        const Lprime = mf.mod(218.3165 + 481267.8813*date, 360)*degToRad;
        const omega = mf.mod(125.04452 - 1934.136261*date + 0.0020708*date**2 + date**3/450000, 360)*degToRad;
        return (-17.2*Math.sin(omega) - 1.32*Math.sin(2*L) - 0.23*Math.sin(2*Lprime) + 0.21*Math.sin(2*omega)) / 3600;
    }
    else {return longNutation(mf.jCentury(date));}
}

/**
 * Returns the obliquity of the ecliptic, or equivalently Earth's axial tilt.
 * @param date The timestamp.
 * @param unix If true, date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
 */
export function obliquity(date: number, unix = false): number {
    if (!unix) {
        const meanObliquity = 23.4392911 + (-46.815*date - 5.9e-4*date**2 + 1.813e-3*date**3) / 3600;
        return meanObliquity + obNutation(date);
    }
    else {return obliquity(mf.jCentury(date));}
}

/**
 * Returns the sun's declination in degrees. This is the latitude of the subsolar point.
 * @param date The timestamp.
 * @param unix If true, date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
 */
export function declination(date: number, unix = false): number {
    if (!unix) {
        const ob = obliquity(date) * degToRad;
        const long = sunTrueLong(date) * degToRad;
        return Math.asin(mf.clamp(Math.sin(ob)*Math.sin(long))) / degToRad;
    }
    else {return declination(mf.jCentury(date))};
}

/**
 * Calculates the sun's right ascension in degrees. To convert to hours, divide by 15.
 * @param date The timestamp.
 * @param unix If true, date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
 */
export function sunRA(date: number, unix = false): number {
    if (!unix) {
        const long = sunTrueLong(date) * degToRad;
        const ob = obliquity(date) * degToRad;
        const ra = Math.atan2(Math.sin(long)*Math.cos(ob), Math.cos(long));
        return mf.mod(ra / degToRad, 360);
    }
    else {return sunRA(mf.jCentury(date));}
}

/**
 * Equation of time in minutes (apparent solar time - mean solar time). Based on equation 27.1 in Astronomical Algorithms.
 * @param date The timestamp.
 * @param unix If true, date is measured in Unix milliseconds. If false, date is Julian centuries since J2000 epoch.
 */
export function equationOfTime(date: number, unix = false): number { 
    if (!unix) {
        const eot = sunMeanLong(date) - 0.0057183 - sunRA(date) + longNutation(date) * Math.cos(obliquity(date)*degToRad); // in degrees
        return mf.mod(4 * eot + 720, 1440) - 720; // reduce to range [-720, 720] if absolute value too large
    }
    else {return equationOfTime(mf.jCentury(date));}
}

/** Gives the value of Greenwich apparent sidereal time (GAST) in degrees, from equation 11.4 in Astronomical Algorithms.
 * The value returned is in the range 0 <= x < 360.
 * @param unix Unix timestamp in milliseconds.
 */
export function gast(unix: number): number {
    const JD = mf.jdUTC(unix); // Julian day but using UTC (approximation to UT1) rather than TT
    const JC = (JD - 2451545) / 36525; // Julian century, but with UTC rather than TT
    const gmst = 280.46061837 + 360.98564736629*(JD-2451545) + 3.87933e-4*JC**2 - JC**3/38710000;
    const correction = longNutation(unix, true) * Math.cos(obliquity(unix, true) * degToRad);
    return mf.mod(gmst + correction, 360);
}

/**
 * Returns apparent solar time given longitude and time, in minutes after solar midnight. 0 is solar midnight, 720 is solar noon.
 * @param longitude Longitude in degrees.
 * @param unix Unix timestamp in milliseconds.
 */
export function solarTime(longitude: number, unix: number): number {
    const timeEq = equationOfTime(unix, true);
    const mst = unix / 60000 + longitude * 4; // mean solar time in minutes
    const ast = mf.mod(timeEq + mst, 1440); // apparent solar time
    return ast;
}

/**
 * Returns the time(s) of solar noon, along with the sun's position at solar noon.
 * @param latitude Latitude in degrees.
 * @param longitude Longitude in degrees.
 * @param start Start date (Unix timestamp, ms)
 * @param end End date (Unix timestamp, ms)
 * @param ecef Observer's ECEF coordinates
 * @returns Time(s) of solar noon, along with the sun's position at solar noon.
 */
export function solarNoon(lat: number, long: number, start: number, end: number, ecef: number[]): SunTime[] {
    const st00 = solarTime(long, start), st24 = solarTime(long, end);
    const stDiff = mf.mod(st24 - st00 - 720, 1440) + 720;
    const solarTimeRate = stDiff / (end - start) * 60000; // rate of solar time change relative to actual time
    if (st00 > 600 && st00 <= 720 && st24 > 720 && st24 < 840) { // 2 solar noons in a day
        let solarNoon0 = start + ((720 - st00) / solarTimeRate) * 60000;
        solarNoon0 += ((720 - solarTime(long, solarNoon0)) * 60000); // refine to 1 ms precision
        solarNoon0 = Math.floor(mf.clamp(solarNoon0, start, end-1));
        const [e0, a0] = sunPosition(lat, long, solarNoon0, ecef); // solar elevation/azimuth at solarNoon0

        let solarNoon1 = end - (60000 * (st24 - 720) / solarTimeRate);
        solarNoon1 += ((720 - solarTime(long, solarNoon1)) * 60000);
        solarNoon1 = Math.floor(mf.clamp(solarNoon1, start, end-1));
        const [e1, a1] = sunPosition(lat, long, solarNoon1, ecef); // solar elevation/azimuth at solarNoon1
        return [new SunTime(solarNoon0, e0, a0, "Solar Noon"), new SunTime(solarNoon1, e1, a1, "Solar Noon")];
    }
    else if (st00 > 720 && st00 < 840 && st24 > 600 && st24 <= 720) { // 0 solar noons in a day
        return [];
    }
    else { // 1 solar noon in a day
        let solarNoon = start + (mf.mod(720 - st00, 1440) / solarTimeRate) * 60000;
        solarNoon += ((720 - solarTime(long, solarNoon)) * 60000);
        solarNoon = Math.floor(mf.clamp(solarNoon, start, end-1));
        const [e, a] = sunPosition(lat, long, solarNoon, ecef);
        return [new SunTime(solarNoon, e, a, "Solar Noon")];
    }
}

/**
 * Returns the time(s) of solar midnight, along with the sun's position at solar midnight.
 * @param latitude Latitude in degrees.
 * @param longitude Longitude in degrees.
 * @param start Start date (Unix timestamp, ms)
 * @param end End date (Unix timestamp, ms)
 * @param ecef Observer's ECEF coordinates
 * @returns Time(s) of solar midnight, along with the sun's position at solar midnight.
 */
export function solarMidnight(lat: number, long: number, start: number, end: number, ecef: number[]): SunTime[] {
    const st00 = solarTime(long, start), st24 = solarTime(long, end);
    const stDiff = mf.mod(st24 - st00 - 720, 1440) + 720;
    const solarTimeRate = stDiff / (end - start) * 60000; // rate of solar time change relative to actual time

    if (st00 > 1320 && st24 < 120) { // 2 solar midnights in a day
        let solarMidnight0 = start + ((1440 - st00) / solarTimeRate) * 60000;
        solarMidnight0 += ((720-mf.mod(solarTime(long,solarMidnight0)+720,1440))*60000);
        solarMidnight0 = Math.floor(mf.clamp(solarMidnight0, start, end-1));
        const [e0, a0] = sunPosition(lat, long, solarMidnight0, ecef); // solar elevation/azimuth at solarMidnight0

        let solarMidnight1 = end - (st24 / solarTimeRate) * 60000;
        solarMidnight1 += ((720-mf.mod(solarTime(long,solarMidnight1)+720,1440))*60000);
        solarMidnight1 = Math.floor(mf.clamp(solarMidnight1, start, end-1));
        const [e1, a1] = sunPosition(lat, long, solarMidnight1, ecef); // solar elevation/azimuth at solarMidnight1
        return [new SunTime(solarMidnight0, e0, a0, "Solar Midnight"), new SunTime(solarMidnight1, e1, a1, "Solar Midnight")];
    }
    else if (st00 < 120 && st24 > 1320) { // 0 solar midnights in a day
        return [];
    }
    else { // 1 solar midnight in a day
        let solarMidnight = end - (st24 / solarTimeRate) * 60000;
        solarMidnight += ((720-mf.mod(solarTime(long,solarMidnight)+720,1440))*60000);
        solarMidnight = Math.floor(mf.clamp(solarMidnight, start, end-1));
        const [e, a] = sunPosition(lat, long, solarMidnight, ecef);
        return [new SunTime(solarMidnight, e, a, "Solar Midnight")];
    }
}

/**
 * Returns the subsolar point, or location on Earth at which the sun is directly overhead.
 * @param date Unix timestamp in milliseconds, or Luxon DateTime object.
 * @returns [latitude, longitude] of subsolar point
 */
export function subsolarPoint(date: number | DateTime = Date.now()): number[] {
    if (typeof(date) == "number") {
        const JC = mf.jCentury(date);
        const subsolarLat = declination(JC);
        const soltime0 = solarTime(0, date); // solar time at Greenwich meridian (longitude 0)
        const subsolarLong = mf.mod(-soltime0/4, 360) - 180;
        return [subsolarLat, subsolarLong];
    } 
    else {return subsolarPoint(mf.ms(date));}
}

/**
 * Returns sun position given latitude, longitude, and DateTime.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param date Unix timestamp in milliseconds, or Luxon DateTime
 * @param ecefO Observer's ECEF (optional)
 * @returns Array: [elevation, azimuth]. Elevation is in degrees above horizon, azimuth is degrees clockwise from north
 * Solar elevation is not refracted. To find the solar elevation angle adjusted for atmospheric refraction, use refract(sunPosition[0])
 */
export function sunPosition(lat: number, long: number, date: number | DateTime, ecefO?: number[]): number[] {
    if (typeof(date) == "number") {
        const [sunLat, sunLong] = subsolarPoint(date);
        const sunEcef = mf.toEcef(sunLat, sunLong, sunDistance(date, true));
        /* Note: Geodetic latitude of subsolar point is the same as geocentric latitude at which the sun-Earth center line intersects 
        the ellipsoid. Subsolar point is where the surface normal intersects the sun. */
        if (ecefO === undefined) {return mf.elevAzimuth(lat, long, mf.latLongEcef(lat, long), sunEcef);}
        else {return mf.elevAzimuth(lat, long, ecefO, sunEcef);}
    }
    else {return subsolarPoint(mf.ms(date));}
}

/**
 * The number of degrees by which the sun's apparent elevation increases due to atmospheric refraction.
 * @param elev Solar elevation angle before refraction.
 */
export function refraction(elev: number): number {
    /** Formula for elevations greater than -5/6 is from Astronomical Algorithms by Jean Meeus (formula 15.4, page 102). 
     * For elevations below this, it is smoothed to 0 with a function proportional to the cotangent. */ 
    if (elev <= -5/6) {return -0.0089931/Math.tan(elev*degToRad);}
    else {return (1.02 / Math.tan((elev+10.3/(elev+5.11))*degToRad) + 0.001927) / 60;}
}

/**
 * Adjusts the given solar elevation angle (elev) to account for atmospheric refraction.
 */
export function refract(elev: number): number {
    return elev + refraction(elev);
}

/** Returns the approximate derivative of the solar elevation angle at a particular time, in degrees per second. */
export function derivative(lat: number, long: number, unix: number, ecef: number[]) {
    return sunPosition(lat, long, unix+500, ecef)[0] - sunPosition(lat, long, unix-500, ecef)[0];
}

/**
 * Returns an array of DateTime objects, representing the start of the current day, the times at which the derivative of solar
 * elevation angle is 0, and the start of the next day. This is a helper function for "dawn" and "dusk" functions below.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param start Start of day (Unix milliseconds)
 * @param end End of day (Unix milliseconds)
 * @param ecef Observer's ECEF coordinates
 * @returns Unix timestamps at which sun reaches relative min or max altitude, along with both the start and end of the day.
 */
export function maxAndMin(lat: number, long: number, start: number, end: number, ecef: number[]): number[] {
    const times = [start];
    const intervals = [start,start+4*3.6e6,start+8*3.6e6,start+12*3.6e6,start+16*3.6e6,start+20*3.6e6,end];
    for (let i=0; i<intervals.length-1; i++) {
        // use binary search to find the time closest to zero derivative
        let t0 = intervals[i], t1 = intervals[i+1];
        const d0 = derivative(lat, long, t0, ecef), d1 = derivative(lat, long, t1, ecef);
        if (d0 >= 0 && d1 < 0) { // maximum (i.e. solar noon, or summer solstice at pole)
            while (t1 - t0 > 1) {
                const tAvg = Math.floor((t0+t1)/2);
                const dAvg = derivative(lat, long, tAvg, ecef);
                if (dAvg >= 0) {t0 = tAvg;}
                else {t1 = tAvg;}
            }
            times.push(t0);
        }
        else if (d0 <= 0 && d1 > 0) { // minimum (i.e. solar midnight, or winter solstice at pole)
            while (t1 - t0 > 1) {
                const tAvg = Math.floor((t0+t1)/2);
                const dAvg = derivative(lat, long, tAvg, ecef);
                if (dAvg <= 0) {t0 = tAvg;}
                else {t1 = tAvg;}
            }
            times.push(t0);
        }
    }
    times.push(end);
    return times;
}

/**
 * Calculates the time in the morning at which the sun's elevation reaches the specified angle. Angle should be -5/6 for sunrise,
 * -6 for civil twilight, -12 for nautical twilight, and -18 for astronomical twilight.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param angle Solar elevation angle in degrees
 * @param type "Sunrise", "Civil Dawn", "Nautical Dawn" or "Astro Dawn"
 * @param ecef Observer's ECEF
 * @param maxMin Results of maxAndMin() for given day
 * @returns SunTime object, which includes a DateTime, the sun's elevation & azimuth and a tag for the type of dawn/sunrise.
 */
export function dawn(lat: number, long: number, angle: number, type: string, ecef: number[], maxMin: number[]): 
SunTime[] {
    const dawnTimes = [];
    for (let i=0; i<maxMin.length-1; i++) {
        let t0 = maxMin[i], t1 = maxMin[i+1];
        const s0 = sunPosition(lat, long, t0, ecef), s1 = sunPosition(lat, long, t1, ecef);
        if (s0[0] <= angle && s1[0] >= angle) {
            while (t1 - t0 > 1) {
                const avg = Math.floor((t0+t1)/2);
                if (sunPosition(lat, long, avg, ecef)[0] < angle) {t0 = avg;}
                else {t1 = avg;}
            }
            const [elev, az] = sunPosition(lat, long, t0, ecef);
            dawnTimes.push(new SunTime(t0, elev, az, type));
        }
    }
    return dawnTimes;
}

/**
 * Calculates the time in the evening at which the sun's elevation reaches the specified angle. Angle should be -5/6 for sunset,
 * -6 for civil twilight, -12 for nautical twilight, and -18 for astronomical twilight.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param angle Solar elevation angle in degrees
 * @param type "Sunset", "Civil Dusk", "Nautical Dusk", "Astro Dusk"
 * @param ecef Observer's ECEF
 * @param maxMin Results of maxAndMin() for given day
 * @returns SunTime object, which includes a DateTime, the sun's elevation & azimuth and a tag for the type of dusk/sunset.
 */
export function dusk(lat: number, long: number, angle: number, type: string, ecef: number[], maxMin: number[]): 
SunTime[] {
    const duskTimes = [];
    for (let i=0; i<maxMin.length-1; i++) {
        let t0 = maxMin[i], t1 = maxMin[i+1];
        const s0 = sunPosition(lat, long, t0, ecef)[0], s1 = sunPosition(lat, long, t1, ecef)[0];
        if (s0 >= angle && s1 <= angle) {
            while (t1 - t0 > 1) {
                const avg = Math.floor((t0+t1)/2);
                if (sunPosition(lat, long, avg, ecef)[0] < angle) {t1 = avg;}
                else {t0 = avg;}
            }
            const [elev, az] = sunPosition(lat, long, t0, ecef);
            duskTimes.push(new SunTime(t0, elev, az, type));
        }
    }
    return duskTimes;
}

export function sunrise(lat: number, long: number, ecef: number[], maxMin: number[]) {
    return dawn(lat, long, -5/6, "Sunrise", ecef, maxMin);
} 
export function sunset(lat: number, long: number, ecef: number[], maxMin: number[]) {
    return dusk(lat, long, -5/6, "Sunset", ecef, maxMin);
}
export function civilDawn(lat: number, long: number, ecef: number[], maxMin: number[]) {
    return dawn(lat, long, -6, "Civil Dawn", ecef, maxMin);
}
export function civilDusk(lat: number, long: number, ecef: number[], maxMin: number[]) {
    return dusk(lat, long, -6, "Civil Dusk", ecef, maxMin);
}
export function nauticalDawn(lat: number, long: number, ecef: number[], maxMin: number[]) {
    return dawn(lat, long, -12, "Nautical Dawn", ecef, maxMin);
}
export function nauticalDusk(lat: number, long: number, ecef: number[], maxMin: number[]) {
    return dusk(lat, long, -12, "Nautical Dusk", ecef, maxMin);
}
export function astroDawn(lat: number, long: number, ecef: number[], maxMin: number[]) {
    return dawn(lat, long, -18, "Astro Dawn", ecef, maxMin);
}
export function astroDusk(lat: number, long: number, ecef: number[], maxMin: number[]) {
    return dusk(lat, long, -18, "Astro Dusk", ecef, maxMin);
}

/**
 * Returns day length in seconds (time from sunrise to sunset). If sunset is after midnight or sunrise is before midnight (due to
 * time zone complexities and DST), it returns the number of seconds the sun is up from solar midnight to the next solar midnight.
 * @param sunEventsYesterday The value of allSunEvents() for yesterday.
 * @param sunEventsToday The value of allSunEvents() for today.
 * @param sunEventsTomorrow The value of allSunEvents() for tomorrow.
 */
export function dayLength(sunEventsYesterday: number[], sunEventsToday: number[], sunEventsTomorrow: number[]) {
    return -1; // placeholder
}

export function allSunEvents(lat: number, long: number, start: number, end: number, ecef?: number[]): SunTime[] {
    if (ecef === undefined) {ecef = mf.latLongEcef(lat, long);}
    const maxMin = maxAndMin(lat, long, start, end, ecef);
    const midnight = solarMidnight(lat, long, start, end, ecef);
    const adawn = astroDawn(lat, long, ecef, maxMin);
    const ndawn = nauticalDawn(lat, long, ecef, maxMin);
    const cdawn = civilDawn(lat, long, ecef, maxMin);
    const rise = sunrise(lat, long, ecef, maxMin);
    const noon = solarNoon(lat, long, start, end, ecef);
    const set = sunset(lat, long, ecef, maxMin);
    const cdusk = civilDusk(lat, long, ecef, maxMin);
    const ndusk = nauticalDusk(lat, long, ecef, maxMin);
    const adusk = astroDusk(lat, long, ecef, maxMin);
    const events = [...midnight, ...adawn, ...ndawn, ...cdawn, ...rise, ...noon, ...set, ...cdusk, ...ndusk, ...adusk];
    events.sort((a, b) => a.valueOf() - b.valueOf());
    return events;
}

/** Given a date, returns an array with sunrise, sunset, dawn, dusk, solar noon, and solar midnight times for the given date. 
 * @param lat Latitude of observer
 * @param long Longitude of observer
 * @param date Luxon DateTime (can be any point within the given day)
 * @param ecef Observer's ECEF coordinates
*/
export function sunEventsDay(lat: number, long: number, date: DateTime, ecef: number[]): SunTime[] {
    const start = date.startOf("day").toMillis();
    const end = date.plus({days: 1}).startOf("day").toMillis();
    const zone = (typeof(date.zoneName) == "string") ? date.zoneName : "utc";
    return allSunEvents(lat, long, start, end, ecef);
}

/** Calculates the Unix millisecond timestamp of the solstice or equinox in the given month and year.
 * Month must be 3, 6, 9 or 12.
 */
export function calcSolstEq(year = DateTime.now().toUTC().year, month: number) {
    let t0 = mf.ms(DateTime.fromObject({year:year, month:month, day:10}, {zone: "utc"}));
    let t1 = t0 + 18*86400*1000; // 18 days after start
    while (t1 - t0 > 1) {
        const avg = Math.floor((t0+t1)/2);
        if (month == 3) {(sunTrueLong(avg, true) >= 180) ? t0 = avg : t1 = avg;}
        else {(sunTrueLong(avg, true) <= 30*(month-3)) ? t0 = avg : t1 = avg;}
    }
    return t0;
}

/**
 * Reads solstices and equinoxes from the solstices_equinoxes.json file.
 * @param year Year (example: 2025)
 * @param month Month of solstice or equinox. Must be 3, 6, 9, or 12.
 * @param zone Time zone (example: "utc" or "America/Los_Angeles")
 * @returns An object containing solstices and equinoxes for the given year and time zone. The object contains 4 values:
 * marEquinox, junSolstice, sepEquinox, and decSolstice. Each of these is a Luxon DateTime.
 */
export function getSolstEq(year: number, zone: string = "utc"): SeasonEvents {
    const data = fs.readFileSync("./solstices_equinoxes.json", "utf8");
    const array = JSON.parse(data);
    const n = year - array[0].year;
    if (n < 0 || n >= array.length) {throw new Error("Index out of bounds");}
    const me = DateTime.fromMillis(array[n].marEquinox, {zone: zone});
    const js = DateTime.fromMillis(array[n].junSolstice, {zone: zone});
    const se = DateTime.fromMillis(array[n].sepEquinox, {zone: zone});
    const ds = DateTime.fromMillis(array[n].decSolstice, {zone: zone});
    return {marEquinox: me, junSolstice: js, sepEquinox: se, decSolstice: ds};
}

/**
 * Returns intervals of day, civil twilight, nautical twilight, astronomical twilight, and night during a particular day.
 * Time is measured in milliseconds since midnight. It is not adjusted for DST, so "4 pm" is always represented as 16*60*60*1000 =
 * 57600000.
 * @param sunEvents Array returned by allSunEvents
 * @param timeZone Time zone of the given location (ex. "America/Los_Angeles") or a time zone lookup table
 * @returns Array with intervals of [day, civil twilight, nautical twilight, astronomical twilight, night].
 */
export function intervals(sunEvents: SunTime[], timeZone: string | mf.TimeChange[]) {
    const newSunEvents = []; // sunEvents without solar noon or midnight
    const ints : number[][][] = [[], [], [], [], []]; // intervals of day, civil twilight, nautical twilight, astronomical twilight, and night

    for (const event of sunEvents) {
        if (event.eventType != "Solar Noon" && event.eventType != "Solar Midnight") {newSunEvents.push(event);}
    }

    if (newSunEvents.length == 0) { // no sunrise, sunset, dawn, or dusk
        const sunAngle = sunEvents[0].solarElevation;
        if (sunAngle < -18) {return [[], [], [], [], [[0, DAY_LENGTH]]];}
        else if (sunAngle < -12) {return [[], [], [], [[0, DAY_LENGTH]], []];}
        else if (sunAngle < -6) {return [[], [], [[0, DAY_LENGTH]], [], []];}
        else if (sunAngle < -5/6) {return [[], [[0, DAY_LENGTH]], [], [], []];}
        else {return [[[0, DAY_LENGTH]], [], [], [], []];}
    }
    
    let etype = newSunEvents[0].eventType;
    if (etype == "Sunset") {ints[0].push([0, newSunEvents[0].timeOfDay(timeZone)]);}
    else if (etype == "Sunrise" || etype == "Civil Dusk") {ints[1].push([0, newSunEvents[0].timeOfDay(timeZone)]);}
    else if (etype == "Civil Dawn" || etype == "Nautical Dusk") {ints[2].push([0, newSunEvents[0].timeOfDay(timeZone)]);}
    else if (etype == "Nautical Dawn" || etype == "Astro Dusk") {ints[3].push([0, newSunEvents[0].timeOfDay(timeZone)]);}
    else if (etype == "Astro Dawn") {ints[4].push([0, newSunEvents[0].timeOfDay(timeZone)]);}

    for (let i=0; i<newSunEvents.length-1; i++) {
        etype = newSunEvents[i+1].eventType;
        const t0 = newSunEvents[i].timeOfDay(timeZone);
        const t1 = newSunEvents[i+1].timeOfDay(timeZone);
        if (etype == "Sunset") {ints[0].push([t0, t1]);}
        else if (etype == "Sunrise" || etype == "Civil Dusk") {ints[1].push([t0, t1]);}
        else if (etype == "Civil Dawn" || etype == "Nautical Dusk") {ints[2].push([t0, t1]);}
        else if (etype == "Nautical Dawn" || etype == "Astro Dusk") {ints[3].push([t0, t1]);}
        else if (etype == "Astro Dawn") {ints[4].push([t0, t1]);}
    }

    const lastTime = newSunEvents[newSunEvents.length-1].timeOfDay(timeZone);
    if (etype == "Sunrise") {ints[0].push([lastTime, DAY_LENGTH]);}
    else if (etype == "Civil Dawn" || etype == "Sunset") {ints[1].push([lastTime, DAY_LENGTH]);}
    else if (etype == "Nautical Dawn" || etype == "Civil Dusk") {ints[2].push([lastTime, DAY_LENGTH]);}
    else if (etype == "Astro Dawn" || etype == "Nautical Dusk") {ints[3].push([lastTime, DAY_LENGTH]);}
    else if (etype == "Astro Dusk") {ints[4].push([lastTime, DAY_LENGTH]);}

    return ints;
}

/**
 * Intervals of daylight and each stage of twilight for use in SVG diagram generation.
 * @param sunEvents Value returned from the "allSunEvents" function on the given day.
 * @param timeZone Time zone, either as IANA identifier or lookup table.
 * @returns Array of arrays of arrays of numbers: [dIntervals, cIntervals, nIntervals, aIntervals].
 * 
 * dIntervals: Intervals of daylight, where the sun's unrefracted elevation angle >= -5/6°.
 * 
 * cIntervals: Intervals of civil twilight or brighter (sun angle >= -6°).
 * 
 * nIntervals: Intervals of nautical twilight or brighter (sun angle >= -12°).
 * 
 * aIntervals: Intervals of astronomical twilight or brighter (sun angle >= -18°).
 */
export function intervalsSvg(sunEvents: SunTime[], timeZone: string | mf.TimeChange[]) {
    const newSunEvents = []; // sunEvents without solar noon or midnight

    for (const event of sunEvents) {
        if (event.eventType != "Solar Noon" && event.eventType != "Solar Midnight") {newSunEvents.push(event);}
    }

    if (newSunEvents.length == 0) { // no sunrise, sunset, dawn, or dusk
        const s = sunEvents[0].solarElevation;
        if (s < -18) {return [[], [], [], []];}
        else if (s < -12) {return [[], [], [], [[0, DAY_LENGTH]]];}
        else if (s < -6) {return [[], [], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]]];}
        else if (s < -5/6) {return [[], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]]];}
        else {return [[[0, DAY_LENGTH]], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]]];}
    }

    const dIntervals: number[][] = []; // intervals of daylight
    const cIntervals: number[][] = []; // daylight + civil twilight
    const nIntervals: number[][] = []; // daylight + civil twilight + nautical twilight
    const aIntervals: number[][] = []; // daylight + civil twilight + nautical twilight + astronomical twilight
    
    let etype = newSunEvents[0].eventType;
    let ms = newSunEvents[0].timeOfDay(timeZone);

    // push the first interval
    if (etype == "Astro Dawn") {
        aIntervals.push([ms, DAY_LENGTH]);
    } else if (etype == "Nautical Dawn") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([ms, DAY_LENGTH]);
    } else if (etype == "Civil Dawn") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, DAY_LENGTH]);
        cIntervals.push([ms, DAY_LENGTH]);
    } else if (etype == "Sunrise") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, DAY_LENGTH]);
        cIntervals.push([0, DAY_LENGTH]);
        dIntervals.push([ms, DAY_LENGTH]);
    } else if (etype == "Sunset") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, DAY_LENGTH]);
        cIntervals.push([0, DAY_LENGTH]);
        dIntervals.push([0, ms]);
    } else if (etype == "Civil Dusk") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, DAY_LENGTH]);
        cIntervals.push([0, ms]);
    } else if (etype == "Nautical Dusk") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, ms]);
    } else if (etype == "Astro Dusk") {
        aIntervals.push([0, ms]);
    }

    for (let i=1; i<newSunEvents.length; i++) {
        etype = newSunEvents[i].eventType;
        ms = newSunEvents[i].timeOfDay(timeZone);
        if (etype == "Astro Dawn") {aIntervals.push([ms, DAY_LENGTH]);}
        else if (etype == "Nautical Dawn") {nIntervals.push([ms, DAY_LENGTH]);}
        else if (etype == "Civil Dawn") {cIntervals.push([ms, DAY_LENGTH]);}
        else if (etype == "Sunrise") {dIntervals.push([ms, DAY_LENGTH]);}
        else if (etype == "Sunset") {dIntervals[dIntervals.length-1][1] = ms;}
        else if (etype == "Civil Dusk") {cIntervals[cIntervals.length-1][1] = ms;}
        else if (etype == "Nautical Dusk") {nIntervals[nIntervals.length-1][1] = ms;}
        else if (etype == "Astro Dusk") {aIntervals[aIntervals.length-1][1] = ms;}
    }

    return [dIntervals, cIntervals, nIntervals, aIntervals];
}

/**
 * Returns the lengths of day combined with different stages of twilight.
 * @param sunEvents The return value of the allSunEvents command at a particular place and date.
 * @param timeZone Time zone, either as IANA identifier or lookup table.
 * @returns An array [t0, t1, t2, t3]. The values are as follows:
 * @t0: Day length
 * @t1: Day + civil twilight
 * @t2: Day + civil twilight + nautical twilight
 * @t3: Day + civil twilight + nautical twilight + astronomical twilight
 */
export function lengths(sunEvents: SunTime[], timeZone: string | mf.TimeChange[]) {
    const newSunEvents = []; // sunEvents without solar noon or midnight
    const durations = [0, 0, 0, 0]; // durations
    for (const event of sunEvents) {
        if (event.eventType != "Solar Noon" && event.eventType != "Solar Midnight") {newSunEvents.push(event);}
    }

    if (newSunEvents.length == 0) { // no sunrise, sunset, dawn, or dusk
        const s = sunEvents[0].solarElevation;
        if (s < -18) {return [0, 0, 0, 0];} // night all day
        else if (s < -12) {return [0, 0, 0, DAY_LENGTH];} // astronomical twilight all day
        else if (s < -6) {return [0, 0, DAY_LENGTH, DAY_LENGTH];} // nautical twilight all day
        else if (s < -5/6) {return [0, DAY_LENGTH, DAY_LENGTH, DAY_LENGTH];} // civil twilight all day
        else {return [DAY_LENGTH, DAY_LENGTH, DAY_LENGTH, DAY_LENGTH];} // daylight all day
    }

    let etype = newSunEvents[0].eventType;
    let ms = newSunEvents[0].timeOfDay(timeZone);
    if (etype == "Nautical Dawn" || etype == "Astro Dusk") {durations[3] += ms;}
    else if (etype == "Civil Dawn" || etype == "Nautical Dusk") {durations[2] += ms;}
    else if (etype == "Sunrise" || etype == "Civil Dusk") {durations[1] += ms;}
    else if (etype == "Sunset") {durations[0] += ms;}

    for (let i=0; i<newSunEvents.length-1; i++) {
        etype = newSunEvents[i+1].eventType;
        ms = newSunEvents[i+1].timeOfDay(timeZone) - newSunEvents[i].timeOfDay(timeZone);
        if (etype == "Nautical Dawn" || etype == "Astro Dusk") {durations[3] += ms;}
        else if (etype == "Civil Dawn" || etype == "Nautical Dusk") {durations[2] += ms;}
        else if (etype == "Sunrise" || etype == "Civil Dusk") {durations[1] += ms;}
        else if (etype == "Sunset") {durations[0] += ms;}
    }

    ms = DAY_LENGTH - newSunEvents[newSunEvents.length-1].timeOfDay(timeZone);
    if (etype == "Astro Dawn" || etype == "Nautical Dusk") {durations[3] += ms;}
    else if (etype == "Nautical Dawn" || etype == "Civil Dusk") {durations[2] += ms;}
    else if (etype == "Civil Dawn" || etype == "Sunset") {durations[1] += ms;}
    else if (etype == "Sunrise") {durations[0] += ms;}

    return [durations[0], 
    durations[0]+durations[1], 
    durations[0]+durations[1]+durations[2],
    durations[0]+durations[1]+durations[2]+durations[3]];
}