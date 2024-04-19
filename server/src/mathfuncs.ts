const degToRad = Math.PI/180;

import { DateTime } from 'luxon';

function intDiv(x: number, y: number) {
    if (x<0) {return Math.ceil(x/y);}
    else {return Math.floor(x/y);}
}

function clamp(x: number) {
    if (x <= -1) {return -1;}
    else if (x >= 1) {return 1;}
    else {return x;}
}

function mod(x: number, y: number) {return ((x % y) + y) % y;} // mod function, but output is always in the range [0, y)

function JD(y: number, m: number, d: number){ // calculates Julian ephemeris given Gregorian date
    return intDiv(1461 * (y+4800 + intDiv(m-14,12)), 4) +
    intDiv(367 * (m-2 - 12*intDiv(m-14,12)), 12) -
    intDiv(3 * intDiv(y+4900 + intDiv(m-14, 12), 100), 4) + d - 32075;
}

function JDN(y: number, m: number, d: number, time: number, timezone: number) {return JD(y, m, d) + (time - 60*timezone - 720)/1440;} // time in minutes after midnight

function mins(date: DateTime) {return date.hour*60 + date.minute + date.second/60 + date.millisecond/60000;}

function JDNdate(date: DateTime) {
    // gets Julian ephemeris day (including fractional part) given a Luxon DateTime object
    var year = date.year;
    var month = date.month;
    var day = date.day;
    var time = mins(date);
    var timezone = date.offset /60;
    return JDN(year,month,day,time,timezone);
}

function julianCentury(JDN: number) {return (JDN-2451545)/36525;}

function direction(bearing: number) { // returns the compass direction (ex. SW) given the compass bearing (ex. 225 degrees)
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

function displayTime(date: any, format=12) {
    if (date == Number.POSITIVE_INFINITY) {return "∞";}
    else if (date == Number.NEGATIVE_INFINITY) {return "-∞";}
    else if (isNaN(date)) {return NaN;}
    else if (format == 12) {return date.toFormat("h:mm:ss a");}
    else {return date.toFormat("HH:mm:ss");}
}

function displayDuration(duration: any) {
    if (duration == Number.POSITIVE_INFINITY) {return "∞";}
    else if (duration == Number.NEGATIVE_INFINITY) {return "-∞";}
    else if (isNaN(duration)) {return NaN;}
    else {return duration.toFormat("h:mm:ss");}
}

export {degToRad, intDiv, clamp, mod, JD, JDN, JDNdate, mins, julianCentury, direction, displayTime, displayDuration};