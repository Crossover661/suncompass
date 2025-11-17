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
import { clamp, mod, mins, jCentury, startOfDay, startNextDay, convertToMS, ms, jdUTC, geocentric2geodetic, toEcef, elevAzimuth } from "./mathfuncs.js";
import { DateTime } from "luxon";
import { degToRad, sunPeriodicTerms } from "./constants.js";
import * as fs from "fs";
import SunTime from "./SunTime.js";
const DAY_LENGTH = 86400000; // day length in milliseconds, used for generating intervals and SVG charts
/** Sun's mean longitude according to formula 27.2 in Astronomical Algorithms. */
export function sunMeanLong(date) {
    if (typeof (date) == "number") {
        const m = date / 10; // Julian millennium
        return mod(280.4664567 + 360007.6982779 * m + 0.03032028 * m ** 2 + m ** 3 / 49931 - m ** 4 / 15299 - m ** 5 / 1988000, 360);
    }
    else {
        return sunMeanLong(jCentury(date));
    }
}
/** Sun's geometric longitude, i.e. longitude excluding aberration and nutation. */
export function sunGeomLong(date) {
    if (typeof (date) == "number") {
        const U = date / 100;
        let long = 4.9353929 + 62833.196168 * U;
        for (let i = 0; i < sunPeriodicTerms.length; i++) {
            const curRow = sunPeriodicTerms[i];
            long += (1e-7 * (curRow[0] * Math.sin(curRow[2] + curRow[3] * U)));
        }
        return mod(long / degToRad, 360);
    }
    else {
        return sunGeomLong(jCentury(date));
    }
}
/** Formula 45.3, in page 308 of Astronomical Algorithms */
export function meanSunAnomaly(JC) { return mod(357.5291092 + 35999.0502909 * JC - 1.536e-4 * JC ** 2 + JC ** 3 / 24490000, 360); }
export function eccentricity(JC) { return 0.016708617 - 4.2037e-5 * JC - 1.236e-7 * JC ** 2; }
export function equationOfCenter(JC) {
    const anom = meanSunAnomaly(JC) * degToRad;
    return (1.9146 - 0.004817 * JC - 1.4e-5 * JC ** 2) * Math.sin(anom) +
        (0.019993 - 1.01e-4 * JC) * Math.sin(2 * anom) +
        2.9e-4 * Math.sin(3 * anom);
}
export function sunAnomaly(JC) { return meanSunAnomaly(JC) + equationOfCenter(JC); }
/** Distance from sun to earth in kilometers. */
export function sunDistance(date) {
    if (typeof (date) == "number") {
        const ecc = eccentricity(date);
        return (149598023 * (1 - ecc ** 2)) / (1 + ecc * Math.cos(sunAnomaly(date) * degToRad));
    }
    else {
        return sunDistance(jCentury(date));
    }
}
/**
 * Calculates the sun's apparent ecliptic longitude to within 0.0009 degrees for years 0-3000. This value is 0 at the March equinox,
 * 90 at the June solstice, 180 at the September equinox, and 270 at the December solstice.
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
export function sunTrueLong(date) {
    if (typeof (date) == "number") {
        const U = date / 100;
        const geoLong = sunGeomLong(date);
        const aberration = 1e-7 * (17 * Math.cos(3.1 + 62830.14 * U) - 993) / degToRad;
        const nutation = 1e-7 * (-834 * Math.sin(2.18 - 3375.7 * U + 0.36 * U ** 2) - 64 * Math.sin(3.51 + 125666.39 * U + 0.1 * U ** 2)) / degToRad;
        return mod(geoLong + aberration + nutation, 360);
    }
    else {
        return sunTrueLong(jCentury(date));
    }
}
/** Nutation in obliquity in degrees */
export function obNutation(date) {
    if (typeof (date) == "number") {
        const L = mod(280.4665 + 36000.7698 * date, 360) * degToRad;
        const Lprime = mod(218.3165 + 481267.8813 * date, 360) * degToRad;
        const omega = mod(125.04452 - 1934.136261 * date + 0.0020708 * date ** 2 + date ** 3 / 450000, 360) * degToRad;
        return (9.2 * Math.cos(omega) + 0.57 * Math.cos(2 * L) + 0.1 * Math.cos(2 * Lprime) - 0.09 * Math.cos(2 * omega)) / 3600;
    }
    else {
        return obNutation(jCentury(date));
    }
}
/** Nutation in longitude in degrees */
export function longNutation(date) {
    if (typeof (date) == "number") {
        const L = mod(280.4665 + 36000.7698 * date, 360) * degToRad;
        const Lprime = mod(218.3165 + 481267.8813 * date, 360) * degToRad;
        const omega = mod(125.04452 - 1934.136261 * date + 0.0020708 * date ** 2 + date ** 3 / 450000, 360) * degToRad;
        return (-17.2 * Math.sin(omega) - 1.32 * Math.sin(2 * L) - 0.23 * Math.sin(2 * Lprime) + 0.21 * Math.sin(2 * omega)) / 3600;
    }
    else {
        return longNutation(jCentury(date));
    }
}
/**
 * Returns the obliquity of the ecliptic, or equivalently Earth's axial tilt.
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
export function obliquity(date) {
    if (typeof (date) == "number") {
        const meanObliquity = 23.4392911 + (-46.815 * date - 5.9e-4 * date ** 2 + 1.813e-3 * date ** 3) / 3600;
        return meanObliquity + obNutation(date);
    }
    else {
        return obliquity(jCentury(date));
    }
}
/**
 * Returns the sun's declination in degrees. This is the geocentric latitude of the subsolar point.
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
export function declination(date) {
    if (typeof (date) == "number") {
        const ob = obliquity(date) * degToRad;
        const long = sunTrueLong(date) * degToRad;
        return Math.asin(clamp(Math.sin(ob) * Math.sin(long))) / degToRad;
    }
    else {
        return declination(jCentury(date));
    }
    ;
}
/**
 * Calculates the sun's right ascension in degrees. To convert to hours, divide by 15.
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
export function sunRA(date) {
    if (typeof (date) == "number") {
        const long = sunTrueLong(date) * degToRad;
        const ob = obliquity(date) * degToRad;
        const ra = Math.atan2(Math.sin(long) * Math.cos(ob), Math.cos(long));
        return mod(ra / degToRad, 360);
    }
    else {
        return sunRA(jCentury(date));
    }
}
/**
 * Equation of time in minutes (apparent solar time - mean solar time). Based on equation 27.1 in Astronomical Algorithms.
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
export function equationOfTime(date) {
    if (typeof (date) == "number") {
        const eot = sunMeanLong(date) - 0.0057183 - sunRA(date) + longNutation(date) * Math.cos(obliquity(date) * degToRad); // in degrees
        return mod(4 * eot + 720, 1440) - 720; // reduce to range [-720, 720] if absolute value too large
    }
    else {
        return equationOfTime(jCentury(date));
    }
}
/** Gives the value of Greenwich apparent sidereal time (GAST) in degrees, from equation 11.4 in Astronomical Algorithms.
 * The value returned is in the range 0 <= x < 360.
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
export function gast(date) {
    const JD = jdUTC(date); // Julian day but using UTC (approximation to UT1) rather than TT
    const JC = (JD - 2451545) / 36525; // Julian century, but with UTC rather than TT
    const gmst = 280.46061837 + 360.98564736629 * (JD - 2451545) + 3.87933e-4 * JC ** 2 - JC ** 3 / 38710000;
    const correction = longNutation(date) * Math.cos(obliquity(date) * degToRad);
    return mod(gmst + correction, 360);
}
/**
 * Returns sun's angular radius in degrees. To find the angular diameter, multiply this value by 2.
 * @param date A Luxon DateTime object.
 */
export function sunAngularRadius(date) {
    return (695700 / sunDistance(date)) / degToRad;
}
/**
 * Returns apparent solar time given longitude and time, in minutes after solar midnight. 0 is solar midnight, 720 is solar noon.
 * @param longitude Longitude in degrees.
 * @param date A Luxon DateTime object.
 */
export function solarTime(longitude, date) {
    const timeEq = equationOfTime(date);
    return mod(mins(date) + timeEq + 4 * longitude - date.offset, 1440);
}
/**
 * Returns the time(s) of solar noon, along with the sun's position at solar noon.
 * @param longitude Longitude in degrees.
 * @param date SunTime object, which includes a DateTime, the sun's elevation & azimuth and a tag for solar noon.
 * @returns
 */
export function solarNoon(lat, long, date) {
    const beginningOfDay = startOfDay(date);
    const endOfDay = startNextDay(date);
    const dayLength = endOfDay.diff(beginningOfDay).as("minutes"); // usually 1440, can be 1380 or 1500 with DST
    const st00 = solarTime(long, beginningOfDay);
    const st24 = solarTime(long, endOfDay);
    const stDiff = mod(st24 - st00 - 720, 1440) + 720;
    const solarTimeRate = stDiff / dayLength; // the rate at which solar time changes through the day, relative to actual time
    if (st00 > 600 && st00 <= 720 && st24 > 720 && st24 < 840) { // 2 solar noons in a day
        let solarNoon0 = beginningOfDay.plus({ minutes: (720 - st00) / solarTimeRate });
        solarNoon0 = solarNoon0.plus((720 - solarTime(long, solarNoon0)) * 60000); // refine to 1 ms precision
        if (solarNoon0 < beginningOfDay) {
            solarNoon0 = beginningOfDay;
        }
        const [e0, a0] = sunPosition(lat, long, solarNoon0); // solar elevation/azimuth at solarNoon0
        let solarNoon1 = endOfDay.minus({ minutes: (st24 - 720) / solarTimeRate });
        solarNoon1 = solarNoon1.plus((720 - solarTime(long, solarNoon1)) * 60000);
        if (solarNoon1 >= endOfDay) {
            solarNoon1 = endOfDay.minus(1);
        }
        const [e1, a1] = sunPosition(lat, long, solarNoon1); // solar elevation/azimuth at solarNoon1
        return [new SunTime(solarNoon0, e0, a0, "Solar Noon"), new SunTime(solarNoon1, e1, a1, "Solar Noon")];
    }
    else if (st00 > 720 && st00 < 840 && st24 > 600 && st24 <= 720) { // 0 solar noons in a day
        return [];
    }
    else { // 1 solar noon in a day
        let solarNoon = beginningOfDay.plus({ minutes: mod(720 - st00, 1440) / solarTimeRate });
        solarNoon = solarNoon.plus((720 - solarTime(long, solarNoon)) * 60000);
        if (solarNoon < beginningOfDay) {
            solarNoon = beginningOfDay;
        }
        else if (solarNoon >= endOfDay) {
            solarNoon = endOfDay.minus(1);
        }
        const [e, a] = sunPosition(lat, long, solarNoon);
        return [new SunTime(solarNoon, e, a, "Solar Noon")];
    }
}
/**
 * Returns the time(s) of solar midnight, along with the sun's position at solar midnight.
 * @param longitude Longitude in degrees.
 * @param date SunTime object, which includes a DateTime, the sun's elevation & azimuth and a tag for solar midnight.
 * @returns
 */
export function solarMidnight(lat, long, date) {
    const beginningOfDay = startOfDay(date);
    const endOfDay = startNextDay(date);
    const dayLength = endOfDay.diff(beginningOfDay).as("minutes"); // usually 1440, can be 1380 or 1500 with DST
    const st00 = solarTime(long, beginningOfDay);
    const st24 = solarTime(long, endOfDay);
    const stDiff = mod(st24 - st00 - 720, 1440) + 720;
    const solarTimeRate = stDiff / dayLength; // the rate at which solar time changes through the day, relative to actual time
    if (st00 > 1320 && st24 < 120) { // 2 solar midnights in a day
        let solarMidnight0 = beginningOfDay.plus({ minutes: (1440 - st00) / solarTimeRate });
        solarMidnight0 = solarMidnight0.plus((720 - mod(solarTime(long, solarMidnight0) + 720, 1440)) * 60000);
        if (solarMidnight0 < beginningOfDay) {
            solarMidnight0 = beginningOfDay;
        }
        const [e0, a0] = sunPosition(lat, long, solarMidnight0); // solar elevation/azimuth at solarMidnight0
        let solarMidnight1 = endOfDay.minus({ minutes: st24 / solarTimeRate });
        solarMidnight1 = solarMidnight1.plus((720 - mod(solarTime(long, solarMidnight1) + 720, 1440)) * 60000);
        if (solarMidnight1 >= endOfDay) {
            solarMidnight1 = endOfDay.minus(1);
        }
        const [e1, a1] = sunPosition(lat, long, solarMidnight1); // solar elevation/azimuth at solarMidnight1
        return [new SunTime(solarMidnight0, e0, a0, "Solar Midnight"), new SunTime(solarMidnight1, e1, a1, "Solar Midnight")];
    }
    else if (st00 < 120 && st24 > 1320) { // 0 solar midnights in a day
        return [];
    }
    else { // 1 solar midnight in a day
        let solarMidnight = endOfDay.minus({ minutes: st24 / solarTimeRate });
        solarMidnight = solarMidnight.plus((720 - mod(solarTime(long, solarMidnight) + 720, 1440)) * 60000);
        if (solarMidnight < beginningOfDay) {
            solarMidnight = beginningOfDay;
        }
        else if (solarMidnight >= endOfDay) {
            solarMidnight = endOfDay.minus(1);
        }
        const [e, a] = sunPosition(lat, long, solarMidnight);
        return [new SunTime(solarMidnight, e, a, "Solar Midnight")];
    }
}
/**
 * Returns the subsolar point, or location on Earth at which the sun is directly overhead.
 * @param date Luxon DateTime object.
 * @param geocentric If false (default), outputs geodetic latitude. If true, outputs geocentric latitude
 * @returns [latitude, longitude] of subsolar point
 */
export function subsolarPoint(date = DateTime.now().toUTC(), geocentric = false) {
    const JC = jCentury(date);
    const subsolarLat = geocentric ? declination(JC) : geocentric2geodetic(declination(JC));
    const soltime0 = mins(date.toUTC()) + equationOfTime(JC); // solar time at Greenwich meridian (longitude 0)
    const subsolarLong = mod(-soltime0 / 4, 360) - 180;
    return [subsolarLat, subsolarLong];
}
/**
 * Returns sun position given latitude, longitude, and DateTime.
 * @param lat Latitude in degrees (geodetic)
 * @param long Longitude in degrees
 * @param date Luxon DateTime object
 * @returns Array: [elevation, azimuth]. Elevation is in degrees above horizon, azimuth is degrees clockwise from north
 * Solar elevation is not refracted. To find the solar elevation angle adjusted for atmospheric refraction, use refract(sunPosition[0])
 */
export function sunPosition(lat, long, date) {
    const [sunLat, sunLong] = subsolarPoint(date, true); // geocentric subsolar point
    const sunEcef = toEcef(sunLat, sunLong, sunDistance(date));
    return elevAzimuth(lat, long, sunEcef);
}
/**
 * The number of degrees by which the sun's apparent elevation increases due to atmospheric refraction.
 * @param elev Solar elevation angle before refraction.
 */
export function refraction(elev) {
    /** Formula for elevations greater than -5/6 is from Astronomical Algorithms by Jean Meeus (formula 15.4, page 102).
     * For elevations below this, it is smoothed to 0 with a function proportional to the cotangent. */
    if (elev <= -5 / 6) {
        return -0.0089931 / Math.tan(elev * degToRad);
    }
    else {
        return (1.02 / Math.tan((elev + 10.3 / (elev + 5.11)) * degToRad) + 0.001927) / 60;
    }
}
/**
 * Adjusts the given solar elevation angle (elev) to account for atmospheric refraction.
 */
export function refract(elev) {
    return elev + refraction(elev);
}
/** Returns the approximate derivative of the solar elevation angle at a particular time, in degrees per second. */
export function derivative(lat, long, date) {
    return sunPosition(lat, long, date.plus(500))[0] - sunPosition(lat, long, date.minus(500))[0];
}
/**
 * Returns an array of DateTime objects, representing the start of the current day, the times at which the derivative of solar
 * elevation angle is 0, and the start of the next day. This is a helper function for "dawn" and "dusk" functions below.
 */
export function maxAndMin(lat, long, date) {
    const beginningOfDay = startOfDay(date);
    let endOfDay = startNextDay(date);
    if (endOfDay.hour != 0) {
        endOfDay = endOfDay.minus({ hours: endOfDay.hour });
    } // daylight saving time adjustment
    const times = [beginningOfDay];
    const intervals = [
        beginningOfDay,
        beginningOfDay.plus({ hours: 4 }),
        beginningOfDay.plus({ hours: 8 }),
        beginningOfDay.plus({ hours: 12 }),
        beginningOfDay.plus({ hours: 16 }),
        beginningOfDay.plus({ hours: 20 }),
        endOfDay
    ];
    for (let i = 0; i < intervals.length - 1; i++) {
        // use binary search to find the time closest to zero derivative
        const d0 = derivative(lat, long, intervals[i]), d1 = derivative(lat, long, intervals[i + 1]);
        let t0 = intervals[i], t1 = intervals[i + 1];
        if (d0 >= 0 && d1 < 0) { // maximum (i.e. solar noon, or summer solstice at pole)
            while (ms(t1) - ms(t0) > 1) {
                const tAvg = DateTime.fromMillis(Math.floor((ms(t0) + ms(t1)) / 2), { zone: date.zone });
                const dAvg = derivative(lat, long, tAvg);
                if (dAvg >= 0) {
                    t0 = tAvg;
                }
                else {
                    t1 = tAvg;
                }
            }
            times.push(t0);
        }
        else if (d0 <= 0 && d1 > 0) { // minimum (i.e. solar midnight, or winter solstice at pole)
            while (ms(t1) - ms(t0) > 1) {
                const tAvg = DateTime.fromMillis(Math.floor((ms(t0) + ms(t1)) / 2), { zone: date.zone });
                const dAvg = derivative(lat, long, tAvg);
                if (dAvg <= 0) {
                    t0 = tAvg;
                }
                else {
                    t1 = tAvg;
                }
            }
            times.push(t0);
        }
    }
    times.push(endOfDay);
    return times;
}
/**
 * Calculates the time in the morning at which the sun's elevation reaches the specified angle. Angle should be -5/6 for sunrise,
 * -6 for civil twilight, -12 for nautical twilight, and -18 for astronomical twilight.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param date Luxon DateTime object
 * @param angle Solar elevation angle in degrees
 * @param type "Sunrise", "Civil Dawn", "Nautical Dawn" or "Astro Dawn"
 * @returns SunTime object, which includes a DateTime, the sun's elevation & azimuth and a tag for the type of dawn/sunrise.
 */
export function dawn(lat, long, date, angle, type) {
    const maxAndMinTimes = maxAndMin(lat, long, date);
    const dawnTimes = [];
    for (let i = 0; i < maxAndMinTimes.length - 1; i++) {
        let t0 = maxAndMinTimes[i], t1 = maxAndMinTimes[i + 1];
        const s0 = sunPosition(lat, long, t0), s1 = sunPosition(lat, long, t1);
        if (s0[0] <= angle && s1[0] >= angle) {
            while (ms(t1) - ms(t0) > 1) {
                const avg = DateTime.fromMillis(Math.floor((ms(t0) + ms(t1)) / 2), { zone: date.zone });
                if (sunPosition(lat, long, avg)[0] < angle) {
                    t0 = avg;
                }
                else {
                    t1 = avg;
                }
            }
            const [elev, az] = sunPosition(lat, long, t0);
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
 * @param date Luxon DateTime object
 * @param angle Solar elevation angle in degrees
 * @param type "Sunset", "Civil Dusk", "Nautical Dusk", "Astro Dusk"
 * @returns SunTime object, which includes a DateTime, the sun's elevation & azimuth and a tag for the type of dusk/sunset.
 */
export function dusk(lat, long, date, angle, type) {
    const maxAndMinTimes = maxAndMin(lat, long, date);
    const duskTimes = [];
    for (let i = 0; i < maxAndMinTimes.length - 1; i++) {
        let t0 = maxAndMinTimes[i], t1 = maxAndMinTimes[i + 1];
        const s0 = sunPosition(lat, long, t0)[0], s1 = sunPosition(lat, long, t1)[0];
        if (s0 >= angle && s1 <= angle) {
            while (ms(t1) - ms(t0) > 1) {
                const avg = DateTime.fromMillis(Math.floor((ms(t0) + ms(t1)) / 2), { zone: date.zone });
                if (sunPosition(lat, long, avg)[0] < angle) {
                    t1 = avg;
                }
                else {
                    t0 = avg;
                }
            }
            const [elev, az] = sunPosition(lat, long, t0);
            duskTimes.push(new SunTime(t0, elev, az, type));
        }
    }
    return duskTimes;
}
export function sunrise(lat, long, date) { return dawn(lat, long, date, -5 / 6, "Sunrise"); }
export function sunset(lat, long, date) { return dusk(lat, long, date, -5 / 6, "Sunset"); }
export function civilDawn(lat, long, date) { return dawn(lat, long, date, -6, "Civil Dawn"); }
export function civilDusk(lat, long, date) { return dusk(lat, long, date, -6, "Civil Dusk"); }
export function nauticalDawn(lat, long, date) { return dawn(lat, long, date, -12, "Nautical Dawn"); }
export function nauticalDusk(lat, long, date) { return dusk(lat, long, date, -12, "Nautical Dusk"); }
export function astroDawn(lat, long, date) { return dawn(lat, long, date, -18, "Astro Dawn"); }
export function astroDusk(lat, long, date) { return dusk(lat, long, date, -18, "Astro Dusk"); }
/**
 * Returns day length in seconds (time from sunrise to sunset). If sunset is after midnight or sunrise is before midnight (due to
 * time zone complexities and DST), it returns the number of seconds the sun is up from solar midnight to the next solar midnight.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param date Luxon DateTime object representing date
 * @returns Seconds of daylight (0 - 86400 exclusive) or -1 if undefined
 */
export function dayLength(lat, long, date) {
    const rise = sunrise(lat, long, date);
    const set = sunset(lat, long, date);
    if (rise.length == 0 && set.length == 0) {
        if (sunPosition(lat, long, date)[0] >= -5 / 6) {
            return 86400;
        } // midnight sun
        else {
            return 0;
        } // polar night
    }
    else if (rise.length >= 1 && set.length == 1 && set[0].time >= rise[0].time) {
        return set[0].time.diff(rise[0].time).as("seconds");
    }
    else if (rise.length == 1 && set.length == 2 && set[1].time >= rise[0].time) {
        return set[1].time.diff(rise[0].time).as("seconds");
    }
    // If sunset after midnight or sunrise before midnight
    const riseY = sunrise(lat, long, date.minus({ days: 1 })); // sunrise yesterday
    const setT = sunset(lat, long, date.plus({ days: 1 })); // sunset tomorrow
    if (setT.length >= 1 && rise.length >= 1 && rise[0].time.hour <= 11) {
        return setT[0].time.diff(rise[0].time).as("seconds");
    }
    else if (riseY.length >= 1 && set.length >= 1 && set[0].time.hour >= 12) {
        return set[0].time.diff(riseY[riseY.length - 1].time).as("seconds");
    }
    // If undefined (ex. sunrise but no sunset, or vice versa)
    return -1;
}
/**
 * Returns the times of all sun-events in the day: sunrise, sunset, civil/nautical/astronomical twilight, solar noon, and solar midnight.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param date The date of the events
 */
export function allSunEvents(lat, long, date) {
    const midnight = solarMidnight(lat, long, date);
    const adawn = astroDawn(lat, long, date);
    const ndawn = nauticalDawn(lat, long, date);
    const cdawn = civilDawn(lat, long, date);
    const rise = sunrise(lat, long, date);
    const noon = solarNoon(lat, long, date);
    const set = sunset(lat, long, date);
    const cdusk = civilDusk(lat, long, date);
    const ndusk = nauticalDusk(lat, long, date);
    const adusk = astroDusk(lat, long, date);
    const events = [...midnight, ...adawn, ...ndawn, ...cdawn, ...rise, ...noon, ...set, ...cdusk, ...ndusk, ...adusk];
    events.sort((a, b) => a.valueOf() - b.valueOf());
    return events;
}
/** Calculates the time of the solstice or equinox in the given month and year.
 * Month must be 3, 6, 9 or 12.
 */
export function calcSolstEq(year = DateTime.now().toUTC().year, month, timezone = "utc") {
    const start = DateTime.fromObject({ year: year, month: month, day: 10 }, { zone: "utc" });
    let date = start;
    let t1 = 0, t2 = 18 * 86400 * 1000; // 18 days after start
    while (t2 - t1 > 1) {
        const avg = Math.floor((t1 + t2) / 2);
        date = start.plus(avg);
        if (month == 3) {
            (sunTrueLong(date) >= 180) ? t1 = avg : t2 = avg;
        }
        else {
            (sunTrueLong(date) <= 30 * (month - 3)) ? t1 = avg : t2 = avg;
        }
    }
    return date.setZone(timezone);
}
/**
 * Reads solstices and equinoxes from the solstices_equinoxes.json file.
 * @param year Year (example: 2025)
 * @param month Month of solstice or equinox. Must be 3, 6, 9, or 12.
 * @param zone Time zone (example: "utc" or "America/Los_Angeles")
 * @returns An object containing solstices and equinoxes for the given year and time zone. The object contains 4 values:
 * marEquinox, junSolstice, sepEquinox, and decSolstice. Each of these is a Luxon DateTime.
 */
export function getSolstEq(year, zone = "utc") {
    const data = fs.readFileSync("./solstices_equinoxes.json", "utf8");
    const array = JSON.parse(data);
    const n = year - array[0].year;
    if (n < 0 || n >= array.length) {
        throw new Error("Index out of bounds");
    }
    const me = DateTime.fromISO(array[n].marEquinox).setZone(zone);
    const js = DateTime.fromISO(array[n].junSolstice).setZone(zone);
    const se = DateTime.fromISO(array[n].sepEquinox).setZone(zone);
    const ds = DateTime.fromISO(array[n].decSolstice).setZone(zone);
    return { marEquinox: me, junSolstice: js, sepEquinox: se, decSolstice: ds };
}
/**
 * Returns intervals of day, civil twilight, nautical twilight, astronomical twilight, and night during a particular day.
 * Time is measured in milliseconds since midnight. It is not adjusted for DST, so "4 pm" is always represented as 16*60*60*1000 =
 * 57600000.
 * @param lat Latitude
 * @param long Longitude
 * @param date DateTime
 * @param sunEvents Array returned by allSunEvents
 * @returns Array with intervals of [day, civil twilight, nautical twilight, astronomical twilight, night].
 */
export function intervals(sunEvents) {
    const newSunEvents = []; // sunEvents without solar noon or midnight
    const ints = [[], [], [], [], []]; // intervals of day, civil twilight, nautical twilight, astronomical twilight, and night
    for (const event of sunEvents) {
        if (event.eventType != "Solar Noon" && event.eventType != "Solar Midnight") {
            newSunEvents.push(event);
        }
    }
    if (newSunEvents.length == 0) { // no sunrise, sunset, dawn, or dusk
        const sunAngle = sunEvents[0].solarElevation;
        if (sunAngle < -18) {
            return [[], [], [], [], [[0, 86400000]]];
        }
        else if (sunAngle < -12) {
            return [[], [], [], [[0, 86400000]], []];
        }
        else if (sunAngle < -6) {
            return [[], [], [[0, 86400000]], [], []];
        }
        else if (sunAngle < -5 / 6) {
            return [[], [[0, 86400000]], [], [], []];
        }
        else {
            return [[[0, 86400000]], [], [], [], []];
        }
    }
    let etype = newSunEvents[0].eventType;
    if (etype == "Sunset") {
        ints[0].push([0, convertToMS(newSunEvents[0].time)]);
    }
    else if (etype == "Sunrise" || etype == "Civil Dusk") {
        ints[1].push([0, convertToMS(newSunEvents[0].time)]);
    }
    else if (etype == "Civil Dawn" || etype == "Nautical Dusk") {
        ints[2].push([0, convertToMS(newSunEvents[0].time)]);
    }
    else if (etype == "Nautical Dawn" || etype == "Astro Dusk") {
        ints[3].push([0, convertToMS(newSunEvents[0].time)]);
    }
    else if (etype == "Astro Dawn") {
        ints[4].push([0, convertToMS(newSunEvents[0].time)]);
    }
    for (let i = 0; i < newSunEvents.length - 1; i++) {
        etype = newSunEvents[i + 1].eventType;
        const t0 = convertToMS(newSunEvents[i].time);
        const t1 = convertToMS(newSunEvents[i + 1].time);
        if (etype == "Sunset") {
            ints[0].push([t0, t1]);
        }
        else if (etype == "Sunrise" || etype == "Civil Dusk") {
            ints[1].push([t0, t1]);
        }
        else if (etype == "Civil Dawn" || etype == "Nautical Dusk") {
            ints[2].push([t0, t1]);
        }
        else if (etype == "Nautical Dawn" || etype == "Astro Dusk") {
            ints[3].push([t0, t1]);
        }
        else if (etype == "Astro Dawn") {
            ints[4].push([t0, t1]);
        }
    }
    const lastTime = convertToMS(newSunEvents[newSunEvents.length - 1].time);
    if (etype == "Sunrise") {
        ints[0].push([lastTime, 86400000]);
    }
    else if (etype == "Civil Dawn" || etype == "Sunset") {
        ints[1].push([lastTime, 86400000]);
    }
    else if (etype == "Nautical Dawn" || etype == "Civil Dusk") {
        ints[2].push([lastTime, 86400000]);
    }
    else if (etype == "Astro Dawn" || etype == "Nautical Dusk") {
        ints[3].push([lastTime, 86400000]);
    }
    else if (etype == "Astro Dusk") {
        ints[4].push([lastTime, 86400000]);
    }
    return ints;
}
/**
 * Intervals of daylight and each stage of twilight for use in SVG diagram generation.
 * @param sunEvents Value returned from the "allSunEvents" function on the given day.
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
export function intervalsSvg(sunEvents) {
    const newSunEvents = []; // sunEvents without solar noon or midnight
    for (const event of sunEvents) {
        if (event.eventType != "Solar Noon" && event.eventType != "Solar Midnight") {
            newSunEvents.push(event);
        }
    }
    if (newSunEvents.length == 0) { // no sunrise, sunset, dawn, or dusk
        const s = sunEvents[0].solarElevation;
        if (s < -18) {
            return [[], [], [], []];
        }
        else if (s < -12) {
            return [[], [], [], [[0, DAY_LENGTH]]];
        }
        else if (s < -6) {
            return [[], [], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]]];
        }
        else if (s < -5 / 6) {
            return [[], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]]];
        }
        else {
            return [[[0, DAY_LENGTH]], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]], [[0, DAY_LENGTH]]];
        }
    }
    const dIntervals = []; // intervals of daylight
    const cIntervals = []; // daylight + civil twilight
    const nIntervals = []; // daylight + civil twilight + nautical twilight
    const aIntervals = []; // daylight + civil twilight + nautical twilight + astronomical twilight
    let etype = newSunEvents[0].eventType;
    let ms = convertToMS(newSunEvents[0].time);
    // push the first interval
    if (etype == "Astro Dawn") {
        aIntervals.push([ms, DAY_LENGTH]);
    }
    else if (etype == "Nautical Dawn") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([ms, DAY_LENGTH]);
    }
    else if (etype == "Civil Dawn") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, DAY_LENGTH]);
        cIntervals.push([ms, DAY_LENGTH]);
    }
    else if (etype == "Sunrise") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, DAY_LENGTH]);
        cIntervals.push([0, DAY_LENGTH]);
        dIntervals.push([ms, DAY_LENGTH]);
    }
    else if (etype == "Sunset") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, DAY_LENGTH]);
        cIntervals.push([0, DAY_LENGTH]);
        dIntervals.push([0, ms]);
    }
    else if (etype == "Civil Dusk") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, DAY_LENGTH]);
        cIntervals.push([0, ms]);
    }
    else if (etype == "Nautical Dusk") {
        aIntervals.push([0, DAY_LENGTH]);
        nIntervals.push([0, ms]);
    }
    else if (etype == "Astro Dusk") {
        aIntervals.push([0, ms]);
    }
    for (let i = 1; i < newSunEvents.length; i++) {
        etype = newSunEvents[i].eventType;
        ms = convertToMS(newSunEvents[i].time);
        if (etype == "Astro Dawn") {
            aIntervals.push([ms, DAY_LENGTH]);
        }
        else if (etype == "Nautical Dawn") {
            nIntervals.push([ms, DAY_LENGTH]);
        }
        else if (etype == "Civil Dawn") {
            cIntervals.push([ms, DAY_LENGTH]);
        }
        else if (etype == "Sunrise") {
            dIntervals.push([ms, DAY_LENGTH]);
        }
        else if (etype == "Sunset") {
            dIntervals[dIntervals.length - 1][1] = ms;
        }
        else if (etype == "Civil Dusk") {
            cIntervals[cIntervals.length - 1][1] = ms;
        }
        else if (etype == "Nautical Dusk") {
            nIntervals[nIntervals.length - 1][1] = ms;
        }
        else if (etype == "Astro Dusk") {
            aIntervals[aIntervals.length - 1][1] = ms;
        }
    }
    return [dIntervals, cIntervals, nIntervals, aIntervals];
}
/**
 * Returns the lengths of day combined with different stages of twilight.
 * @param sunEvents The return value of the allSunEvents command at a particular place and date.
 * @returns An array [t0, t1, t2, t3]. The values are as follows:
 * @t0: Day length
 * @t1: Day + civil twilight
 * @t2: Day + civil twilight + nautical twilight
 * @t3: Day + civil twilight + nautical twilight + astronomical twilight
 */
export function lengths(sunEvents) {
    const newSunEvents = []; // sunEvents without solar noon or midnight
    const durations = [0, 0, 0, 0]; // durations
    for (const event of sunEvents) {
        if (event.eventType != "Solar Noon" && event.eventType != "Solar Midnight") {
            newSunEvents.push(event);
        }
    }
    if (newSunEvents.length == 0) { // no sunrise, sunset, dawn, or dusk
        const s = sunEvents[0].solarElevation;
        if (s < -18) {
            return [0, 0, 0, 0];
        } // night all day
        else if (s < -12) {
            return [0, 0, 0, DAY_LENGTH];
        } // astronomical twilight all day
        else if (s < -6) {
            return [0, 0, DAY_LENGTH, DAY_LENGTH];
        } // nautical twilight all day
        else if (s < -5 / 6) {
            return [0, DAY_LENGTH, DAY_LENGTH, DAY_LENGTH];
        } // civil twilight all day
        else {
            return [DAY_LENGTH, DAY_LENGTH, DAY_LENGTH, DAY_LENGTH];
        } // daylight all day
    }
    let etype = newSunEvents[0].eventType;
    let ms = convertToMS(newSunEvents[0].time);
    if (etype == "Nautical Dawn" || etype == "Astro Dusk") {
        durations[3] += ms;
    }
    else if (etype == "Civil Dawn" || etype == "Nautical Dusk") {
        durations[2] += ms;
    }
    else if (etype == "Sunrise" || etype == "Civil Dusk") {
        durations[1] += ms;
    }
    else if (etype == "Sunset") {
        durations[0] += ms;
    }
    for (let i = 0; i < newSunEvents.length - 1; i++) {
        etype = newSunEvents[i + 1].eventType;
        ms = convertToMS(newSunEvents[i + 1].time) - convertToMS(newSunEvents[i].time);
        if (etype == "Nautical Dawn" || etype == "Astro Dusk") {
            durations[3] += ms;
        }
        else if (etype == "Civil Dawn" || etype == "Nautical Dusk") {
            durations[2] += ms;
        }
        else if (etype == "Sunrise" || etype == "Civil Dusk") {
            durations[1] += ms;
        }
        else if (etype == "Sunset") {
            durations[0] += ms;
        }
    }
    ms = DAY_LENGTH - convertToMS(newSunEvents[newSunEvents.length - 1].time);
    if (etype == "Astro Dawn" || etype == "Nautical Dusk") {
        durations[3] += ms;
    }
    else if (etype == "Nautical Dawn" || etype == "Civil Dusk") {
        durations[2] += ms;
    }
    else if (etype == "Civil Dawn" || etype == "Sunset") {
        durations[1] += ms;
    }
    else if (etype == "Sunrise") {
        durations[0] += ms;
    }
    return [durations[0],
        durations[0] + durations[1],
        durations[0] + durations[1] + durations[2],
        durations[0] + durations[1] + durations[2] + durations[3]];
}
