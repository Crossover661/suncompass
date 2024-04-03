import {degToRad, intDiv, clamp, mod, JD, JDN, JDNdate, mins, julianCentury} from './mathfuncs.js';
import {DateTime, Duration} from "luxon";

function meanSunLongitude(JC) {return mod((280.46646+JC*(36000.76983 + JC*0.0003032)), 360);}
function meanSunAnomaly(JC) {return 357.52911+JC*(35999.05029 - 0.0001537*JC);}
function eccentricity(JC) {return 0.016708634-JC*(0.000042037+0.0000001267*JC);}
function equationOfCenter(JC) {return Math.sin(meanSunAnomaly(JC)*degToRad)*(1.914602-JC*(0.004817+0.000014*JC))+Math.sin(2*meanSunAnomaly(JC)*degToRad)*(0.019993-0.000101*JC)+Math.sin(3*meanSunAnomaly(JC)*degToRad)*0.000289;}
function sunLongitude(JC) {return meanSunLongitude(JC) + equationOfCenter(JC);}
function sunAnomaly(JC) {return meanSunAnomaly(JC) + equationOfCenter(JC);}
function sunEarthDistanceKM(JC) {
    var ecc = eccentricity(JC);
    return (149598023*(1-ecc*ecc))/(1+ecc*Math.cos(sunAnomaly(JC)*degToRad));
}
function sunAppLongitude(JC) {return mod(sunLongitude(JC)-0.00569-0.00478*Math.sin((125.04-1934.136*JC)*degToRad), 360);}
function axialTilt(JC){
    // Returns the axial tilt of the earth, which also gives the latitudes of the tropics of Cancer and Capricorn.
    return 23+(26+((21.448-JC*(46.815+JC*(0.00059-JC*0.001813))))/60)/60 
    +0.00256*Math.cos((125.04-1934.136*JC)*degToRad);
}
function declination(JC) {
    // Declination of the sun, i.e. latitude at which the sun is overhead.
    return Math.asin(clamp(Math.sin(axialTilt(JC)*degToRad)*Math.sin(sunAppLongitude(JC)*degToRad))) / degToRad;
}
function equationOfTime(JC) { 
    // Equation of time in minutes, i.e. apparent solar time minus mean solar time.
    var vary = Math.tan(axialTilt(JC)*degToRad/2) ** 2;
    var long = meanSunLongitude(JC);
    var anom = meanSunAnomaly(JC);
    var ecc = eccentricity(JC);

    return 4*(vary*Math.sin(2*long*degToRad)-2*ecc*Math.sin(anom*degToRad)+4*ecc*vary*Math.sin(anom*degToRad)*Math.cos(2*long*degToRad)-0.5*(vary**2)*Math.sin(4*long*degToRad)-1.25*(ecc**2)*Math.sin(2*anom*degToRad))/degToRad;
}

function sunEclipticLong(date) {
    // Returns the ecliptic longitude of the sun in degrees, given a Luxon DateTime object. At the March equinox, this value is 0. At the June solstice it is 90, at the September equinox it is 180, and at the December solstice it is 270.
    var JC = julianCentury(JDNdate(date));
    return sunAppLongitude(JC);
}

function sunDistanceKM(date) {
    // Returns distance from sun to earth in kilometers given a DateTime. To convert to miles, divide by 1.609344. 
    var JC = julianCentury(JDNdate(date));
    return sunEarthDistanceKM(JC);
}

function eqOfTime(date) {
    // Returns equation of time (apparent solar time - mean solar time) given DateTime
    var JC = julianCentury(JDNdate(date));
    return equationOfTime(JC);
}

function solarTime(longitude, date) {
    // Returns solar time given longitude and DateTime. Solar time is given in minutes after solar midnight.
    var timeEq = eqOfTime(date);
    return mins(date) + timeEq + 4*longitude - date.offset;
}

function solarNoon(longitude, date) {
    // Returns the time of solar noon as a DateTime object, given the longitude and a DateTime representing a given date. Margin of error is ~0.25 seconds.
    // Create a DateTime object representing 12:00 local time on the given date.
    var noon = DateTime.fromObject({year: date.year, month: date.month, day: date.day, hour: 12}, {zone: date.zone});
    var offset = noon.offset / 60;

    // Use longitude and time zone to calculate the time of apparent solar noon.
    var timeOffset = 4*(15*offset-longitude); // difference between clock noon and mean solar noon, in minutes. Example, if offset is -7 and longitude is -120, mean solar noon is 4*(15*(-7)-(-120)) = 4*(-105+120) = 4*15 = 60 minutes after noon on the clock.
    noon = noon.plus({minutes: timeOffset}); // adds timeOffset to the value of noon to find mean solar noon
    var timeEq = eqOfTime(noon);
    noon = noon.minus({minutes: timeEq});
    return noon;
}

function solarMidnight(longitude, date) {
    // Returns the time of solar midnight as a DateTime object, given the longitude and a DateTime representing a given date.
    // The function returns the time of solar midnight on the previous night. For example, if the date is July 4, the value returned is on the night between July 3 and July 4.
    var midnight = DateTime.fromObject({year: date.year, month: date.month, day: date.day, hour: 0}, {zone: date.zone});
    midnight = midnight.minus({milliseconds: 1}); // In some places (such as Jordan pre-2022), daylight saving time adjustments occur at midnight, so the day might not necessarily start at midnight. To make up for this, the clock is set to 23:59:59.999 on the previous day
    var offset = midnight.offset / 60;

    var timeOffset = 4*(15*offset-longitude);
    midnight = midnight.plus({minutes: timeOffset, milliseconds: 1});
    var timeEq = eqOfTime(midnight);
    midnight = midnight.minus({minutes: timeEq});
    return midnight;
}

function subsolarPoint(date) {
    // Returns the subsolar point given DateTime. Return value is an array: [latitude, longitude].
    var JC = julianCentury(JDNdate(date));
    var subsolarLat = declination(JC);
    var soltime0 = mins(date) + equationOfTime(JC) - date.offset; // solar time at Greenwich meridian (longitude 0)
    var subsolarLong = mod(-soltime0/4, 360) - 180;
    return [subsolarLat, subsolarLong];
}

function sunPosition(lat, long, date) {
    // Returns sun position given latitude, longitude, and DateTime. Return value is an array: [elevation, azimuth]. Elevation is given in degrees above the horizon, azimuth is given in degrees clockwise from north. Elevation is not adjusted for refraction.
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

function refraction(elev) {
    // Increase in the apparent solar elevation angle (in degrees) due to refraction of sunlight.
    // Refraction formulas obtained from NOAA's solar calculator but modified slightly to be continuous.
    if (Math.abs(elev) >= 89.9999) {return 0;}
    else {
        var tanElev = Math.tan(elev*degToRad);
        var ref; // refraction angle in arcseconds
        if (elev >= 5) {ref = 58.1/tanElev - 0.07/(tanElev**3) + 0.000086/(tanElev**5);}
        else if (elev >= 0.575) {ref = 1.002973*(1735 + elev*(elev*(103.4+elev*(elev*0.711-12.79))-518.2));}
        else {ref = -20.8328/tanElev;}
        return ref/3600; // convert arcseconds to degrees
    }
}

function refract(elev) {
    // Adjusts the solar elevation angle to account for refraction of sunlight.
    return elev + refraction(elev);
}

function dawn(lat, long, date, angle) {
    // Calculates the time in the morning at which the sun's elevation reaches the specified angle. Returns an array: [DateTime of dawn, solar azimuth at dawn]
    var midnight = solarMidnight(long, date);
    var noon = solarNoon(long, date);
    if (sunPosition(lat, long, noon)[0] <= angle) {return [Number.NEGATIVE_INFINITY, NaN];} // polar night
    else if (sunPosition(lat, long, midnight)[0] >= angle) {return [Number.POSITIVE_INFINITY, NaN];} // midnight sun
    var dawn = midnight;
    var t1 = 0;
    var t2 = noon.diff(midnight).as("milliseconds");
    var sunAngle;
    while (t2 - t1 >= 50) { // calculates time of sunrise to precision of 50 ms
        dawn = midnight.plus({milliseconds: (t1+t2)/2});
        sunAngle = sunPosition(lat, long, dawn);
        if (sunAngle[0] >= angle) {t2 = (t1+t2)/2;}
        else {t1 = (t1+t2)/2;}
    }
    return [dawn, sunAngle[1]];
}

function dusk(lat, long, date, angle) {
    // Calculates the time in the evening at which the sun's elevation reaches the specified angle. Returns an array: [DateTime of dusk, solar azimuth at dusk]
    var noon = solarNoon(long, date);
    var midnight = solarMidnight(long, date.plus({days: 1}));
    if (sunPosition(lat, long, noon)[0] <= angle) {return [Number.NEGATIVE_INFINITY, NaN];} // polar night
    else if (sunPosition(lat, long, midnight)[0] >= angle) {return [Number.POSITIVE_INFINITY, NaN];} // midnight sun
    var dusk = noon;
    var t1 = 0;
    var t2 = midnight.diff(noon).as("milliseconds");
    var sunAngle;
    while (t2 - t1 >= 50) {
        dusk = noon.plus({milliseconds: (t1+t2)/2});
        sunAngle = sunPosition(lat, long, dusk);
        if (sunAngle[0] <= angle) {t2 = (t1+t2)/2;}
        else {t1 = (t1+t2)/2;}
    }
    return [dusk, sunAngle[1]];
}

function sunrise(lat, long, date) {return dawn(lat, long, date, -5/6);} 
function sunset(lat, long, date) {return dusk(lat, long, date, -5/6);}
function civilDawn(lat, long, date) {return dawn(lat, long, date, -6);}
function civilDusk(lat, long, date) {return dusk(lat, long, date, -6);}
function nauticalDawn(lat, long, date) {return dawn(lat, long, date, -12);}
function nauticalDusk(lat, long, date) {return dusk(lat, long, date, -12);}
function astroDawn(lat, long, date) {return dawn(lat, long, date, -18);}
function astroDusk(lat, long, date) {return dusk(lat, long, date, -18);}

function dayLength(lat, long, date) { // returns length of daylight as a DateTime duration (hours, minutes, seconds)
    if (Math.abs(lat) < 88) {
        var rise = sunrise(lat, long, date);
        var set = sunset(lat, long, date);
        if (set[0] == Number.POSITIVE_INFINITY) { // if the sun does not set, and stays above the horizon all evening
            if (rise[0] == Number.POSITIVE_INFINITY) {return Duration.fromObject({hours: 24, minutes: 0, seconds: 0});} // if the sun stays above the horizon the entire day
            else { // if the sun rises but does not set (i.e. first day of midnight sun)
                var midnight = solarMidnight(long, date.plus({days: 1}));
                return midnight.diff(rise[0]);
            }
        }
        else if (rise[0] == Number.POSITIVE_INFINITY) { // if the sun sets but does not rise (i.e. last day of midnight sun)
            var midnight = solarMidnight(long, date);
            return set[0].diff(midnight);
        }
        else if (set[0] == Number.NEGATIVE_INFINITY || rise[0] == Number.NEGATIVE_INFINITY) { // polar night
            return Duration.fromObject({hours: 0, minutes: 0, seconds: 0});
        }
        else { // If the sun rises and sets. This is always the case in latitudes within (90-axialTilt-5/6) degrees of the equator.
            var length = set[0].diff(rise[0], ["hours", "minutes", "seconds"]);
            if (length.hours >= 24) {return Duration.fromObject({hours: 24, minutes: 0, seconds: 0});}
            else {return length;}
        }
    }
    else { // Alternative calculation due to the breakdown of the normal sunrise and sunset calculations at extreme latitudes.
        var phaseChanges = polarDawnAndDusk(lat, long, date);
        if (phaseChanges == 4) {return Duration.fromObject({hours: 24, minutes: 0, seconds: 0});}
        else if (phaseChanges == 0 || phaseChanges == 1 || phaseChanges == 2 || phaseChanges == 3) {return Duration.fromObject({hours: 0, minutes: 0, seconds: 0});}
        else {
            var sunrisessets = []; // an array representing the times of sunrises and sunsets
            var startsAtNight = (phaseChanges[1][0] != -1); // If this value is true, the first value in the sunrisessets array is a sunrise. Otherwise, it is a sunset.
            for (var i=0; i<phaseChanges[0].length; i++) {
                if (phaseChanges[1][i] == 1 || phaseChanges[1][i] == -1) {sunrisessets.push(phaseChanges[0][i]);}
            }
            var dayDurations;
            for (var i=0; i<sunrisessets.length-1; i++) {
                var diff = sunrisessets[i+1].diff(sunrisessets[i]);
                dayDurations.push(diff);
            }
            if (sunrisessets.length == 0) {return Duration.fromObject({hours: 0, minutes: 0, seconds: 0});}
            else {
                // TBD: Add code to calculate and return length of day based on dayDurations
            }
        }
    }
}

function polarDawnAndDusk(lat, long, date) {
    // An alternative to the sunrise, sunset, dawn, and dusk functions used at latitudes above 88 degrees.
    // At this latitude, the change in the sun's declination during a day is significant compared to the Earth's rotation, and thus the peak solar altitude can occur significantly before or after solar noon. Sunrise/dawn can occur after solar noon and sunset/dusk can occur before solar noon. In addition, a specific phase transition (such as sunrise or civil dusk) can occur twice within a solar day.
    // At the poles themselves, the day-night cycle lasts an entire year and is dictated by Earth's revolution around the sun, rather than its rotation about its axis. The sun's altitude is about +23.4 degrees at the summer solstice, -23.4 degrees at the winter solstice, and 0 degrees at the equinoxes.
    if (lat >= 88) {
        if (date.month >= 4 && date.month <= 8) {return 4;} // continuous daylight from April through August
        else if (date.month == 12) {return 0;} // continuous darkness, no twilight in December
    }
    else if (lat <= -88) {
        if (date.month <= 2 || date.month >= 10) {return 4;} // continuous daylight from October through February
        else if (date.month == 6) {return 0;} // continuous darkness, no twilight in June
    }
    
    var curTime = solarMidnight(long, date);
    var nextMidnight = solarMidnight(long, date.plus({days: 1}));
    var interval = nextMidnight.diff(curTime).as("milliseconds");
    var phaseChangeTimes = [];
    var phaseChanges = [];
    var azimuths = [];
    var curAngle = sunPosition(lat, long, curTime);
    var nextTime;
    var nextAngle;
    while (curTime < nextMidnight) {
        nextTime = curTime.plus(interval/1440);
        nextAngle = sunPosition(lat, long, nextTime);
        var transition = 0;
        if (curAngle[0] < -5/6 && nextAngle[0] >= -5/6) {transition = 1;} // sunrise
        else if (curAngle[0] < -6 && nextAngle[0] >= -6) {transition = 2;} // civil dawn
        else if (curAngle[0] < -12 && nextAngle[0] >= -12) {transition = 3;} // nautical dawn
        else if (curAngle[0] < -18 && nextAngle[0] >= -18) {transition = 4;} // astronomical dawn
        else if (curAngle[0] >= -5/6 && nextAngle[0] < -5/6) {transition = -1;} // sunset
        else if (curAngle[0] >= -6 && nextAngle[0] < -6) {transition = -2;} // civil dusk
        else if (curAngle[0] >= -12 && nextAngle[0] < -12) {transition = -3;} // nautical dusk
        else if (curAngle[0] >= -18 && nextAngle[0] < -18) {transition = -4;} // astronomical dusk
        
        if (transition != 0) {
            while (curTime < nextTime) {
                curTime = curTime.plus(interval/(1440*20));
                curAngle = sunPosition(lat, long, curTime);
                if (transition == 1 && curAngle[0] >= -5/6 ||
                    transition == 2 && curAngle[0] >= -6 ||
                    transition == 3 && curAngle[0] >= -12 ||
                    transition == 4 && curAngle[0] >= -18 ||
                    transition == -1 && curAngle[0] < -5/6 ||
                    transition == -2 && curAngle[0] < -6 ||
                    transition == -3 && curAngle[0] < -12 ||
                    transition == -4 && curAngle[0] < -18) {break;}
            }
            phaseChangeTimes.push(curTime);
            phaseChanges.push(transition);
            azimuths.push(curAngle[1]);
        }
        curTime = nextTime;
        curAngle = nextAngle;
    }
    if (phaseChangeTimes.length != 0) {return [phaseChangeTimes, phaseChanges, azimuths];}
    else if (curAngle[0] < -18) {return 0;} // night all day, no twilight
    else if (curAngle[0] < -12) {return 1;} // astronomical twilight all day
    else if (curAngle[0] < -6) {return 2;} // nautical twilight all day
    else if (curAngle[0] < -5/6) {return 3;} // civil twilight all day
    else {return 4;} // daylight all day
}

function marEquinox(year, timezone) {
    // Returns a DateTime object representing the moment of the March equinox in a given year (ex. 2024) and time zone (ex. "America/Los_Angeles")

    var start = DateTime.fromObject({year: year, month: 3, day: 16}, {zone: "UTC"});
    var date;
    var long;
    var t1 = 0;
    var t2 = 8*86400*1000;
    while (t2 - t1 >= 100) {
        date = start.plus((t1+t2)/2);
        long = sunEclipticLong(date);
        if (long >= 180) {t1 = (t1+t2)/2;}
        else {t2 = (t1+t2)/2;}
    }
    return date.setZone(timezone);
}

function junSolstice(year, timezone) {
    // Returns a DateTime object representing the moment of the June solstice in a given year and time zone
    var start = DateTime.fromObject({year: year, month: 6, day: 16}, {zone: "UTC"});
    var date;
    var long;
    var t1 = 0;
    var t2 = 8*86400*1000;
    while (t2 - t1 >= 100) {
        date = start.plus((t1+t2)/2);
        long = sunEclipticLong(date);
        if (long <= 90) {t1 = (t1+t2)/2;}
        else {t2 = (t1+t2)/2;}
    }
    return date.setZone(timezone);
}

function sepEquinox(year, timezone) {
    // Returns a DateTime object representing the moment of the September equinox in a given year and time zone
    var start = DateTime.fromObject({year: year, month: 9, day: 18}, {zone: "UTC"});
    var date;
    var long;
    var t1 = 0;
    var t2 = 8*86400*1000;
    while (t2 - t1 >= 100) {
        date = start.plus((t1+t2)/2);
        long = sunEclipticLong(date);
        if (long <= 180) {t1 = (t1+t2)/2;}
        else {t2 = (t1+t2)/2;}
    }
    return date.setZone(timezone);
}

function decSolstice(year, timezone) {
    var start = DateTime.fromObject({year: year, month: 12, day: 18}, {zone: "UTC"});
    var date;
    var long;
    var t1 = 0;
    var t2 = 8*86400*1000;
    while (t2 - t1 >= 100) {
        date = start.plus((t1+t2)/2);
        long = sunEclipticLong(date);
        if (long <= 270) {t1 = (t1+t2)/2;}
        else {t2 = (t1+t2)/2;}
    }
    return date.setZone(timezone);
}

export {meanSunLongitude, meanSunAnomaly, eccentricity, equationOfCenter, sunLongitude, sunAnomaly, sunEarthDistanceKM, sunAppLongitude, axialTilt, declination, equationOfTime, sunEclipticLong, sunDistanceKM, eqOfTime, solarTime, solarNoon, solarMidnight, subsolarPoint, sunPosition, refraction, refract, dawn, dusk, sunrise, sunset, civilDawn, civilDusk, nauticalDawn, nauticalDusk, astroDawn, astroDusk, dayLength, polarDawnAndDusk, marEquinox, junSolstice, sepEquinox, decSolstice};