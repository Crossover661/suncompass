// SunTime.ts
class SunTime {
    /**
     * An object representing the time of a solar event (solar noon, solar midnight, dawn, dusk, sunrise, or sunset)
     * @param time DateTime object representing the time of the event
     * @param solarElevation Solar elevation
     * @param solarAzimuth Solar azimuth
     * @param eventType String representing the type of solar event. Either "midnight", "adawn", "ndawn", "cdawn", "sunrise", "noon",
     * "sunset", "cdusk", "ndusk", or "adusk".
     */
    constructor(time, solarElevation, solarAzimuth, eventType) {
        this.time = time;
        this.solarElevation = solarElevation;
        this.solarAzimuth = solarAzimuth;
        this.eventType = eventType;
    }
}
export { SunTime };
