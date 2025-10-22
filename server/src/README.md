# suncompass/server/src

Contains the astronomical formulas used in Sun Compass. There are four executable JavaScript files, which rely on functions contained
within other files.

## rise-set.js

For any place and time on Earth, gives the position of the sun, the distance between the sun and earth, and the times of sunrise, sunset,
solar noon, solar midnight, and civil, nautical and astronomical twilight. Usage is as follows:

`node rise-set.js`: Prints a help menu with the syntax and usage of this command.

`node rise-set.js <latitude> <longitude>`: Prints the current sun position and distance, and sunrise, sunset and twilight times for today.
Coordinates are given in decimal degrees, for example `node rise-set.js 34.05 -118.25` gives data for Los Angeles, California.

`node rise-set.js <latitude> <longitude> <time>`: Prints the sun's position and distance at the given latitude and longitude coordinates.
For example, `node rise-set.js 40.75 -73.99 2025-12-31T16:15:00` gives the sun position and distance for Manhattan, New York City on
December 31, 2025 at 16:15 (4:15 pm) eastern standard time, along with sunrise, sunset, and twilight times for December 31 in Manhattan.

`node rise-set.js <latitude> <longitude> <me/js/se/ds>` gives sun position and sunrise/sunset/twilight data for the given latitude and
longitude at the March equinox (me), June solstice (js), September equinox (se), or December solstice (ds).

## solstice.js

`node solstice.js`: Prints the solstices and equinoxes in the current year (in the local time zone of the device) along with the subsolar
point (the position on Earth at which the sun is directly overhead) at each solstice and equinox.

`node solstice.js <year>`: Prints the times of solstices and equinoxes in the given year, in the device's local time zone, along with
subsolar points.

`node solstice.js <year> <time zone>`: Prints the times of solstices and equinoxes in the given year and time zone. The time zones are
either in IANA time zone format (ex. "America/Los_Angeles" for Pacific Time) or a fixed UTC offset (ex. "utc", "utc-8", "utc+5:30").

## gen-solsteq-json.js

`node gen-solsteq-json.js`: Generates a JSON file containing solstice and equinox times in UTC for all years from 0 to 2500.

## test.js

Used as a "sandbox" by the developer to test functions defined in the TypeScript files.