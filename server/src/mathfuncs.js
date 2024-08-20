const degToRad = Math.PI / 180;
function intDiv(x, y) {
    if (x < 0) {return Math.ceil(x / y);}
    else {return Math.floor(x / y);}
}
function clamp(x) {
    if (x <= -1) {return -1;}
    else if (x >= 1) {return 1;}
    else {return x;}
}
function mod(x, y) { return ((x % y) + y) % y; } // mod function, but output is always in the range [0, y)
function JD(y, m, d) {
    return intDiv(1461 * (y + 4800 + intDiv(m - 14, 12)), 4) +
        intDiv(367 * (m - 2 - 12 * intDiv(m - 14, 12)), 12) -
        intDiv(3 * intDiv(y + 4900 + intDiv(m - 14, 12), 100), 4) + d - 32075;
}
function JDN(y, m, d, time, timezone) { return JD(y, m, d) + (time - 60 * timezone - 720) / 1440; } // time in minutes after midnight
function mins(date) { return date.hour * 60 + date.minute + date.second / 60 + date.millisecond / 60000; }
function JDNdate(date) {
    // gets Julian day (including fractional part) given a Luxon DateTime object
    var year = date.year;
    var month = date.month;
    var day = date.day;
    var time = mins(date);
    var timezone = date.offset / 60;
    return JDN(year, month, day, time, timezone);
}
function julianCentury(JDN) { return (JDN - 2451545) / 36525; }
function direction(bearing) {
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
function displayTime(date, format = 12) {
    if (date == Number.POSITIVE_INFINITY) {return "∞";}
    else if (date == Number.NEGATIVE_INFINITY) {return "-∞";}
    else if (isNaN(date)) {return NaN;}
    else if (format == 12) {return date.toFormat("h:mm:ss a");}
    else {return date.toFormat("HH:mm:ss");}
}
function displayDuration(duration) {
    if (duration == Number.POSITIVE_INFINITY) {return "∞";}
    else if (duration == Number.NEGATIVE_INFINITY) {return "-∞";}
    else if (isNaN(duration)) {return NaN;}
    else {return duration.toFormat("h:mm:ss");}
}
function approxDeltaT(JC) {
    /* This function finds the approximate value of delta T, the difference between terrestrial time (recorded by atomic clocks)
    and mean solar time (based on the Earth's rotation). This function's margin of error is 4.8 seconds in 2024, based on the
    value this function returns (73.8 seconds) versus the real value (69 seconds). The margin of error increases for years before
    1800 and after 2100, as the Earth's rotation varies unpredictably.
    */
    var y = 100 * JC + 2000;
    if (y < 500) {
        var u = y / 100;
        return 10583.6 - 1014.41 * u + 33.78311 * u ** 2 - 5.952053 * u ** 3 - 0.1798452 * u ** 4 + 0.022174192 * u ** 5 + 0.0090316521 * u ** 6;
    }
    else if (y < 1600) {
        var u = (y - 1000) / 100;
        return 1574.2 - 556.01 * u + 71.23472 * u ** 2 + 0.319781 * u ** 3 - 0.853463 * u ** 4 - 0.005050998 * u ** 5 + 0.0083572073 * u ** 6;
    }
    else if (y < 1700) {
        var t = y - 1600;
        return 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129;
    }
    else if (y < 1800) {
        var t = y - 1700;
        return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000;
    }
    else if (y < 1860) {
        var t = y - 1800;
        return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
    }
    else if (y < 1900) {
        var t = y - 1860;
        return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
    }
    else if (y < 1920) {
        var t = y - 1900;
        return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
    }
    else if (y < 1941) {
        var t = y - 1920;
        return 21.20 + 0.84493 * t - 0.076100 * t ** 2 + 0.0020936 * t ** 3;
    }
    else if (y < 1961) {
        var t = y - 1950;
        return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
    }
    else if (y < 1986) {
        var t = y - 1975;
        return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
    }
    else if (y < 2005) {
        var t = y - 2000;
        return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
    }
    else if (y < 2050) {
        var t = y - 2000;
        return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
    }
    else if (y < 2150) {
        return 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y) - 20;
    }
    else {
        var u = (y - 1820) / 100;
        return 32 * u ** 2 - 20;
    }
}
export { intDiv, clamp, mod, JD, JDN, JDNdate, mins, julianCentury, direction, displayTime, displayDuration, approxDeltaT };
