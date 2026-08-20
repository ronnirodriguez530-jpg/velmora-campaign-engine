# Velmora Campaign Engine

Local, headless foundation for the Velmora living-campaign simulation.

## Requirements

- Node.js 24 or newer

## Commands

```bash
npm run check
npm test
npm run simulate
npm run web
npm start -- init my-campaign
npm start -- status my-campaign
npm start -- mock my-campaign
npm start -- context my-campaign
npm start -- play my-campaign
npm start -- act my-campaign "support league"
npm start -- cloud-act my-campaign "I offer the League my help"
npm start -- rollback my-campaign
npm start -- log my-campaign
```

The same commands can be run without npm:

```bash
node src/cli/main.ts validate
node --test tests/*.test.ts
node src/cli/main.ts init my-campaign
node src/cli/main.ts status my-campaign
node src/cli/main.ts mock my-campaign
node src/cli/main.ts context my-campaign
node src/cli/main.ts play my-campaign
node src/cli/main.ts act my-campaign "support league"
node src/cli/main.ts cloud-act my-campaign "I offer the League my help"
node src/cli/main.ts rollback my-campaign
node src/cli/main.ts log my-campaign
```

Build 4 adds an optional cloud Campaign Director through the OpenAI Responses
API. It receives only the current player-perspective packet and must submit a
strict, bounded turn proposal. The engine validates every requested change,
retries one rejected proposal, then commits atomically or changes nothing.

The offline `turn` command and Mock Director remain available without internet
or an API key. To use `cloud-turn`, set `OPENAI_API_KEY` in your environment;
optionally set `OPENAI_MODEL` (default: `gpt-5.6`). Never commit a real key.

The engine separates confirmed canon from provisional machinery in
`BOUNDARIES.md`. The Director cannot alter canon, schemas, or mechanics.

Build 5 connects the placed scene to the Director's perspective packet and adds
the small playable flow: `play` opens or resumes the current encountered scene,
then `act` or `cloud-act` submits a suggested choice or free-text action. The
vertical proof verifies placement, one safe major turn, save/reopen continuity,
and rollback without adding authored story outcomes.

The preserved continuity machinery is restored as explicitly provisional
scaffolding. It can advance abstract faction paths, evaluate four-stage
continuity, place generic stage scenes, and generate deterministic Tear arrivals
without claiming those defaults as canon or inventing quest content.

`npm run simulate` runs twelve isolated twelve-turn campaign paths, compares
their final world patterns, reports validation failures, and never writes those
test runs into the playable campaign database.

`npm run web` starts the complete local application at
`http://127.0.0.1:4173`. The browser interface, engine, and SQLite save remain
separate parts of the same application. If `OPENAI_API_KEY` is configured, the
interface also enables the live Campaign Director; otherwise it stays in safe
local test mode.

The browser now treats the Live Campaign Master as normal play. Open the
top-left menu, choose Settings, and enter the API key there once. The key is
stored only in the local ignored `.env` file and is never included in packaged
checkpoints. Diagnostics is explicitly separated and does not pretend to
generate campaign story.

On Windows, double-click `start-velmora.bat` to open the same application. The
server binds only to this computer (`127.0.0.1`); it is not exposed publicly.

Future releases are delivered from the public GitHub repository. Settings now
contains Check for Updates and Install and Restart controls. Updating replaces
only application source; the local `data` save folder and `.env` API key file
are explicitly preserved.
