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

import {clamp, mod, JDNdate, mins, julianCentury, approxDeltaT} from "./mathfuncs.js";
import {DateTime} from "luxon";
import {degToRad, sunPeriodicTerms} from "./constants.js";
import * as fs from "fs";

function meanSunLongitude(JC: number) {
    JC += (approxDeltaT(JC)/3155760000); // division by 3155760000 converts seconds to Julian centuries
    var U = JC / 100;
    var meanLong = 4.9353929 + 62833.196168*U;
    for (var i=0; i<50; i++) {
        var curRow = sunPeriodicTerms[i];
        meanLong += (1e-7*(curRow[0] * Math.sin(curRow[2]+curRow[3]*U)));
    }
    return meanLong;
}
function meanSunAnomaly(JC: number) {return 357.52911 + 35999.05029*JC - 0.0001537*JC**2;}
function eccentricity(JC: number) {return 0.016708634 - 0.000042037*JC + 0.0000001267*JC**2;}
function equationOfCenter(JC: number) {
    var anom = meanSunAnomaly(JC) * degToRad;
    return (1.914602 - 0.004817*JC - 0.000014*JC**2) * Math.sin(anom) +
    (0.019993 - 0.000101*JC) * Math.sin(2*anom) +
    0.000289 * Math.sin(3*anom);
}
function sunTrueAnomaly(JC: number) {return meanSunAnomaly(JC) + equationOfCenter(JC);}
function sunDistance(date: number | DateTime) {
    if (typeof(date) == "number") {
        var ecc = eccentricity(date);
        return (149598023*(1-ecc**2))/(1+ecc*Math.cos(sunTrueAnomaly(date)*degToRad));
    }
    else {
        var JC = julianCentury(JDNdate(date));
        return sunDistance(JC);
    }
}
function sunAppLongitude(date: number | DateTime) {
    // Calculates the sun's apparent ecliptic longitude to within 0.0009 degrees for years 0 through 3000.
    // This value is 0 at the March equinox, 90 at the June solstice, 180 at the September equinox, and 270 at the December solstice.
    // Note that in future years (beyond 2200 or so), the value may end up being in error by minutes due to unpredictable values of delta T.
    if (typeof(date) == "number") {
        var correcteddate = date + (approxDeltaT(date)/3155760000);
        var U = correcteddate / 100;
        var meanLong = meanSunLongitude(date);
        var aberration = 1e-7*(17*Math.cos(3.1+62830.14*U)-993);
        var nutation = 1e-7*(-834*Math.sin(2.18-3375.7*U+0.36*U**2)-64*Math.sin(3.51+125666.39*U+0.1*U**2));
        return mod((meanLong + aberration + nutation)/degToRad, 360);
    }
    else {
        return sunAppLongitude(julianCentury(JDNdate(date)));
    }
}
function axialTilt(date: number | DateTime) {
    // Returns the axial tilt of the earth, which also gives the latitudes of the tropics of Cancer and Capricorn.
    if (typeof(date) == "number") {return 23.4392911 - (46.815*date-0.00059*date**2+0.001813*date**3)/3600 + 0.00256*Math.cos((125.04-1934.136*date)*degToRad);}
    else {return axialTilt(julianCentury(JDNdate(date)));}
}
function declination(date: number | DateTime) {
    if (typeof(date) == "number") {return Math.asin(clamp(Math.sin(axialTilt(date)*degToRad)*Math.sin(sunAppLongitude(date)*degToRad))) / degToRad;}
    else {return declination(julianCentury(JDNdate(date)))};
}
function equationOfTime(date: number | DateTime) { 
    // Equation of time in minutes, i.e. apparent solar time minus mean solar time.
    if (typeof(date) == "number") {
        var vary = Math.tan(axialTilt(date)*degToRad/2) ** 2;
        var long = mod(280.46646 + 36000.76983*date + 0.0003032*date**2, 360);
        var anom = meanSunAnomaly(date);
        var ecc = eccentricity(date);

        return 4*(vary*Math.sin(2*long*degToRad)-2*ecc*Math.sin(anom*degToRad)+4*ecc*vary*Math.sin(anom*degToRad)*Math.cos(2*long*degToRad)-0.5*(vary**2)*Math.sin(4*long*degToRad)-1.25*(ecc**2)*Math.sin(2*anom*degToRad))/degToRad;
    }
    else {return equationOfTime(julianCentury(JDNdate(date)));}
}

function sunAngularRadius(date: DateTime) {
    // Returns the angular radius of the sun in degrees. To find the sun's angular diameter, multiply this value by 2.
    return (695700 / sunDistance(date)) / degToRad;
}

function solarTime(longitude: number, date: DateTime) {
    // Returns apparent solar time given longitude and DateTime. 
    // Solar time is given in minutes after solar midnight. 0 is solar midnight, 720 is solar noon.
    var timeEq = equationOfTime(date);
    return mod(mins(date) + timeEq + 4*longitude - date.offset, 1440);
}

function meanSolarTimeOffset(longitude: number) {
    // Returns the difference between the mean solar time at a given longitude and UTC, in minutes.
    return Math.floor(4*longitude+0.5);
}

function solarNoon(longitude: number, date: DateTime) {
    // Returns the time of solar noon as a DateTime object, given the longitude and a DateTime representing a given date. Margin of error is about 0.1 seconds.
    // Create a DateTime object representing 12:00 local time on the given date.
    var noon = DateTime.fromObject({year: date.year, month: date.month, day: date.day, hour: 12}, {zone: date.zone});
    var offset = noon.offset / 60;

    // Use longitude and time zone to calculate the time of apparent solar noon.
    var timeOffset = 4*(15*offset-longitude); // difference between clock noon and mean solar noon, in minutes. Example, if offset is -7 and longitude is -120, mean solar noon is 4*(15*(-7)-(-120)) = 4*(-105+120) = 4*15 = 60 minutes after noon on the clock.
    if (longitude < -90 && offset > 6) {timeOffset -= 1440;}
    else if (longitude > 90 && offset < -6) {timeOffset += 1440;}
    noon = noon.plus({minutes: timeOffset}); // adds timeOffset to the value of noon to find mean solar noon
    var timeEq = equationOfTime(noon);
    noon = noon.minus({minutes: timeEq});
    return noon;
}

function solarMidnight(longitude: number, date: DateTime) {
    // Returns the time of solar midnight as a DateTime object, given the longitude and a DateTime representing a given date.
    // The function returns the time of solar midnight on the previous night. For example, if the date is July 4, the value returned is on the night between July 3 and July 4.
    // The "minus(1)" in the formula for midnight below sets the time to 23:59:59.999 on the previous day. This is required because some countries, such as Lebanon, institute DST changes at midnight, so the day may actually start at 01:00:00.
    var midnight = DateTime.fromObject({year: date.year, month: date.month, day: date.day, hour: 0}, {zone: date.zone}).minus(1);
    var offset = midnight.offset / 60;

    var timeOffset = 4*(15*offset-longitude);
    if (longitude < -90 && offset > 6) {timeOffset -= 1440;}
    else if (longitude > 90 && offset < -6) {timeOffset += 1440;}
    midnight = midnight.plus({minutes: timeOffset, milliseconds: 1});
    var timeEq = equationOfTime(midnight);
    midnight = midnight.minus({minutes: timeEq});
    return midnight;
}

function subsolarPoint(date = DateTime.now().toUTC()) {
    // Returns the subsolar point given DateTime. Return value is an array: [latitude, longitude].
    var JC = julianCentury(JDNdate(date));
    var subsolarLat = declination(JC);
    var soltime0 = mins(date.toUTC()) + equationOfTime(JC); // solar time at Greenwich meridian (longitude 0)
    var subsolarLong = mod(-soltime0/4, 360) - 180;
    return [subsolarLat, subsolarLong];
}

function sunPosition(lat: number, long: number, date: DateTime) {
    // Returns sun position given latitude, longitude, and DateTime. Return value is an array: [elevation, azimuth]. Elevation is given in degrees above the horizon, azimuth is given in degrees clockwise from north.
    // The solar elevation returned by this function is not adjusted for refraction. To find the refracted solar elevation angle, use the function refract(sunPosition[0])
    var subsolarPt = subsolarPoint(date);
    var sunLat = subsolarPt[0] * degToRad;
    var sunLong = subsolarPt[1] * degToRad;
    lat *= degToRad;
    long *= degToRad;
    var c = clamp(Math.sin(lat)*Math.sin(sunLat) + Math.cos(lat)*Math.cos(sunLat)*Math.cos(sunLong-long));
    var elev = 90 - Math.acos(c) / degToRad;

    var x = Math.cos(lat)*Math.sin(sunLat)-Math.sin(lat)*Math.cos(sunLat)*Math.cos(sunLong-long);
    var y = Math.sin(sunLong-long)*Math.cos(sunLat);
    var az = Math.atan2(y, x);
    az = mod(az / degToRad, 360);
    return [elev, az];
}

function refraction(elev: number) {
    // The number of degrees by which the sun's apparent elevation increases due to atmospheric refraction.
    // This formula is borrowed from NOAA's solar calculator but modified slightly to be continuous.
    if (Math.abs(elev) >= 89.999) {return 0;}
    else {
        var ref; // refraction angle in arcseconds
        var tanElev = Math.tan(elev*degToRad);
        if (elev >= 5) {ref = (58.1/tanElev - 0.07/tanElev**3 + 0.000086/tanElev**5);}
        else if (elev >= -0.575) {ref = 1.0029734*(1735 - 518.2*elev + 103.4*elev**2 - 12.79*elev**3 + 0.711*elev**4);}
        else {ref = -20.83284/tanElev;}
        return ref/3600; // convert arcseconds to degrees
    }
}

function refract(elev: number) {
    // Adjusts the solar elevation angle to account for refraction of sunlight.
    return elev + refraction(elev);
}

function highestSunAngle(lat: number, long: number, date: DateTime) {
    /* This calculates the approximate time at which the sun reaches its highest angle. At extreme latitudes, in particular within about 2 degrees of the poles, peak 
    sun elevation can occur significantly after or before solar noon, depending on the time of year and proximity to the pole. At these latitudes, the earth's rotation 
    speed is slow enough that the change in the sun's declination during a day is significant. Sunrise/dawn can occur after solar noon and sunset/dusk can occur before 
    solar noon. For example, on March 17, 2024 at coordinates (89.8, 0.0), sunrise occurred at 12:22:43 and sunset at 14:22:02, even though solar noon was at 12:08:10 
    (all times UTC). At the poles themselves, peak solar elevation occurs either at the end of the day or the beginning of the day, except on the solstices.
    
    Both this function and the sister function lowestSunAngle are used as helper functions for the dawn and dusk functions. The return value of this function is the 
    same as solarNoon if the latitude is between -88 and 88. */
    if (Math.abs(lat) < 88) {return solarNoon(long, date);}
    else {
        var noon = solarNoon(long, date);
        var prevMidnight = solarMidnight(long, date);
        var nextMidnight = solarMidnight(long, date.plus({days: 1}));
        var noonEL = sunAppLongitude(noon);
        if ((lat > 0 && (noonEL > 270 || noonEL < 90)) || (lat < 0 && noonEL >= 90 && noonEL <= 270)) {
            // if the time of year is between the winter solstice and the summer solstice (the "rising-sun" period of the year)
            // highest sun elevation occurs after solar noon
            var cur = sunPosition(lat, long, noon);
            var next = sunPosition(lat, long, noon.plus({minutes: 5}));
            while (noon < nextMidnight && next[0] > cur[0]) {
                noon = noon.plus({minutes: 5});
                cur = sunPosition(lat, long, noon);
                next = sunPosition(lat, long, noon.plus({minutes: 5}));
            }
        }
        else {
            // if the time of year is between the summer solstice and the winter solstice (the "falling-sun" period of the year)
            // highest sun elevation occurs before solar noon
            var cur = sunPosition(lat, long, noon);
            var next = sunPosition(lat, long, noon.minus({minutes: 5}));
            while (noon > prevMidnight && next[0] > cur[0]) {
                noon = noon.minus({minutes: 5});
                cur = sunPosition(lat, long, noon);
                next = sunPosition(lat, long, noon.minus({minutes: 5}));
            }
        }
        return noon;
    }
}

function lowestSunAngle(lat: number, long: number, date: DateTime) { // See description for highestSunAngle(). The return value for this function is the same as solarMidnight if the latitude is between -88 and 88.
    if (Math.abs(lat) < 88) {return solarMidnight(long, date);}
    else {
        var midnight = solarMidnight(long, date);
        var prevNoon = solarNoon(long, date.minus({days: 1}));
        var nextNoon = solarNoon(long, date);
        var midnightEL = sunAppLongitude(midnight);
        if ((lat > 0 && (midnightEL > 270 || midnightEL < 90)) || (lat < 0 && midnightEL >= 90 && midnightEL <= 270)) {
            // if the time of year is between the winter solstice and the summer solstice (the "rising-sun" period of the year)
            // lowest sun elevation occurs before solar midnight
            var cur = sunPosition(lat, long, midnight);
            var next = sunPosition(lat, long, midnight.minus({minutes: 5}));
            while (midnight > prevNoon && next[0] < cur[0]) {
                midnight = midnight.minus({minutes: 5});
                cur = sunPosition(lat, long, midnight);
                next = sunPosition(lat, long, midnight.minus({minutes: 5}));
            }
        }
        else {
            // if the time of year is between the summer solstice and the winter solstice (the "falling-sun" period of the year)
            // lowest sun elevation occurs after solar midnight
            var cur = sunPosition(lat, long, midnight);
            var next = sunPosition(lat, long, midnight.plus({minutes: 5}));
            while (midnight < nextNoon && next[0] < cur[0]) {
                midnight = midnight.plus({minutes: 5});
                cur = sunPosition(lat, long, midnight);
                next = sunPosition(lat, long, midnight.plus({minutes: 5}));
            }
        }
        return midnight;
    }
}

function dawn(lat: number, long: number, date: DateTime, angle: number) {
    // Calculates the time in the morning at which the sun's elevation reaches the specified angle
    var midnight = lowestSunAngle(lat, long, date);
    var noon = highestSunAngle(lat, long, date);
    var dawn: DateTime;
    if (Math.abs(lat) <= 88-Math.abs(declination(noon))-Math.abs(angle)) { // calculate based on the sunrise equation
        var interval = noon.diff(midnight).as("milliseconds");
        dawn = noon;
        var dec: number, ha: number;
        for (var i=0; i<3; i++) {
            dec = declination(dawn);
            var x = (Math.sin(angle*degToRad)-Math.sin(lat*degToRad)*Math.sin(dec*degToRad))/(Math.cos(lat*degToRad)*Math.cos(dec*degToRad));
            ha = Math.acos(clamp(x));
            dawn = noon.minus(ha*interval/Math.PI);
        }
    }
    else { // if the sun is in or near the circumpolar circle, the sunrise equation may break down, so use binary search instead
        if (sunPosition(lat, long, noon)[0] <= angle) {return DateTime.fromMillis(2**52-1);} // polar night
        else if (sunPosition(lat, long, midnight)[0] >= angle) {return DateTime.fromMillis(2**52+1);} // midnight sun
        else if (midnight > noon) {return DateTime.fromMillis(2**52);} // In this case, there cannot be a sunrise. This occurs at the poles around the fall equinox when the sun sets.
        dawn = midnight;
        var t1 = 0;
        var t2 = noon.diff(midnight).as("milliseconds");
        var sunAngle: number[];
        while (t2 - t1 >= 100) { // calculates time of sunrise to precision of 100 ms (0.1 s)
            dawn = midnight.plus((t1+t2)/2);
            sunAngle = sunPosition(lat, long, dawn);
            if (sunAngle[0] >= angle) {t2 = (t1+t2)/2;}
            else {t1 = (t1+t2)/2;}
        }
    }
    return dawn;
}

function dusk(lat: number, long: number, date: DateTime, angle: number) {
    // Calculates the time in the evening at which the sun's elevation reaches the specified angle
    var noon = highestSunAngle(lat, long, date);
    var midnight = lowestSunAngle(lat, long, date.plus({days: 1}));
    var dusk: DateTime;
    if (Math.abs(lat) <= 88-Math.abs(declination(noon))-Math.abs(angle)) {
        var interval = midnight.diff(noon).as("milliseconds");
        dusk = noon;
        var dec: number, ha: number;
        for (var i=0; i<3; i++) {
            dec = declination(dusk);
            var x = (Math.sin(angle*degToRad)-Math.sin(lat*degToRad)*Math.sin(dec*degToRad))/(Math.cos(lat*degToRad)*Math.cos(dec*degToRad));
            ha = Math.acos(clamp(x));
            dusk = noon.plus(ha*interval/Math.PI);
        }
        sunAngle = sunPosition(lat, long, dusk);
    }
    else {
        if (sunPosition(lat, long, noon)[0] <= angle) {return DateTime.fromMillis(2**52-1);} // polar night
        else if (sunPosition(lat, long, midnight)[0] >= angle) {return DateTime.fromMillis(2**52+1);} // midnight sun
        else if (noon > midnight) {return DateTime.fromMillis(2**52);}
        dusk = noon;
        var t1 = 0;
        var t2 = midnight.diff(noon).as("milliseconds");
        var sunAngle : number[];
        while (t2 - t1 >= 100) {
            dusk = noon.plus((t1+t2)/2);
            sunAngle = sunPosition(lat, long, dusk);
            if (sunAngle[0] <= angle) {t2 = (t1+t2)/2;}
            else {t1 = (t1+t2)/2;}
        }
    }
    return dusk;
}

function sunrise(lat: number, long: number, date: DateTime) {return dawn(lat, long, date, -5/6);} 
function sunset(lat: number, long: number, date: DateTime) {return dusk(lat, long, date, -5/6);}
function civilDawn(lat: number, long: number, date: DateTime) {return dawn(lat, long, date, -6);}
function civilDusk(lat: number, long: number, date: DateTime) {return dusk(lat, long, date, -6);}
function nauticalDawn(lat: number, long: number, date: DateTime) {return dawn(lat, long, date, -12);}
function nauticalDusk(lat: number, long: number, date: DateTime) {return dusk(lat, long, date, -12);}
function astroDawn(lat: number, long: number, date: DateTime) {return dawn(lat, long, date, -18);}
function astroDusk(lat: number, long: number, date: DateTime) {return dusk(lat, long, date, -18);}

function dayLength(lat: number, long: number, date: DateTime) { 
    // Returns day length in seconds
    var rise = sunrise(lat, long, date);
    var set = sunset(lat, long, date);
    if (rise.toMillis() == 2**52-1 || set.toMillis() == 2**52-1) {return 0;}
    else if (rise.toMillis() == 2**52+1 || set.toMillis() == 2**52+1) {return 86400;}
    else if (rise.toMillis() == 2**52 || set.toMillis() == 2**52) {return NaN;}
    else { 
        // If the sun rises and sets. This is always the case in latitudes within (90-axialTilt-5/6) degrees of the equator.
        var length = set.diff(rise).as("seconds");
        if (length >= 86400) {return 86400;}
        return length;
    }
}

function marEquinox(year = DateTime.now().toUTC().year, timezone = "utc") {
    // Returns a DateTime object representing the moment of the March equinox in a given year (ex. 2024) and time zone (ex. "America/Los_Angeles")
    var start = DateTime.fromObject({year:year, month:3, day:16}, {zone: "utc"});
    var date = start;
    var long: number;
    var t1 = 0;
    var t2 = 8*86400*1000;
    while (t2 - t1 >= 1) {
        date = start.plus((t1+t2)/2);
        long = sunAppLongitude(date);
        if (long >= 180) {t1 = (t1+t2)/2;}
        else {t2 = (t1+t2)/2;}
    }
    return date.setZone(timezone);
}

function junSolstice(year = DateTime.now().toUTC().year, timezone = "utc") {
    // Returns a DateTime object representing the moment of the June solstice in a given year and time zone
    var start = DateTime.fromObject({year:year, month:6, day:16}, {zone: "utc"});
    var date = start;
    var long: number;
    var t1 = 0;
    var t2 = 8*86400*1000;
    while (t2 - t1 >= 1) {
        date = start.plus((t1+t2)/2);
        long = sunAppLongitude(date);
        if (long <= 90) {t1 = (t1+t2)/2;}
        else {t2 = (t1+t2)/2;}
    }
    return date.setZone(timezone);
}

function sepEquinox(year = DateTime.now().toUTC().year, timezone = "utc") {
    // Returns a DateTime object representing the moment of the September equinox in a given year and time zone
    var start = DateTime.fromObject({year:year, month:9, day:18}, {zone: "utc"});
    var date = start;
    var long: number;
    var t1 = 0;
    var t2 = 8*86400*1000;
    while (t2 - t1 >= 1) {
        date = start.plus((t1+t2)/2);
        long = sunAppLongitude(date);
        if (long <= 180) {t1 = (t1+t2)/2;}
        else {t2 = (t1+t2)/2;}
    }
    return date.setZone(timezone);
}

function decSolstice(year = DateTime.now().toUTC().year, timezone = "utc") {
    // Returns a DateTime object representing the moment of the December solstice in a given year and time zone
    var start = DateTime.fromObject({year:year, month:12, day:18}, {zone: "utc"});
    var date = start;
    var long: number;
    var t1 = 0;
    var t2 = 8*86400*1000;
    while (t2 - t1 >= 1) {
        date = start.plus((t1+t2)/2);
        long = sunAppLongitude(date);
        if (long <= 270) {t1 = (t1+t2)/2;}
        else {t2 = (t1+t2)/2;}
    }
    return date.setZone(timezone);
}

function solstEq(year: number, zone = "utc") {
    /* Returns the dates of solstices and equinoxes as a JSON object as follows:
    {year: 2024,
    marEquinox: "2024-03-20T03:06:17.077Z",
    junSolstice: "2024-06-20T20:50:58.192Z",
    sepEquinox: "2024-09-22T12:43:36.934Z",
    decSolstice: "2024-12-21T09:20:09.055Z"}

    The values are sourced directly from the file solstices_equinoxes.json, allowing for quick queries of said values, rather than
    the computationally intensive task of calculating them using binary search and the ecliptic longitude function.

    If convertToDates is set to true, the values of marEquinox, junSolstice, sepEquinox, and decSolstice are set to DateTime objects, 
    rather than ISO 8601 strings.

    If zone is set to a value other than UTC, the DateTime objects are converted to the zone in question. For example, if zone is
    set to "America/Los_Angeles", the function returns DateTime objects in Pacific Standard Time (for the December solstice) and
    Pacific Daylight Time (for the June solstice and both equinoxes).
    */
    const data = fs.readFileSync("./solstices_equinoxes.json", "utf8");
    const array = JSON.parse(data);
    var n = year - array[0].year;
    if (n < 0 || n >= array.length) {throw new Error("Index out of bounds.");}
    var obj = array[n];
    return {
        marEquinox: DateTime.fromISO(obj.marEquinox).setZone(zone),
        junSolstice: DateTime.fromISO(obj.junSolstice).setZone(zone),
        sepEquinox: DateTime.fromISO(obj.sepEquinox).setZone(zone),
        decSolstice: DateTime.fromISO(obj.decSolstice).setZone(zone)
    };
}

export {sunDistance, sunAppLongitude, axialTilt, declination, equationOfTime, meanSunAnomaly, sunAngularRadius, meanSolarTimeOffset, solarTime, solarNoon, solarMidnight, subsolarPoint, sunPosition, refraction, refract, dawn, dusk, sunrise, sunset, civilDawn, civilDusk, nauticalDawn, nauticalDusk, astroDawn, astroDusk, dayLength, marEquinox, junSolstice, sepEquinox, decSolstice, solstEq};