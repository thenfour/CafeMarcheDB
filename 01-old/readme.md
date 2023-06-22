configurations:

## prod / optimized

for prod deployment, git pull and npm run build from client dir.

the server can then be run, and will serve the react app.

## prod / debug

there is no production debug configuration, because debug is only possible via `npm run start`. Any `build` action does a minified optimized build.

the configuration at `/config.json` is overridden by an ExpressJS route to give server info.

## dev / optimized

same as prod/optimized.

## dev / debug

`npm run start` from client dir.

the configuration @ `/config.json` is hard-coded

