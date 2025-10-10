// SunTime.ts

import {DateTime} from "luxon";

class SunTime {
    time: DateTime;
    solarElevation: number;
    solarAzimuth: number;
    eventType: string

    /**
     * An object representing the time of a solar event (solar noon, solar midnight, dawn, dusk, sunrise, or sunset)
     * @param time DateTime object representing the time of the event
     * @param solarElevation Solar elevation (not refracted)
     * @param solarAzimuth Solar azimuth
     * @param eventType String representing the type of solar event. Either "midnight", "adawn", "ndawn", "cdawn", "sunrise", "noon",
     * "sunset", "cdusk", "ndusk", or "adusk".
     */
    constructor(time: DateTime, solarElevation: number, solarAzimuth: number, eventType: string) {
        this.time = time;
        this.solarElevation = solarElevation;
        this.solarAzimuth = solarAzimuth;
        this.eventType = eventType;
    }

    valueOf() {return this.time.toMillis();}
}

export {SunTime};