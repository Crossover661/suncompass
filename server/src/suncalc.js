/*
The formulas for eccentricity, earth-sun distance, axial tilt, declination, equation of time, and atmospheric refraction of sunlight
are borrowed from NOAA's solar calculator https://gml.noaa.gov/grad/solcalc/ and the books "Astronomical Algorithms" by Jean Meeus.
The refraction formula is modified slightly to ensure continuity to 6 decimal places. The formula for solar ecliptic longitude is
from the book "Planetary Programs and Tables from -4000 to +2800" by Pierre Bretagnon and Jean-Louis Simon.

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
import { clamp, mod, mins, jCentury, approxDeltaT } from "./mathfuncs.js";
import { DateTime } from "luxon";
import { degToRad, sunPeriodicTerms } from "./constants.js";
import * as fs from "fs";
const N_POLAR_NIGHT = 2 ** 52 - 1;
const N_MIDNIGHT_SUN = 2 ** 52 + 1;
const N_UNDEFINED = 2 ** 52;
function meanSunLongitude(JC) {
    JC += (approxDeltaT(JC) / 3155760000); // division by 3155760000 converts seconds to Julian centuries
    let U = JC / 100;
    let meanLong = 4.9353929 + 62833.196168 * U;
    for (let i = 0; i < 50; i++) {
        let curRow = sunPeriodicTerms[i];
        meanLong += (1e-7 * (curRow[0] * Math.sin(curRow[2] + curRow[3] * U)));
    }
    return meanLong;
}
function meanSunAnomaly(JC) { return 357.52911 + 35999.05029 * JC - 0.0001537 * JC ** 2; }
function eccentricity(JC) { return 0.016708634 - 0.000042037 * JC + 0.0000001267 * JC ** 2; }
function equationOfCenter(JC) {
    let anom = meanSunAnomaly(JC) * degToRad;
    return (1.914602 - 0.004817 * JC - 0.000014 * JC ** 2) * Math.sin(anom) +
        (0.019993 - 0.000101 * JC) * Math.sin(2 * anom) +
        0.000289 * Math.sin(3 * anom);
}
function sunAnomaly(JC) { return meanSunAnomaly(JC) + equationOfCenter(JC); }
function sunDistance(date) {
    if (typeof (date) == "number") {
        let ecc = eccentricity(date);
        return (149598023 * (1 - ecc ** 2)) / (1 + ecc * Math.cos(sunAnomaly(date) * degToRad));
    }
    else {
        let JC = jCentury(date);
        return sunDistance(JC);
    }
}
/**
 * Calculates the sun's apparent ecliptic longitude to within 0.0009 degrees for years 0-3000. This value is 0 at the March equinox,
 * 90 at the June solstice, 180 at the September equinox, and 270 at the December solstice.
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
function sunLongitude(date) {
    if (typeof (date) == "number") {
        let correcteddate = date + (approxDeltaT(date) / 3155760000);
        let U = correcteddate / 100;
        let meanLong = meanSunLongitude(date);
        let aberration = 1e-7 * (17 * Math.cos(3.1 + 62830.14 * U) - 993);
        let nutation = 1e-7 * (-834 * Math.sin(2.18 - 3375.7 * U + 0.36 * U ** 2) - 64 * Math.sin(3.51 + 125666.39 * U + 0.1 * U ** 2));
        return mod((meanLong + aberration + nutation) / degToRad, 360);
    }
    else {
        return sunLongitude(jCentury(date));
    }
}
/**
 * Returns Earth's axial tilt in degrees, which is also the latitudes of the tropics of Cancer and Capricorn.
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
function axialTilt(date) {
    if (typeof (date) == "number") {
        return 23.4392911 - (46.815 * date - 0.00059 * date ** 2 + 0.001813 * date ** 3) / 3600 + 0.00256 * Math.cos((125.04 - 1934.136 * date) * degToRad);
    }
    else {
        return axialTilt(jCentury(date));
    }
}
/**
 * Returns the sun's declination in degrees. This is the latitude of the subsolar point.
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
function declination(date) {
    if (typeof (date) == "number") {
        return Math.asin(clamp(Math.sin(axialTilt(date) * degToRad) * Math.sin(sunLongitude(date) * degToRad))) / degToRad;
    }
    else {
        return declination(jCentury(date));
    }
    ;
}
/**
 * Equation of time in minutes (apparent solar time - mean solar time).
 * @param date A Luxon DateTime object, or a number representing the Julian century.
 */
function equationOfTime(date) {
    if (typeof (date) == "number") {
        let vary = Math.tan(axialTilt(date) * degToRad / 2) ** 2;
        let long = mod(280.46646 + 36000.76983 * date + 0.0003032 * date ** 2, 360);
        let anom = meanSunAnomaly(date);
        let ecc = eccentricity(date);
        return 4 * (vary * Math.sin(2 * long * degToRad) - 2 * ecc * Math.sin(anom * degToRad) + 4 * ecc * vary * Math.sin(anom * degToRad) * Math.cos(2 * long * degToRad) - 0.5 * (vary ** 2) * Math.sin(4 * long * degToRad) - 1.25 * (ecc ** 2) * Math.sin(2 * anom * degToRad)) / degToRad;
    }
    else {
        return equationOfTime(jCentury(date));
    }
}
/**
 * Returns sun's angular radius in degrees. To find the angular diameter, multiply this value by 2.
 * @param date A Luxon DateTime object.
 */
function sunAngularRadius(date) {
    return (695700 / sunDistance(date)) / degToRad;
}
/**
 * Returns apparent solar time given longitude and time, in minutes after solar midnight. 0 is solar midnight, 720 is solar noon.
 * @param longitude Longitude in degrees.
 * @param date A Luxon DateTime object.
 */
function solarTime(longitude, date) {
    let timeEq = equationOfTime(date);
    return mod(mins(date) + timeEq + 4 * longitude - date.offset, 1440);
}
/**
 * Difference between mean solar time at a given longitude and UTC, in minutes.
 * @param longitude Longitude in degrees.
 */
function meanSolarTimeOffset(longitude) {
    return Math.floor(4 * longitude + 0.5);
}
/**
 * Returns the time(s) of solar noon as a DateTime object.
 * @param longitude Longitude in degrees.
 * @param date Luxon DateTime object.
 * @returns
 */
function solarNoon(longitude, date) {
    let beginningOfDay = DateTime.fromObject({ year: date.year, month: date.month, day: date.day, hour: 0 }, { zone: date.zone });
    let endOfDay;
    if (beginningOfDay.hour == 1) {
        endOfDay = beginningOfDay.plus({ hours: 23 });
    }
    else {
        endOfDay = beginningOfDay.plus({ days: 1 });
    }
    let dayLength = endOfDay.diff(beginningOfDay).as("minutes"); // usually 24 hours, can be 23 or 25 with DST
    let st00 = solarTime(longitude, beginningOfDay);
    let st24 = solarTime(longitude, endOfDay);
    let stDiff = mod((st24 - st00 - 720), 1440) + 720;
    let solarTimeRate = stDiff / dayLength; // the rate at which solar time changes through the day, relative to actual time
    if (st00 > 600 && st00 <= 720 && st24 > 720 && st24 < 840) { // 2 solar noons in a day
        let solarNoon0 = beginningOfDay.plus({ minutes: (720 - st00) / solarTimeRate });
        let solarNoon1 = endOfDay.minus({ minutes: (st24 - 720) / solarTimeRate });
        return [solarNoon0, solarNoon1];
    }
    else if (st00 > 720 && st00 < 840 && st24 > 600 && st00 <= 720) { // 0 solar noons in a day
        return [];
    }
    else { // 1 solar noon in a day
        let solarNoon = beginningOfDay.plus({ minutes: mod(720 - st00, 1440) / solarTimeRate });
        return [solarNoon];
    }
}
/**
 * Returns the time(s) of solar midnight as a DateTime object.
 * @param longitude Longitude in degrees.
 * @param date Luxon DateTime object.
 * @returns
 */
function solarMidnight(longitude, date) {
    let beginningOfDay = DateTime.fromObject({ year: date.year, month: date.month, day: date.day, hour: 0 }, { zone: date.zone });
    let endOfDay;
    if (beginningOfDay.hour == 1) {
        endOfDay = beginningOfDay.plus({ hours: 23 });
    }
    else {
        endOfDay = beginningOfDay.plus({ days: 1 });
    }
    let dayLength = endOfDay.diff(beginningOfDay).as("minutes"); // usually 24 hours, can be 23 or 25 with DST
    let st00 = solarTime(longitude, beginningOfDay);
    let st24 = solarTime(longitude, endOfDay);
    let stDiff = mod((st24 - st00 - 720), 1440) + 720;
    let solarTimeRate = stDiff / dayLength; // the rate at which solar time changes through the day, relative to actual time
    if (st00 > 1320 && st24 < 120) { // 2 solar midnights in a day
        let solarMidnight0 = beginningOfDay.plus({ minutes: (1440 - st00) / solarTimeRate });
        let solarMidnight1 = endOfDay.minus({ minutes: st24 / solarTimeRate });
        return [solarMidnight0, solarMidnight1];
    }
    else if (st00 < 120 && st24 > 1320) { // 0 solar midnights in a day
        return [];
    }
    else { // 1 solar midnight in a day
        let solarMidnight = endOfDay.minus({ minutes: st24 / solarTimeRate });
        return [solarMidnight];
    }
}
/**
 * Returns the subsolar point, or location on Earth at which the sun is directly overhead.
 * @param date Luxon DateTime object.
 * @returns [latitude, longitude] of subsolar point
 */
function subsolarPoint(date = DateTime.now().toUTC()) {
    let JC = jCentury(date);
    let subsolarLat = declination(JC);
    let soltime0 = mins(date.toUTC()) + equationOfTime(JC); // solar time at Greenwich meridian (longitude 0)
    let subsolarLong = mod(-soltime0 / 4, 360) - 180;
    return [subsolarLat, subsolarLong];
}
/**
 * Returns sun position given latitude, longitude, and DateTime.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param date Luxon DateTime object
 * @returns Array: [elevation, azimuth]. Elevation is in degrees above horizon, azimuth is degrees clockwise from north
 * Solar elevation is not refracted. To find the solar elevation angle adjusted for atmospheric refraction, use refract(sunPosition[0])
 */
function sunPosition(lat, long, date) {
    let subsolarPt = subsolarPoint(date);
    let sunLat = subsolarPt[0] * degToRad;
    let sunLong = subsolarPt[1] * degToRad;
    lat *= degToRad;
    long *= degToRad;
    let c = clamp(Math.sin(lat) * Math.sin(sunLat) + Math.cos(lat) * Math.cos(sunLat) * Math.cos(sunLong - long));
    let elev = 90 - Math.acos(c) / degToRad;
    let x = Math.cos(lat) * Math.sin(sunLat) - Math.sin(lat) * Math.cos(sunLat) * Math.cos(sunLong - long);
    let y = Math.sin(sunLong - long) * Math.cos(sunLat);
    let az = Math.atan2(y, x);
    az = mod(az / degToRad, 360);
    return [elev, az];
}
/**
 * The number of degrees by which the sun's apparent elevation increases due to atmospheric refraction.
 * @param elev Solar elevation angle before refraction.
 */
function refraction(elev) {
    // This formula is borrowed from NOAA's solar calculator but modified slightly to be continuous.
    if (Math.abs(elev) >= 89.999) {
        return 0;
    }
    else {
        let ref; // refraction angle in arcseconds
        let tanElev = Math.tan(elev * degToRad);
        if (elev >= 5) {
            ref = (58.1 / tanElev - 0.07 / tanElev ** 3 + 0.000086 / tanElev ** 5);
        }
        else if (elev >= -0.575) {
            ref = 1.0029734 * (1735 - 518.2 * elev + 103.4 * elev ** 2 - 12.79 * elev ** 3 + 0.711 * elev ** 4);
        }
        else {
            ref = -20.83284 / tanElev;
        }
        return ref / 3600; // convert arcseconds to degrees
    }
}
/**
 * Adjusts the given solar elevation angle (elev) to account for atmospheric refraction.
 */
function refract(elev) {
    return elev + refraction(elev);
}
/**
 * Calculates the time(s) at which the solar elevation angle reaches its maximum. In the polar regions, this may be significantly
 * different from solar noon, because the sun's declination change over the course of a day starts affecting solar angle more
 * than its longitudinal movement.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param date Luxon DateTime object representing date
 * @returns Luxon DateTime object for time of max solar elevation
 */
function maxSunElevTime(lat, long, date) {
    let intervals = [], derivatives = [], peaks = [];
    // use gradient ascent and binary search to find max solar angle time
    for (let h = 0; h <= 21; h += 3) {
        intervals.push(DateTime.fromObject({ year: date.year, month: date.month, day: date.day, hour: h }, { zone: date.zone }));
    }
    intervals.push(DateTime.fromObject({ year: date.year, month: date.month, day: date.day, hour: 0 }, { zone: date.zone }).plus({ days: 1 }));
    for (let i = 0; i < 9; i++) {
        let diff = sunPosition(lat, long, intervals[i].plus(500))[0] - sunPosition(lat, long, intervals[i].minus(500))[0];
        derivatives.push(diff);
    }
    for (let j = 0; j < 8; j++) {
        if (derivatives[j] >= 0 && derivatives[j + 1] < 0) { // if derivative changes from + to - within 3-hour period
            // binary search to find where derivative = 0 (i.e. max sun height)
            let t1 = 0;
            let t2 = intervals[j + 1].diff(intervals[j]).as("milliseconds");
            let m = intervals[j];
            while (t2 - t1 >= 100) {
                m = intervals[j].plus((t1 + t2) / 2);
                let deriv = sunPosition(lat, long, m.plus(500))[0] - sunPosition(lat, long, m.minus(500))[0];
                if (deriv >= 0) {
                    t1 = (t1 + t2) / 2;
                } // sun's altitude is still increasing
                else {
                    t2 = (t1 + t2) / 2;
                } // sun's altitude is now decreasing
            }
            peaks.push(m);
        }
    }
    return peaks;
}
/**
 * Calculates the time(s) at which the solar elevation angle reaches its minimum. In the polar regions, this may be significantly
 * different from solar midnight, because the sun's declination change over the course of a day starts affecting solar angle more
 * than its longitudinal movement.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param date Luxon DateTime object representing date
 * @returns Luxon DateTime object for time of max solar elevation
 */
function minSunElevTime(lat, long, date) {
    let intervals = [], derivatives = [], minimums = [];
    for (let h = 0; h <= 21; h += 3) {
        intervals.push(DateTime.fromObject({ year: date.year, month: date.month, day: date.day, hour: h }, { zone: date.zone }));
    }
    intervals.push(DateTime.fromObject({ year: date.year, month: date.month, day: date.day, hour: 0 }, { zone: date.zone }).plus({ days: 1 }));
    for (let i = 0; i < 9; i++) {
        let diff = sunPosition(lat, long, intervals[i].plus(500))[0] - sunPosition(lat, long, intervals[i].minus(500))[0];
        derivatives.push(diff);
    }
    for (let j = 0; j < 8; j++) {
        if (derivatives[j] < 0 && derivatives[j + 1] >= 0) { // if derivative changes from - to + within 3-hour period
            // binary search to find where derivative = 0 (i.e. max sun height)
            let t1 = 0;
            let t2 = intervals[j + 1].diff(intervals[j]).as("milliseconds");
            let m = intervals[j];
            while (t2 - t1 >= 100) {
                m = intervals[j].plus((t1 + t2) / 2);
                let deriv = sunPosition(lat, long, m.plus(500))[0] - sunPosition(lat, long, m.minus(500))[0];
                if (deriv >= 0) {
                    t1 = (t1 + t2) / 2;
                } // sun's altitude is still increasing
                else {
                    t2 = (t1 + t2) / 2;
                } // sun's altitude is now decreasing
            }
            minimums.push(m);
        }
    }
    return minimums;
}
/**
 * Calculates the maximums and minimums of the solar elevation angle, including midnight local time. This is a helper function
 * for "dawn" and "dusk" functions below.
 */
function maxAndMin(lat, long, date) {
    let startOfDay = DateTime.fromObject({ year: date.year, month: date.month, day: date.day, hour: 0 }, { zone: date.zone });
    let times = [startOfDay];
    let minimums = minSunElevTime(lat, long, date);
    let maximums = maxSunElevTime(lat, long, date);
    for (let min of minimums) {
        times.push(min);
    }
    for (let max of maximums) {
        times.push(max);
    }
    let endOfDay = startOfDay.plus({ days: 1 });
    if (endOfDay.hour == 1) {
        endOfDay = endOfDay.minus({ hours: 1 });
    }
    let sortedTimes = times.sort((a, b) => a.toMillis() - b.toMillis());
    return sortedTimes;
}
/**
 * Calculates the time in the morning at which the sun's elevation reaches the specified angle. Angle should be -5/6 for sunrise,
 * -6 for civil twilight, -12 for nautical twilight, and -18 for astronomical twilight.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param date Luxon DateTime object
 * @param angle Solar elevation angle in degrees
 * @returns A Luxon DateTime object representing the sunrise/dawn time.
 */
function dawn(lat, long, date, angle) {
    let maxAndMinTimes = maxAndMin(lat, long, date);
    let dawnTimes = [];
    for (let i = 0; i < maxAndMinTimes.length - 1; i++) {
        let t0 = maxAndMinTimes[i], t1 = maxAndMinTimes[i + 1];
        let s0 = sunPosition(lat, long, t0)[0], s1 = sunPosition(lat, long, t1)[0];
        if (s0 <= angle && s1 >= angle) {
            while (t1.diff(t0).as("milliseconds") > 1) {
                let avg = DateTime.fromMillis((t0.toMillis() + t1.toMillis()) / 2, { zone: date.zone });
                if (sunPosition(lat, long, avg)[0] < angle) {
                    t0 = avg;
                }
                else {
                    t1 = avg;
                }
            }
            dawnTimes.push(t0);
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
 * @returns A Luxon DateTime object representing the sunrise/dawn time
 */
function dusk(lat, long, date, angle) {
    let maxAndMinTimes = maxAndMin(lat, long, date);
    let duskTimes = [];
    for (let i = 0; i < maxAndMinTimes.length - 1; i++) {
        let t0 = maxAndMinTimes[i], t1 = maxAndMinTimes[i + 1];
        let s0 = sunPosition(lat, long, t0)[0], s1 = sunPosition(lat, long, t1)[0];
        if (s0 >= angle && s1 <= angle) {
            while (t1.diff(t0).as("milliseconds") > 1) {
                let avg = DateTime.fromMillis((t0.toMillis() + t1.toMillis()) / 2, { zone: date.zone });
                if (sunPosition(lat, long, avg)[0] < angle) {
                    t1 = avg;
                }
                else {
                    t0 = avg;
                }
            }
            duskTimes.push(t0);
        }
    }
    return duskTimes;
}
function sunrise(lat, long, date) { return dawn(lat, long, date, -5 / 6); }
function sunset(lat, long, date) { return dusk(lat, long, date, -5 / 6); }
function civilDawn(lat, long, date) { return dawn(lat, long, date, -6); }
function civilDusk(lat, long, date) { return dusk(lat, long, date, -6); }
function nauticalDawn(lat, long, date) { return dawn(lat, long, date, -12); }
function nauticalDusk(lat, long, date) { return dusk(lat, long, date, -12); }
function astroDawn(lat, long, date) { return dawn(lat, long, date, -18); }
function astroDusk(lat, long, date) { return dusk(lat, long, date, -18); }
/**
 * Returns day length in seconds (time from sunrise to sunset). If sunset is after midnight or sunrise is before midnight (due to
 * time zone complexities and DST), it returns the number of seconds the sun is up from solar midnight to the next solar midnight.
 * @param lat Latitude in degrees
 * @param long Longitude in degrees
 * @param date Luxon DateTime object representing date
 * @returns Seconds of daylight (0 - 86400 exclusive) or -1 if undefined
 */
function dayLength(lat, long, date) {
    let rise = sunrise(lat, long, date);
    let set = sunset(lat, long, date);
    if (rise.length == 0 && set.length == 0) {
        if (sunPosition(lat, long, date)[0] >= -5 / 6) {
            return 86400;
        } // midnight sun
        else {
            return 0;
        } // polar night
    }
    else if (rise.length >= 1 && set.length == 1 && set[0] >= rise[0]) {
        return set[0].diff(rise[0]).as("seconds");
    }
    else if (rise.length == 1 && set.length == 2 && set[1] >= rise[0]) {
        return set[1].diff(rise[0]).as("seconds");
    }
    // If sunset after midnight or sunrise before midnight
    let rise_y = sunrise(lat, long, date.minus({ days: 1 })); // sunrise yesterday
    let set_t = sunset(lat, long, date.plus({ days: 1 })); // sunset tomorrow
    if (set_t.length >= 1 && rise.length >= 1 && rise[0].hour <= 11) {
        return set_t[0].diff(rise[0]).as("seconds");
    }
    else if (rise_y.length >= 1 && set.length >= 1 && set[0].hour >= 12) {
        return set[0].diff(rise_y[rise_y.length - 1]).as("seconds");
    }
    // If undefined (ex. sunrise but no sunset, or vice versa)
    return -1;
}
/**
 * Returns the times of all sun-events in the day: sunrise, sunset, civil/nautical/astronomical twilight, solar noon, and solar midnight.
 * @param lat
 * @param long
 * @param date
 */
function allSunEvents(lat, long, date) {
    let events = [];
    let midnight = solarMidnight(long, date);
    let adawn = astroDawn(lat, long, date);
    let ndawn = nauticalDawn(lat, long, date);
    let cdawn = civilDawn(lat, long, date);
    let rise = sunrise(lat, long, date);
    let noon = solarNoon(long, date);
    let set = sunset(lat, long, date);
    let cdusk = civilDusk(lat, long, date);
    let ndusk = nauticalDusk(lat, long, date);
    let adusk = astroDusk(lat, long, date);
    return 0;
}
/**
 * Returns the time of the March equinox in given year and time zone
 * @param year Year (example: 2025)
 * @param timezone Time zone in IANA format (example: "utc" or "America/Los_Angeles")
 * @returns Time of March equinox as a Luxon DateTime object.
 */
function marEquinox(year = DateTime.now().toUTC().year, timezone = "utc") {
    let start = DateTime.fromObject({ year: year, month: 3, day: 16 }, { zone: "utc" });
    let date = start;
    let long;
    let t1 = 0;
    let t2 = 8 * 86400 * 1000; // 8 days after start
    while (t2 - t1 >= 1) {
        date = start.plus((t1 + t2) / 2);
        long = sunLongitude(date);
        if (long >= 180) {
            t1 = (t1 + t2) / 2;
        }
        else {
            t2 = (t1 + t2) / 2;
        }
    }
    return date.setZone(timezone);
}
/**
 * Returns the time of the June solstice in given year and time zone
 * @param year Year (example: 2025)
 * @param timezone Time zone in IANA format (example: "utc" or "America/Los_Angeles")
 * @returns Time of June solstice as a Luxon DateTime object.
 */
function junSolstice(year = DateTime.now().toUTC().year, timezone = "utc") {
    let start = DateTime.fromObject({ year: year, month: 6, day: 16 }, { zone: "utc" });
    let date = start;
    let long;
    let t1 = 0;
    let t2 = 8 * 86400 * 1000; // 8 days after start
    while (t2 - t1 >= 1) {
        date = start.plus((t1 + t2) / 2);
        long = sunLongitude(date);
        if (long <= 90) {
            t1 = (t1 + t2) / 2;
        }
        else {
            t2 = (t1 + t2) / 2;
        }
    }
    return date.setZone(timezone);
}
/**
 * Returns the time of the September equinox in given year and time zone
 * @param year Year (example: 2025)
 * @param timezone Time zone in IANA format (example: "utc" or "America/Los_Angeles")
 * @returns Time of September equinox as a Luxon DateTime object.
 */
function sepEquinox(year = DateTime.now().toUTC().year, timezone = "utc") {
    // Returns a DateTime object representing the moment of the September equinox in a given year and time zone
    let start = DateTime.fromObject({ year: year, month: 9, day: 18 }, { zone: "utc" });
    let date = start;
    let long;
    let t1 = 0;
    let t2 = 8 * 86400 * 1000; // 8 days after start
    while (t2 - t1 >= 1) {
        date = start.plus((t1 + t2) / 2);
        long = sunLongitude(date);
        if (long <= 180) {
            t1 = (t1 + t2) / 2;
        }
        else {
            t2 = (t1 + t2) / 2;
        }
    }
    return date.setZone(timezone);
}
/**
 * Returns the time of the December solstice in given year and time zone
 * @param year Year (example: 2025)
 * @param timezone Time zone in IANA format (example: "utc" or "America/Los_Angeles")
 * @returns Time of December solstice as a Luxon DateTime object.
 */
function decSolstice(year = DateTime.now().toUTC().year, timezone = "utc") {
    let start = DateTime.fromObject({ year: year, month: 12, day: 18 }, { zone: "utc" });
    let date = start;
    let long;
    let t1 = 0;
    let t2 = 8 * 86400 * 1000; // 8 days after start
    while (t2 - t1 >= 1) {
        date = start.plus((t1 + t2) / 2);
        long = sunLongitude(date);
        if (long <= 270) {
            t1 = (t1 + t2) / 2;
        }
        else {
            t2 = (t1 + t2) / 2;
        }
    }
    return date.setZone(timezone);
}
/**
 * Reads solstice or equinox from the solstices_equinoxes.json file.
 * @param year Year (example: 2025)
 * @param month Month of solstice or equinox. Must be 3, 6, 9, or 12.
 * @param zone Time zone (example: "utc" or "America/Los_Angeles")
 * @returns Luxon DateTime object with equinox/solstice date in given time zone.
 */
function getSolsticeEquinox(year, month, zone = "utc") {
    const data = fs.readFileSync("./solstices_equinoxes.json", "utf8");
    const array = JSON.parse(data);
    let n = year - array[0].year;
    if (n < 0 || n >= array.length) {
        throw new Error("Index out of bounds");
    }
    else if (month == 3) {
        return DateTime.fromISO(array[n].marEquinox).setZone(zone);
    }
    else if (month == 6) {
        return DateTime.fromISO(array[n].junSolstice).setZone(zone);
    }
    else if (month == 9) {
        return DateTime.fromISO(array[n].sepEquinox).setZone(zone);
    }
    else if (month == 12) {
        return DateTime.fromISO(array[n].decSolstice).setZone(zone);
    }
    else {
        console.log("Month must be 3, 6, 9, or 12");
        return DateTime.fromMillis(N_UNDEFINED);
    }
}
export { sunDistance, sunLongitude, axialTilt, declination, equationOfTime, meanSunAnomaly, sunAngularRadius, meanSolarTimeOffset, solarTime, solarNoon, solarMidnight, subsolarPoint, sunPosition, refraction, refract, dawn, dusk, sunrise, sunset, civilDawn, civilDusk, nauticalDawn, nauticalDusk, astroDawn, astroDusk, dayLength, marEquinox, junSolstice, sepEquinox, decSolstice, getSolsticeEquinox };
