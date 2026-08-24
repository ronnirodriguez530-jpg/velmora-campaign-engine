import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, resolve } from "node:path";
import { loadVelmoraContent } from "../application/campaign-loader.ts";
import { buildPerspectiveContext } from "../application/context-builder.ts";
import { submitPlayableAction } from "../application/gameplay-session.ts";
import { openPresentedStoryMoment } from "../application/story-session.ts";
import { checkForUpdate, installLatestUpdate } from "../application/update-manager.ts";
import { spawn } from "node:child_process";
import { cloudDirectorFromEnvironment } from "../director/cloud-director.ts";
import { MockDirector } from "../director/mock-director.ts";
import { backfillAuthoredState, createCampaign, getCampaign, listEvents, openDatabase, restorePreviousTurn } from "../persistence/database.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const publicRoot = join(projectRoot, "public");
try { loadEnvFile(join(projectRoot, ".env")); } catch { /* First run has no local API configuration. */ }
const staticFiles: Record<string, string> = {
  "/": "index.html",
  "/index.html": "index.html",
  "/app.js": "app.js",
  "/styles.css": "styles.css"
};

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > 65_536) throw new Error("Request body is too large");
  }
  if (!body) return {};
  const parsed = JSON.parse(body) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON body must be an object");
  return parsed as Record<string, unknown>;
}

export async function createVelmoraWebServer(options: { dataDir?: string } = {}) {
  const content = await loadVelmoraContent(projectRoot);
  const dataDir = resolve(options.dataDir ?? process.env.VELMORA_DATA_DIR ?? join(projectRoot, "data"));
  const db = openDatabase(join(dataDir, "velmora.sqlite"));
  backfillAuthoredState(db, content);

  const selectDirector = (requested: string | null) => {
    if (requested === "local") return new MockDirector();
    if (!process.env.OPENAI_API_KEY) throw new Error("Live Campaign Master is not configured. Open Settings for the one-time API setup, or deliberately enter Diagnostics mode.");
    return cloudDirectorFromEnvironment();
  };

  const playerView = (name: string) => {
    const context = buildPerspectiveContext(db, content, name);
    const events = listEvents(db, context.campaignId);
    const storyHistory = events.filter((event) => event.eventType === "world_turn_committed").slice(-12).map((event) => {
      const payload = JSON.parse(String(event.payloadJson ?? "{}")) as { playerInput?: string; directorSummary?: string };
      return { turn: event.turn, action: payload.playerInput ?? "", narration: payload.directorSummary ?? "" };
    });
    return {
      context,
      storyHistory,
      factions: content.factions.map((faction) => ({
        id: faction.id,
        name: faction.name,
        service: faction.service,
        districtIdentity: faction.districtIdentity,
        condition: context.factionConditions.find((item) => item.factionId === faction.id)?.condition ?? 2,
        progress: context.factionPathProgress.find((item) => item.factionId === faction.id)?.progress ?? 0
      })),
      locations: [context.currentLocation, ...context.connectedLocations],
      actionable: {
        quests: 0,
        factions: context.factionPathProgress.filter((item) => item.progress > 0).length,
        locations: context.persistentConsequences.length + context.recentTearArrivals.length,
        inventory: 0
      }
    };
  };

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const method = request.method ?? "GET";

      if (method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { ok: true, world: "Velmora", cloudDirectorAvailable: Boolean(process.env.OPENAI_API_KEY) });
        return;
      }

      if (method === "POST" && url.pathname === "/api/settings/director") {
        const body = await readJson(request);
        const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
        if (apiKey.length < 20 || /[\r\n]/u.test(apiKey)) throw new Error("Enter a valid API key");
        await writeFile(join(projectRoot, ".env"), `OPENAI_API_KEY=${apiKey}\n`, { encoding: "utf8", mode: 0o600 });
        process.env.OPENAI_API_KEY = apiKey;
        sendJson(response, 200, { configured: true });
        return;
      }

      if (method === "GET" && url.pathname === "/api/update") {
        sendJson(response, 200, await checkForUpdate(projectRoot));
        return;
      }

      if (method === "POST" && url.pathname === "/api/update") {
        const installed = await installLatestUpdate(projectRoot);
        sendJson(response, 200, { installed, restarting: true });
        setTimeout(() => server.close(() => {
          const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { cwd: projectRoot, env: process.env, detached: true, stdio: "ignore", windowsHide: false });
          child.unref();
        }), 250);
        return;
      }

      if (method === "POST" && url.pathname === "/api/campaigns") {
        const body = await readJson(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name || name.length > 48) throw new Error("Campaign name must be 1-48 characters");
        if (getCampaign(db, name)) {
          sendJson(response, 409, { error: "A campaign with that name already exists" });
          return;
        }
        createCampaign(db, content, name, `${name}:${Date.now()}`);
        sendJson(response, 201, { campaign: getCampaign(db, name), ...playerView(name) });
        return;
      }

      const match = url.pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(play|actions|rollback|log))?$/u);
      if (match) {
        const name = decodeURIComponent(match[1]);
        const operation = match[2];
        const campaign = getCampaign(db, name);
        if (!campaign) {
          sendJson(response, 404, { error: `Campaign '${name}' does not exist` });
          return;
        }

        if (method === "GET" && !operation) {
          sendJson(response, 200, { campaign, ...playerView(name) });
          return;
        }
        if (method === "GET" && operation === "play") {
          const director = selectDirector(url.searchParams.get("director"));
          sendJson(response, 200, { campaign, moment: await openPresentedStoryMoment(db, content, director, name), ...playerView(name) });
          return;
        }
        if (method === "GET" && operation === "log") {
          sendJson(response, 200, { events: listEvents(db, campaign.id) });
          return;
        }
        if (method === "POST" && operation === "actions") {
          const body = await readJson(request);
          const input = typeof body.input === "string" ? body.input.trim() : "";
          if (!input || input.length > 1000) throw new Error("Action must be 1-1000 characters");
          const requestedDirector = body.director === "local" ? "local" : "cloud";
          const director = selectDirector(requestedDirector);
          const result = await submitPlayableAction(db, content, director, name, input);
          sendJson(response, 200, { result, campaign: getCampaign(db, name), moment: await openPresentedStoryMoment(db, content, director, name), ...playerView(name) });
          return;
        }
        if (method === "POST" && operation === "rollback") {
          const restored = restorePreviousTurn(db, name);
          const director = selectDirector(url.searchParams.get("director"));
          sendJson(response, 200, { campaign: restored, moment: await openPresentedStoryMoment(db, content, director, name), ...playerView(name) });
          return;
        }
      }

      if (method === "GET" && staticFiles[url.pathname]) {
        const filename = staticFiles[url.pathname];
        const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
        response.writeHead(200, { "content-type": types[extname(filename)] ?? "application/octet-stream", "cache-control": "no-store, max-age=0" });
        response.end(await readFile(join(publicRoot, filename)));
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  server.on("close", () => db.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  const server = await createVelmoraWebServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Velmora is running at http://127.0.0.1:${port}`);
  });
}
