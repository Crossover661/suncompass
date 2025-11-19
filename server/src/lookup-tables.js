import { DateTime } from "luxon";
import * as mf from "./mathfuncs.js";
import { sunTrueLong, sunDistance, obliquity } from "./suncalc.js";
/** Given the value returned by dayStarts, create a "lookup table" showing when the time offsets change during the given period. */
export function timeZoneLookupTable(dayStarts) {
    const changeAtStart = (dayStarts[0].offset != dayStarts[0].minus(1).offset);
    const firstChange = { unix: mf.ms(dayStarts[0]), offset: dayStarts[0].offset, change: changeAtStart };
    const table = [firstChange];
    for (let i = 1; i < dayStarts.length; i++) {
        const prevDay = dayStarts[i - 1], curDay = dayStarts[i];
        if (prevDay.offset != curDay.offset) {
            // If the time changes during this day, use binary search to find where it changes.
            let t0 = mf.ms(prevDay), t1 = mf.ms(curDay);
            while (t1 - t0 > 1) {
                const avg = Math.floor((t0 + t1) / 2);
                const avgTime = DateTime.fromMillis(avg, { zone: curDay.zone });
                if (avgTime.offset == prevDay.offset) {
                    t0 = avg;
                }
                else {
                    t1 = avg;
                }
            }
            table.push({ unix: t1, offset: curDay.offset, change: true });
        }
    }
    return table;
}
/** Get UTC offset (minutes) from a Unix timestamp and a time zone lookup table (see mathfuncs.timeZoneLookupTable()) */
export function getOffsetFromTable(unix, table) {
    let offset = 0;
    for (const change of table) {
        if (unix >= change.unix) {
            offset = change.offset;
        }
        else {
            break;
        }
    }
    return offset;
}
export function generateLODProfile(unix) {
    return { unix: unix, longitude: sunTrueLong(unix, true), obliquity: obliquity(unix, true), distance: sunDistance(unix, true) };
}
/** Create a lookup table for estimating longitude, obliquity, and distance throughout the year using linear interpolation. */
export function longDistLookupTable(dayStarts) {
    const table = [];
    for (const date of dayStarts) {
        table.push(generateLODProfile(mf.ms(date)));
    }
    return table;
}
/** Estimates solar ecliptic longitude, obliquity, and distance at the given Unix time using linear interpolation
 * from the start of the day to the end of the day.
 */
export function estimateLOD(unix, start, end) {
    const diffLong = mf.mod(end.longitude - start.longitude, 360);
    const diffObliquity = end.obliquity - start.obliquity;
    const diffDistance = end.distance - start.distance;
    const fraction = (unix - start.unix) / (end.unix - start.unix);
    const estLongitude = mf.mod(start.longitude + fraction * diffLong, 360);
    const estObliquity = start.obliquity + fraction * diffObliquity;
    const estDistance = start.distance + fraction * diffDistance;
    return { unix: unix, longitude: estLongitude, obliquity: estObliquity, distance: estDistance };
}
