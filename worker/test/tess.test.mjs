// Tess's answers as /api/tess gives them: a stand-in Claude records each call and answers from a script, and the
// migration runs on an in-memory SQLite standing in for D1. No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { routeFixture, TESS_FACTS } from "./routes.mjs";
import { RULES } from "../src/tess-rules.js";

const SITE = "https://site.test";
const KEY = "sk-test";

// D1 over SQLite: prepare, bind, first (a row or one column of it), run, and batch.
const d1 = () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync(new URL("../migrations/0002_tess.sql", import.meta.url), "utf8"));
  const statement = (query, args = []) => ({
    bind: (...values) => statement(query, values),
    first: async (column) => {
      const row = sql.prepare(query).get(...args);
      return row === undefined ? null : column ? row[column] : { ...row };
    },
    run: async () => { sql.prepare(query).run(...args); return { success: true }; }
  });
  return { sql, prepare: (query) => statement(query), batch: async (list) => Promise.all(list.map((s) => s.run())) };
};

// Claude answering from a script, one reply a call: a message, or an error to throw.
const claude = (...replies) => {
  const calls = [];
  const Anthropic = class {
    constructor(options) {
      this.messages = { create: async (params) => {
        calls.push({ options, params });
        const next = replies.shift();
        if (!next) throw new Error("Unexpected Claude call");
        if (next instanceof Error) throw next;
        return next;
      } };
    }
  };
  return { Anthropic, calls };
};
const USAGE = { input_tokens: 40, cache_creation_input_tokens: 7000, cache_read_input_tokens: 0, output_tokens: 60 };
const message = (out, stop = "end_turn") => ({ stop_reason: stop, usage: USAGE,
  content: [{ type: "thinking", thinking: "" }, { type: "text", text: typeof out === "string" ? out : JSON.stringify(out) }] });

const ask = (handleTess, env, body, headers = {}) => handleTess(new Request(`${SITE}/api/tess`, { method: "POST",
  headers: { origin: SITE, "content-type": "application/json", "cf-connecting-ip": "203.0.113.7", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body) }), env);
const kept = (db) => db.sql.prepare("SELECT question, about, say, go, asked FROM tess_answers ORDER BY question").all().map((row) => ({ ...row }));
const spend = (db) => db.sql.prepare("SELECT micro_usd, calls FROM tess_spend").get();

test("without a key the Worker answers nothing, and only the site may ask, by POST", async () => {
  const { handleTess } = routeFixture(), DB = d1();
  assert.equal((await ask(handleTess, { SITE_ORIGIN: SITE, DB }, { question: "what is bitcoin" })).status, 503);
  const env = { SITE_ORIGIN: SITE, DB, ANTHROPIC_API_KEY: KEY };
  assert.equal((await ask(handleTess, env, { question: "what is bitcoin" }, { origin: "https://elsewhere.test" })).status, 403);
  assert.equal((await handleTess(new Request(`${SITE}/api/tess`, { headers: { origin: SITE } }), env)).status, 405);
});

test("a question goes to Claude once, with the rules and facts as one cached prompt, and a repeat comes from what she kept", async () => {
  const stub = claude(message({ say: "Ooga Arcade, at 3 o'clock!\nA cabinet for every game.", go: "arcade" }));
  const { handleTess } = routeFixture({ anthropic: stub.Anthropic }), DB = d1(), env = { SITE_ORIGIN: SITE, DB, ANTHROPIC_API_KEY: KEY };
  const first = await ask(handleTess, env, { question: "  Where can I play games?\n" });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { say: "Ooga Arcade, at 3 o'clock!\nA cabinet for every game.", go: "arcade" });
  const { options, params } = stub.calls[0];
  assert.equal(options.apiKey, KEY);
  assert.equal(params.model, "claude-haiku-5-5");
  assert.deepEqual(params.system, [{ type: "text", text: `${RULES}\n\n${TESS_FACTS.text}`, cache_control: { type: "ephemeral" } }]);
  assert.deepEqual(params.messages, [{ role: "user", content: "Where can I play games?" }]);
  assert.equal(params.output_config.effort, "low");
  assert.deepEqual(params.output_config.format.schema.properties.go.anyOf[0].enum, TESS_FACTS.places);
  for (const name of ["temperature", "top_p", "top_k"]) assert.equal(name in params, false);

  const again = await ask(handleTess, env, { question: "where can i play GAMES??" });
  assert.deepEqual(await again.json(), { say: "Ooga Arcade, at 3 o'clock!\nA cabinet for every game.", go: "arcade" });
  assert.equal(stub.calls.length, 1);
  assert.deepEqual(kept(DB), [{ question: "where can i play games", about: "", say: "Ooga Arcade, at 3 o'clock!\nA cabinet for every game.", go: "arcade", asked: 2 }]);
  // 40 in at $0.10/M, 7000 written to the cache at 1.25x, 60 out at $0.50/M: 4 + 875 + 30 millionths of a dollar.
  assert.deepEqual({ ...spend(DB) }, { micro_usd: 909, calls: 1 });

  // New facts are a new prompt: what she kept under the old one is not served.
  const next = claude(message({ say: "Games at the arcade!", go: "arcade" }));
  const routes = routeFixture({ anthropic: next.Anthropic, facts: { ...TESS_FACTS, text: `${TESS_FACTS.text}\n- arcade: new.` } });
  assert.deepEqual(await (await ask(routes.handleTess, env, { question: "Where can I play games?" })).json(), { say: "Games at the arcade!", go: "arcade" });
  assert.equal(next.calls.length, 1);
});

test("the place she was last asked about goes with the question and keys its answer", async () => {
  const stub = claude(message({ say: "Through the shield at 2 o'clock.", go: null }), message({ say: "Inside which one?", go: null }));
  const { handleTess } = routeFixture({ anthropic: stub.Anthropic }), DB = d1(), env = { SITE_ORIGIN: SITE, DB, ANTHROPIC_API_KEY: KEY };
  await ask(handleTess, env, { question: "how do I get inside", about: "factory" });
  assert.equal(stub.calls[0].params.messages[0].content, "(They were last asking about Lightning Factory.)\nhow do I get inside");
  await ask(handleTess, env, { question: "how do I get inside", about: "the moon" });
  assert.equal(stub.calls[1].params.messages[0].content, "how do I get inside");
  assert.deepEqual(kept(DB).map((row) => row.about).sort(), ["", "factory"]);
});

test("an answer is checked for shape only: a place off the list is dropped, and a refusal, a malformed or an overlong one is not kept", async () => {
  const stub = claude(message({ say: "To the moon!", go: "moon" }), message({ say: "", go: null }, "refusal"), message("{\"say\": "),
    message({ say: "Ooga ".repeat(150), go: null }), message({ say: "One.\n\n Two. \nThree.\nFour.\nFive.", go: null }));
  const { handleTess } = routeFixture({ anthropic: stub.Anthropic }), DB = d1(), env = { SITE_ORIGIN: SITE, DB, ANTHROPIC_API_KEY: KEY };
  assert.deepEqual(await (await ask(handleTess, env, { question: "take me to the moon" })).json(), { say: "To the moon!", go: null });
  for (const question of ["refuse this", "break this", "ramble on"]) {
    const res = await ask(handleTess, env, { question });
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { error: "refused" });
  }
  assert.deepEqual(await (await ask(handleTess, env, { question: "count to five" })).json(), { say: "One.\nTwo.\nThree.\nFour.", go: null });
  assert.deepEqual(kept(DB).map((row) => row.question), ["count to five", "take me to the moon"]);
  // Every call Claude answered is paid for, kept or not.
  assert.equal(spend(DB).calls, 5);
});

test("a day's spend stops at its cap, while answers she kept still come", async () => {
  const stub = claude(message({ say: "Bananas!", go: "pile" }));
  const { handleTess } = routeFixture({ anthropic: stub.Anthropic }), DB = d1();
  const env = { SITE_ORIGIN: SITE, DB, ANTHROPIC_API_KEY: KEY, TESS_DAILY_CENTS: "1" };
  assert.equal((await ask(handleTess, env, { question: "where is the pile" })).status, 200);
  DB.sql.prepare("UPDATE tess_spend SET micro_usd = 10000").run();
  const resting = await ask(handleTess, env, { question: "what is a block" });
  assert.equal(resting.status, 429);
  assert.deepEqual(await resting.json(), { error: "resting" });
  assert.deepEqual(await (await ask(handleTess, env, { question: "Where is the pile?" })).json(), { say: "Bananas!", go: "pile" });
  assert.equal(stub.calls.length, 1);
});

test("a question is one short line of text, in a small body", async () => {
  const { handleTess } = routeFixture(), env = { SITE_ORIGIN: SITE, DB: d1(), ANTHROPIC_API_KEY: KEY };
  for (const body of [{ question: "x".repeat(201) }, { question: "?!…" }, { question: 42 }, {}, null, "{nope"]) {
    assert.equal((await ask(handleTess, env, body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await ask(handleTess, env, { question: "hi", pad: "x".repeat(1100) })).status, 413);
});

test("questions are limited by the asker's address, which is not kept", async () => {
  const keys = [], TESS_LIMITER = { limit: async ({ key }) => { keys.push(key); return { success: false }; } };
  const { handleTess } = routeFixture(), DB = d1();
  const res = await ask(handleTess, { SITE_ORIGIN: SITE, DB, ANTHROPIC_API_KEY: KEY, TESS_LIMITER }, { question: "what is lightning" });
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: "busy" });
  assert.deepEqual(keys, ["203.0.113.7"]);
  assert.deepEqual(DB.sql.prepare("SELECT name FROM pragma_table_info('tess_answers')").all().map((c) => c.name),
    ["version", "question", "about", "say", "go", "asked", "first_day", "last_day"]);
});

test("Claude failing leaves her own line to the page and costs nothing", async () => {
  const stub = claude(Object.assign(new Error("overloaded"), { status: 529 }));
  const { handleTess } = routeFixture({ anthropic: stub.Anthropic }), DB = d1(), env = { SITE_ORIGIN: SITE, DB, ANTHROPIC_API_KEY: KEY };
  const errors = [], log = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    const res = await ask(handleTess, env, { question: "what is lightning" });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: "unavailable" });
  } finally { console.error = log; }
  assert.deepEqual(errors, ["tess: Claude failed 529 overloaded"]);
  assert.equal(spend(DB), undefined);
});

test("the daily prune drops questions not asked for 90 days, and the Worker routes /api/tess to her", async () => {
  const { pruneTess, worker } = routeFixture(), DB = d1(), now = Date.parse("2026-10-22T04:00:00Z");
  const row = DB.sql.prepare("INSERT INTO tess_answers VALUES ('v', ?, '', 'Hi!', NULL, 1, ?, ?)");
  row.run("old", "2026-07-01", "2026-07-23");
  row.run("recent", "2026-07-01", "2026-07-24");
  DB.sql.prepare("INSERT INTO tess_spend VALUES ('2026-07-01', 5, 1), ('2026-10-21', 7, 1)").run();
  await pruneTess(DB, now);
  assert.deepEqual(kept(DB).map((r) => r.question), ["recent"]);
  assert.deepEqual(DB.sql.prepare("SELECT day FROM tess_spend").all().map((r) => r.day), ["2026-10-21"]);
  const res = await worker.fetch(new Request(`${SITE}/api/tess`, { method: "POST", headers: { origin: SITE }, body: "{}" }), { SITE_ORIGIN: SITE, DB });
  assert.deepEqual(await res.json(), { error: "closed" });
});

test("both Workers limit questions to Tess", () => {
  for (const name of ["staging", "production"]) {
    const config = JSON.parse(readFileSync(new URL(`../../wrangler.${name}.jsonc`, import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, ""));
    assert.deepEqual(config.ratelimits.find((r) => r.name === "TESS_LIMITER").simple, { limit: 5, period: 60 }, name);
  }
});
