// SunTime.ts
import { refract } from "./suncalc.js";
import * as mf from "./mathfuncs.js";
import { DateTime } from "luxon";
import { DAY_LENGTH } from "./constants.js";
import { getOffsetFromTable } from "./lookup-tables.js";
export default class SunTime {
    /**
     * An object representing the time of a solar event (solar noon, solar midnight, dawn, dusk, sunrise, or sunset)
     * @param time Unix timestamp of the event, in milliseconds
     * @param solarElevation Solar elevation (not refracted)
     * @param solarAzimuth Solar azimuth
     * @param eventType String representing the type of solar event. Either "Solar Midnight", "Astro Dawn", "Nautical Dawn",
     * "Civil Dawn", "Sunrise", "Solar Noon", "Sunset", "Civil Dusk", "Nautical Dusk", or "Astro Dusk".
     */
    constructor(time, solarElevation, solarAzimuth, eventType) {
        this.time = time;
        this.solarElevation = solarElevation;
        this.solarAzimuth = solarAzimuth;
        this.eventType = eventType;
    }
    valueOf() { return this.time; }
    /** Returns the timestamp as a Luxon DateTime in the given time zone. If time zone is not specified, defaults to UTC. */
    toDateTime(timeZone = "utc") {
        return DateTime.fromMillis(this.time, { zone: timeZone });
    }
    /** Given a time zone (either an IANA string or a lookup table) return the time of day as an integer between 0 and 86399999,
     * inclusive. If the local time is represented as h hours, m minutes, s seconds, and ms milliseconds, then the value returned
     * is equal to 3.6e6*h + 60000*m + 1000*s + ms.
    */
    timeOfDay(timeZone) {
        if (typeof (timeZone) == "string") {
            const dt = this.toDateTime(timeZone);
            return dt.millisecond + 1000 * dt.second + 60000 * dt.minute + 3600000 * dt.hour;
        }
        else {
            const offset = getOffsetFromTable(this.time, timeZone);
            const adjustedTimestamp = this.time + offset * 60000;
            return mf.mod(adjustedTimestamp, DAY_LENGTH);
        }
    }
    toStringTZ(timeZone) {
        const eventTypeStr = this.eventType.padStart(14);
        const timeStr = this.toDateTime(timeZone).toFormat("h:mm:ss a").toLowerCase().padStart(11);
        const solarElevationStr = (refract(this.solarElevation).toFixed(4) + "°").padStart(9);
        const solarAzimuthStr = (this.solarAzimuth.toFixed(4) + "° " + mf.direction(this.solarAzimuth).padStart(3)).padStart(13);
        return eventTypeStr + " | " + timeStr + " | " + solarElevationStr + " | " + solarAzimuthStr;
    }
    /** Converts to a string with given text color and boldness. Red, green, and blue must be integers. */
    toStringFormatted(bold, red, green, blue, timeZone) {
        const colorStr = "\x1b[38;2;" + red.toString() + ";" + green.toString() + ";" + blue.toString() + "m";
        const boldStr = "\x1b[1m";
        const resetStr = "\x1b[0m";
        if (bold) {
            return colorStr + boldStr + this.toStringTZ(timeZone) + resetStr;
        }
        else {
            return colorStr + this.toStringTZ(timeZone) + resetStr;
        }
    }
}
