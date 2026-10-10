import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "yaml";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const lab = parse(read("compose.lab.yml"));

test("lab uses a dedicated project, volume and loopback API port; no public Docker socket", () => {
  assert.equal(lab.name, "landing-page-lab");
  assert.deepEqual(Object.keys(lab.services).sort(), ["api", "db", "migrate"]);
  assert.deepEqual(lab.services.api.ports, ["127.0.0.1:3117:3001"]);
  assert.equal(lab.services.db.ports, undefined);
  assert.deepEqual(lab.services.db.volumes, ["data:/var/lib/postgresql/data"]);
  assert.equal(lab.volumes.data.external, undefined);
  assert.equal(lab.networks, undefined);
  for (const service of Object.values(lab.services)) {
    assert.equal(service.labels["landing-page.reliability-lab"], "true");
    assert.equal(service.restart, "no");
    assert.equal(service.privileged, undefined);
    assert.equal(service.network_mode, undefined);
    assert.doesNotMatch(JSON.stringify(service), /docker\.sock|landing-page-prod|reaction_e2e/);
  }
});

test("normal HTML and production stack do not opt in to lab controls", () => {
  assert.doesNotMatch(read("frontend/index.html"), /reliability-lab/);
  assert.doesNotMatch(read("compose.prod.yml"), /lab-controller|compose\.lab|docker\.sock/);
  assert.doesNotMatch(read("my-backend/cmd/api/main.go"), /reliabilitylab/);
});

test("lab commands fix project/file/env and never remove volumes or reset data", () => {
  const tasks = parse(read("Taskfile.yml")).tasks;
  for (const name of ["lab:setup", "lab:status", "lab:stop"]) {
    for (const cmd of tasks[name].cmds.filter((value) => typeof value === "string")) {
      assert.match(
        cmd,
        /^docker compose --env-file deploy\/lab\/compose.env -p landing-page-lab -f compose.lab.yml /,
      );
      assert.doesNotMatch(cmd, /--no-build|down|--volumes|reset/);
    }
  }
  assert.equal(tasks["lab:setup"].env.VITE_API_URL, "/api");
});
