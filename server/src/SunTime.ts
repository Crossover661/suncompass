// SunTime.ts

import {refract} from "./suncalc.js";
import {direction, mod, ms} from "./mathfuncs.js";
import { DateTime } from "luxon";
import {DAY_LENGTH} from "./constants.js";

export default class SunTime {
    /** Unix timestamp in milliseconds of this SunTime object. */
    time: DateTime;

    /** Elevation angle of the sun, not accounting for atmospheric refraction. */
    solarElevation: number;

    /** Azimuth or compass bearing angle of the sun. */
    solarAzimuth: number;

    /** String representing the type of solar event. Either "Solar Midnight", "Astro Dawn", "Nautical Dawn", 
     * "Civil Dawn", "Sunrise", "Solar Noon", "Sunset", "Civil Dusk", "Nautical Dusk", or "Astro Dusk". */
    eventType: string;

    /**
     * An object representing the time of a solar event (solar noon, solar midnight, dawn, dusk, sunrise, or sunset)
     * @param time DateTime object representing the time of the event
     * @param solarElevation Solar elevation (not refracted)
     * @param solarAzimuth Solar azimuth
     * @param eventType String representing the type of solar event. Either "Solar Midnight", "Astro Dawn", "Nautical Dawn", 
     * "Civil Dawn", "Sunrise", "Solar Noon", "Sunset", "Civil Dusk", "Nautical Dusk", or "Astro Dusk".
     */
    constructor(time: DateTime, solarElevation: number, solarAzimuth: number, eventType: string) {
        this.time = time;
        this.solarElevation = solarElevation;
        this.solarAzimuth = solarAzimuth;
        this.eventType = eventType;
    }

    valueOf(): number {return ms(this.time);}

    toString(): string {
        const eventTypeStr = this.eventType.padStart(14);
        const timeStr = this.time.toFormat("h:mm:ss a").toLowerCase().padStart(11);
        const solarElevationStr = (refract(this.solarElevation).toFixed(4) + "°").padStart(9);
        const solarAzimuthStr = (this.solarAzimuth.toFixed(4) + "° " + direction(this.solarAzimuth).padStart(3)).padStart(13);
        return eventTypeStr + " | " + timeStr + " | " + solarElevationStr + " | " + solarAzimuthStr;
    }

    /** Converts to a formatted string. Red, green, and blue must be integers. */
    toStringFormatted(bold: boolean, red: number, green: number, blue: number): string {
        const colorStr = "\x1b[38;2;" + red.toString() + ";" + green.toString() + ";" + blue.toString() + "m";
        const boldStr = "\x1b[1m";
        const resetStr = "\x1b[0m";
        if (bold) {return colorStr + boldStr + this.toString() + resetStr;}
        else {return colorStr + this.toString() + resetStr;}
    }
}