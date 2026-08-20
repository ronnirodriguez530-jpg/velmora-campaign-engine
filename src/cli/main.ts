import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadVelmoraContent } from "../application/campaign-loader.ts";
import { backfillAuthoredState, createCampaign, getCampaign, listEvents, openDatabase, restorePreviousTurn } from "../persistence/database.ts";
import { MockDirector } from "../director/mock-director.ts";
import { runPlayerAction } from "../application/turn-orchestrator.ts";
import { buildPerspectiveContext } from "../application/context-builder.ts";
import { getOrCreateEncounteredScene } from "../application/placement-engine.ts";
import { cloudDirectorFromEnvironment } from "../director/cloud-director.ts";
import { openPlayableMoment, submitPlayableAction } from "../application/gameplay-session.ts";
import { runSimulations } from "../application/simulation-runner.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = resolve(process.env.VELMORA_DATA_DIR ?? join(projectRoot, "data"));
const dbPath = join(dataDir, "velmora.sqlite");

async function main(): Promise<void> {
  const [command = "help", name = "default", ...rest] = process.argv.slice(2);
  const content = await loadVelmoraContent(projectRoot);

  if (command === "validate") {
    console.log(`Validated ${content.campaign.name}: ${content.factions.length} factions, ${content.locations.length} foundation locations, ${content.characters.length} essential NPC slots.`);
    return;
  }

  if (command === "help") {
    console.log("Commands: validate | simulate [paths] [turns] | init <name> | status <name> | mock <name> | context <name> | play <name> | act <name> <action> | cloud-act <name> <action> | rollback <name> | log <name>");
    return;
  }

  if (command === "simulate") {
    const paths = Number(name === "default" ? 12 : name);
    const turns = Number(rest[0] ?? 12);
    if (!Number.isInteger(paths) || paths < 1 || paths > 100) throw new Error("Simulation paths must be an integer from 1 to 100");
    if (!Number.isInteger(turns) || turns < 1 || turns > 100) throw new Error("Simulation turns must be an integer from 1 to 100");
    console.log(JSON.stringify(await runSimulations(content, paths, turns), null, 2));
    return;
  }

  const db = openDatabase(dbPath);
  try {
    backfillAuthoredState(db, content);
    if (command === "init") {
      const seed = `${name}:${Date.now()}`;
      const id = createCampaign(db, content, name, seed);
      console.log(`Created campaign ${name} (${id}) at ${dbPath}`);
      return;
    }

    const campaign = getCampaign(db, name);
    if (!campaign) throw new Error(`Campaign '${name}' does not exist. Run: npm start -- init ${name}`);

    if (command === "status") {
      console.log(JSON.stringify(campaign, null, 2));
      return;
    }

    if (command === "mock") {
      const director = new MockDirector();
      const preview = await director.preview({
        campaignId: String(campaign.id),
        stage: campaign.stage as "opening" | "stabilization" | "escalation" | "resolution",
        turn: Number(campaign.turn),
        locationId: String(campaign.currentLocationId)
      });
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    if (command === "context") {
      console.log(JSON.stringify(buildPerspectiveContext(db, content, name), null, 2));
      return;
    }

    if (command === "place") {
      const context = buildPerspectiveContext(db, content, name);
      console.log(JSON.stringify(getOrCreateEncounteredScene(db, context, content), null, 2));
      return;
    }

    if (command === "play") {
      console.log(JSON.stringify(openPlayableMoment(db, content, name), null, 2));
      return;
    }

    if (command === "turn") {
      const input = rest.join(" ").trim();
      if (!input) throw new Error("Turn command requires a player action");
      const result = await runPlayerAction(db, content, new MockDirector(), name, input);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "act") {
      const input = rest.join(" ").trim();
      if (!input) throw new Error("Act command requires a player action");
      const result = await submitPlayableAction(db, content, new MockDirector(), name, input);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "cloud-turn") {
      const input = rest.join(" ").trim();
      if (!input) throw new Error("Cloud turn command requires a player action");
      const result = await runPlayerAction(db, content, cloudDirectorFromEnvironment(), name, input);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "cloud-act") {
      const input = rest.join(" ").trim();
      if (!input) throw new Error("Cloud act command requires a player action");
      const result = await submitPlayableAction(db, content, cloudDirectorFromEnvironment(), name, input);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "rollback") {
      console.log(JSON.stringify(restorePreviousTurn(db, name), null, 2));
      return;
    }

    if (command === "log") {
      console.log(JSON.stringify(listEvents(db, String(campaign.id)), null, 2));
      return;
    }

    throw new Error(`Unknown command '${command}'`);
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
