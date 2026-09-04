const $ = (selector) => document.querySelector(selector);
const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const startingScores = [15, 14, 13, 12, 10, 8];
const skills = [
  ["acrobatics", "Acrobatics", "Dexterity"], ["animal_handling", "Animal Handling", "Wisdom"], ["arcana", "Arcana", "Intelligence"],
  ["athletics", "Athletics", "Strength"], ["deception", "Deception", "Charisma"], ["history", "History", "Intelligence"],
  ["insight", "Insight", "Wisdom"], ["intimidation", "Intimidation", "Charisma"], ["investigation", "Investigation", "Intelligence"],
  ["medicine", "Medicine", "Wisdom"], ["nature", "Nature", "Intelligence"], ["perception", "Perception", "Wisdom"],
  ["performance", "Performance", "Charisma"], ["persuasion", "Persuasion", "Charisma"], ["religion", "Religion", "Intelligence"],
  ["sleight_of_hand", "Sleight of Hand", "Dexterity"], ["stealth", "Stealth", "Dexterity"], ["survival", "Survival", "Wisdom"]
];
let campaignName = "", cloudAvailable = false, directorMode = "cloud", currentPayload = null, pendingCheck = null;

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
function busy(value) { document.querySelectorAll("button").forEach((button) => { button.disabled = value; }); }
function directorQuery() { return `director=${directorMode}`; }
function title(value) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function badge(name, count) { const node = $(`#badge-${name}`); node.textContent = String(count); node.classList.toggle("hidden", !count); }
function openMenu(open) { $("#sidebar").classList.toggle("open", open); $("#scrim").classList.toggle("hidden", !open); }
function showPage(name) {
  if (name === "story" && !currentPayload) { $("#setup").classList.remove("hidden"); $("#app").classList.add("hidden"); }
  else { $("#setup").classList.add("hidden"); $("#app").classList.remove("hidden"); document.querySelectorAll(".page").forEach((page) => page.classList.add("hidden")); $(`#page-${name}`).classList.remove("hidden"); }
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === name)); openMenu(false);
}
function card(headingText, text, meta = "") {
  const node = document.createElement("article"); node.className = "info-card";
  const heading = document.createElement("h2"); heading.textContent = headingText;
  const body = document.createElement("p"); body.textContent = text; node.append(heading, body);
  if (meta) { const detail = document.createElement("span"); detail.className = "meta"; detail.textContent = meta; node.append(detail); }
  return node;
}
function tag(text) { const node = document.createElement("span"); node.textContent = text; return node; }
function showRoll(check) {
  pendingCheck = check;
  $("#roll-test").textContent = `${check.skill ? title(check.skill) : title(check.ability)} · ${check.mode === "normal" ? "d20" : title(check.mode)} · ${check.modifier >= 0 ? "+" : ""}${check.modifier}`;
  $("#roll-stakes").textContent = check.stakes;
  $("#roll-result").classList.add("hidden"); $("#roll-message").textContent = ""; $("#roll-button").textContent = "Roll";
  $("#roll-overlay").classList.remove("hidden"); $("#roll-button").focus();
}
function renderCharacter(character) {
  $("#character-create").classList.toggle("hidden", Boolean(character)); $("#character-sheet").classList.toggle("hidden", !character);
  if (!character) { $("#page-character h1").textContent = "Your character"; return; }
  $("#page-character h1").textContent = character.name; $("#character-notes").textContent = character.identityNotes || "No identity notes recorded.";
  $("#character-hp").textContent = `${character.currentHp} / ${character.maxHp}`; $("#character-defense").textContent = String(character.defense);
  $("#character-abilities").replaceChildren(...abilities.map((ability) => { const node = document.createElement("div"); node.className = "stat-card"; const modifier = character.abilityModifiers[ability]; node.innerHTML = `<span>${title(ability)}</span><strong>${character.abilityScores[ability]} (${modifier >= 0 ? "+" : ""}${modifier})</strong>`; return node; }));
  $("#character-skills").replaceChildren(...character.skillProficiencies.map((skill) => tag(title(skill))));
  $("#character-saves").replaceChildren(...character.saveProficiencies.map((save) => tag(title(save))));
}
function renderQuests(quests = []) {
  const list = $("#quest-list");
  if (!quests.length) {
    const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "No player-known quest is currently recorded.";
    list.replaceChildren(empty); return;
  }
  const priority = { active: 0, changed: 1, available: 2, completed: 3, failed: 4, locked: 5 };
  const sorted = [...quests].sort((left, right) => (priority[left.state] ?? 9) - (priority[right.state] ?? 9) || right.updatedTurn - left.updatedTurn);
  list.replaceChildren(...sorted.map((quest) => {
    const node = document.createElement("article"); node.className = `quest-card quest-${quest.state}`;
    const header = document.createElement("header");
    const heading = document.createElement("h2"); heading.textContent = quest.title;
    const state = document.createElement("span"); state.className = "quest-state"; state.textContent = title(quest.state);
    header.append(heading, state);
    const meta = document.createElement("p"); meta.className = "quest-meta"; meta.textContent = `${title(quest.questType)} quest · ${title(quest.minimumStage)} stage`;
    const summary = document.createElement("p"); summary.className = "quest-summary"; summary.textContent = quest.summary;
    const objectiveTitle = document.createElement("h3"); objectiveTitle.textContent = "Objectives";
    const objectives = document.createElement("ol"); objectives.className = "quest-objectives";
    for (const objective of quest.objectives) {
      const item = document.createElement("li"); item.className = `objective-${objective.state}`; item.textContent = objective.summary;
      const marker = document.createElement("span"); marker.textContent = title(objective.state); item.append(marker); objectives.append(item);
    }
    const stakes = document.createElement("p"); stakes.className = "quest-stakes"; stakes.textContent = `Stakes: ${quest.stakes}`;
    node.append(header, meta, summary, objectiveTitle, objectives, stakes);
    if (quest.recoveryOfQuestId) {
      const recovery = document.createElement("p"); recovery.className = "quest-recovery"; recovery.textContent = `Altered route after ${quest.recoveryOfQuestId}: ${quest.recoveryPathUsed}`; node.append(recovery);
    }
    if (quest.state === "completed" && quest.selectedOutcomeId) {
      const selected = quest.outcomes.find((outcome) => outcome.outcomeId === quest.selectedOutcomeId);
      if (selected) { const outcome = document.createElement("p"); outcome.className = "quest-outcome"; outcome.textContent = `Outcome: ${selected.summary}`; node.append(outcome); }
    }
    return node;
  }));
}
function render(payload) {
  currentPayload = payload;
  const { campaign, context, moment, storyHistory = [], factions = [], locations = [], quests = context.playerQuests || [], actionable = {} } = payload;
  const playerCharacter = payload.playerCharacter ?? context.playerCharacter;
  $("#setup").classList.add("hidden"); $("#app").classList.remove("hidden");
  $("#story-stage").textContent = campaign.stage; $("#story-location").textContent = context.currentLocation.name; $("#story-turn").textContent = `Turn ${campaign.turn}`;
  $("#story-title").textContent = moment?.presentation?.title || context.currentLocation.name; $("#story-narration").textContent = moment?.presentation?.narration || "Open the story through the Live Campaign Master.";
  $("#director-label").textContent = directorMode === "cloud" ? "Live Campaign Master" : "Diagnostics only";
  $("#story-actions").replaceChildren(...(moment?.presentation?.suggestedActions || []).map((action) => { const button = document.createElement("button"); button.type = "button"; button.className = "story-choice"; button.textContent = action; button.onclick = () => { $("#action-input").value = action; $("#action-input").focus(); }; return button; }));
  $("#story-history").replaceChildren(...storyHistory.slice(-4, -1).map((entry) => { const node = document.createElement("div"); node.className = "history-entry"; const action = document.createElement("div"); action.className = "history-action"; action.textContent = `Turn ${entry.turn} · ${entry.action}`; const text = document.createElement("div"); text.textContent = entry.narration; node.append(action, text); return node; }));
  $("#faction-list").replaceChildren(...factions.map((faction) => card(faction.name, faction.service, `Current influence ${faction.condition}/4 · path progress ${faction.progress}/3`)));
  const current = locations[0];
  $("#current-location").replaceChildren(...(current ? [Object.assign(document.createElement("h2"), { textContent: current.name }), Object.assign(document.createElement("p"), { textContent: `You are here. ${current.perspectiveTags.join(" · ")}` })] : []));
  $("#location-list").replaceChildren(...locations.slice(1).map((location) => card(location.name, location.perspectiveTags.join(" · "), "Directly reachable")));
  $("#history-list").replaceChildren(...(storyHistory.length ? storyHistory.map((entry) => card(`Turn ${entry.turn}`, entry.narration, entry.action)) : [Object.assign(document.createElement("div"), { className: "empty-state", textContent: "The campaign has not recorded a completed action yet." })]));
  renderQuests(quests);
  badge("quests", actionable.quests || 0); badge("factions", actionable.factions || 0); badge("locations", actionable.locations || 0); badge("inventory", actionable.inventory || 0);
  renderCharacter(playerCharacter); showPage(playerCharacter ? "story" : "character");
  if (payload.pendingCheck) showRoll(payload.pendingCheck);
}
function buildCharacterForm() {
  $("#ability-fields").replaceChildren(...abilities.map((ability, index) => { const field = document.createElement("div"); field.className = "choice-field"; const label = document.createElement("label"); label.htmlFor = `ability-${ability}`; label.textContent = title(ability); const select = document.createElement("select"); select.id = `ability-${ability}`; for (const score of startingScores) select.append(new Option(String(score), String(score), false, score === startingScores[index])); field.append(label, select); return field; }));
  $("#skill-fields").replaceChildren(...skills.map(([key, name, ability]) => { const field = document.createElement("div"); field.className = "check-field"; field.innerHTML = `<input id="skill-${key}" type="checkbox" value="${key}" data-kind="skill"><label for="skill-${key}">${name}<small>${ability}</small></label>`; return field; }));
  $("#save-fields").replaceChildren(...abilities.map((ability) => { const field = document.createElement("div"); field.className = "check-field"; field.innerHTML = `<input id="save-${ability}" type="checkbox" value="${ability}" data-kind="save"><label for="save-${ability}">${title(ability)}</label>`; return field; }));
  document.querySelectorAll('[data-kind="skill"], [data-kind="save"]').forEach((input) => input.addEventListener("change", () => { $("#skill-count").textContent = `${document.querySelectorAll('[data-kind="skill"]:checked').length} / 4`; $("#save-count").textContent = `${document.querySelectorAll('[data-kind="save"]:checked').length} / 2`; }));
}
async function openCampaign(create = false) {
  campaignName = $("#campaign-name").value.trim(); if (!campaignName) return; busy(true); $("#setup-message").textContent = "";
  try { if (create) await api("/api/campaigns", { method: "POST", body: JSON.stringify({ name: campaignName }) }); if (!cloudAvailable && directorMode === "cloud") directorMode = "local"; const payload = await api(`/api/campaigns/${encodeURIComponent(campaignName)}/play?${directorQuery()}`); render(payload); if (payload.playerCharacter && !cloudAvailable) { showPage("settings"); $("#key-message").textContent = "Connect the Live Campaign Master to begin story play."; } }
  catch (error) { $("#setup-message").textContent = error.message; } finally { busy(false); }
}
$("#character-form").onsubmit = async (event) => {
  event.preventDefault(); const abilityScores = Object.fromEntries(abilities.map((ability) => [ability, Number($(`#ability-${ability}`).value)]));
  const skillProficiencies = [...document.querySelectorAll('[data-kind="skill"]:checked')].map((input) => input.value); const saveProficiencies = [...document.querySelectorAll('[data-kind="save"]:checked')].map((input) => input.value);
  busy(true); $("#character-message").textContent = "";
  try { render(await api(`/api/campaigns/${encodeURIComponent(campaignName)}/character`, { method: "POST", body: JSON.stringify({ name: $("#character-name").value, identityNotes: $("#identity-notes").value, abilityScores, skillProficiencies, saveProficiencies }) })); }
  catch (error) { $("#character-message").textContent = error.message; } finally { busy(false); }
};
$("#action-form").onsubmit = async (event) => {
  event.preventDefault(); if (!currentPayload?.playerCharacter) { showPage("character"); $("#character-message").textContent = "Create your character before beginning story play."; return; }
  const input = $("#action-input").value.trim(); if (!input) return; if (directorMode !== "cloud") { showPage("settings"); $("#key-message").textContent = "Story actions require the Live Campaign Master. Diagnostics does not write the campaign."; return; }
  busy(true); $("#result").textContent = "The Campaign Master is resolving the world…";
  try { const payload = await api(`/api/campaigns/${encodeURIComponent(campaignName)}/actions`, { method: "POST", body: JSON.stringify({ input, director: "cloud" }) }); if (payload.pendingCheck) { currentPayload = { ...currentPayload, ...payload }; showRoll(payload.pendingCheck); } else { render(payload); $("#result").textContent = payload.result.summary; $("#action-input").value = ""; } }
  catch (error) { $("#result").textContent = error.message; } finally { busy(false); }
};
$("#roll-button").onclick = async () => {
  if (!pendingCheck) { $("#roll-overlay").classList.add("hidden"); return; }
  busy(true); $("#roll-message").textContent = "Rolling…";
  try {
    const payload = await api(`/api/campaigns/${encodeURIComponent(campaignName)}/rolls`, { method: "POST", body: JSON.stringify({ checkId: pendingCheck.checkId, director: directorMode }) });
    render(payload); $("#result").textContent = payload.result.summary; $("#action-input").value = "";
    $("#roll-dice").textContent = payload.roll.dice.length > 1 ? `Dice: ${payload.roll.dice.join(" and ")} · kept ${payload.roll.keptDie}` : `Die: ${payload.roll.keptDie}`;
    $("#roll-total").textContent = String(payload.roll.total); $("#roll-outcome").textContent = title(payload.roll.outcome); $("#roll-result").classList.remove("hidden");
    $("#roll-message").textContent = ""; pendingCheck = null; $("#roll-button").textContent = "Continue";
  } catch (error) { $("#roll-message").textContent = error.message; } finally { busy(false); }
};
$("#menu-button").onclick = () => openMenu(true); $("#close-menu").onclick = () => openMenu(false); $("#scrim").onclick = () => openMenu(false); document.querySelectorAll(".nav-item").forEach((item) => { item.onclick = () => showPage(item.dataset.page); });
$("#open-campaign").onclick = () => openCampaign(false); $("#new-campaign").onclick = () => openCampaign(true);
$("#save-key").onclick = async () => { const apiKey = $("#api-key").value.trim(); busy(true); try { await api("/api/settings/director", { method: "POST", body: JSON.stringify({ apiKey }) }); cloudAvailable = true; directorMode = "cloud"; $("#api-key").value = ""; $("#key-message").textContent = "Live Campaign Master connected."; updateHealth(); if (campaignName) render(await api(`/api/campaigns/${encodeURIComponent(campaignName)}/play?${directorQuery()}`)); } catch (error) { $("#key-message").textContent = error.message; } finally { busy(false); } };
$("#use-diagnostics").onclick = async () => { directorMode = "local"; $("#key-message").textContent = "Diagnostics mode active. It will not generate story."; if (campaignName) render(await api(`/api/campaigns/${encodeURIComponent(campaignName)}/play?${directorQuery()}`)); };
$("#undo-turn").onclick = async () => { if (!campaignName) return; busy(true); try { render(await api(`/api/campaigns/${encodeURIComponent(campaignName)}/rollback?${directorQuery()}`, { method: "POST", body: "{}" })); } catch (error) { $("#key-message").textContent = error.message; } finally { busy(false); } };
$("#check-update").onclick = async () => { busy(true); try { const update = await api("/api/update"); $("#update-status").textContent = update.available ? `Version ${update.latest.version} is ready. ${update.latest.notes}` : `Velmora ${update.current.version} is current.`; $("#install-update").classList.toggle("hidden", !update.available); } catch (error) { $("#update-status").textContent = error.message; } finally { busy(false); } };
$("#install-update").onclick = async () => { busy(true); $("#update-status").textContent = "Installing update and restarting Velmora…"; try { await api("/api/update", { method: "POST", body: "{}" }); let attempts = 0; const wait = setInterval(async () => { attempts += 1; try { await api("/api/health"); clearInterval(wait); location.reload(); } catch { if (attempts > 30) { clearInterval(wait); $("#update-status").textContent = "Restart is taking longer than expected. Restart Velmora from CMD."; } } }, 1000); } catch (error) { $("#update-status").textContent = error.message; busy(false); } };
function updateHealth() { $("#director-dot").classList.toggle("online", cloudAvailable); $("#live-status").textContent = cloudAvailable ? "Live Campaign Master connected" : "Live Campaign Master not connected"; }
buildCharacterForm(); api("/api/health").then((health) => { cloudAvailable = health.cloudDirectorAvailable; updateHealth(); }).catch(() => { $("#setup-message").textContent = "The engine is not responding."; });
