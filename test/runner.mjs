import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(`${process.env.RENOVATE_DIST ?? '/usr/local/renovate/dist'}/renovate.js`);
const { parse } = require('yaml');
const workflow = parse(await readFile(new URL('../.github/workflows/renovate.yml', import.meta.url), 'utf8'));
assert.equal(workflow.on.workflow_dispatch.inputs.dry_run.default, true);
assert.ok(workflow.on.schedule.length);
assert.ok(Object.values(workflow.permissions).every(value => value === 'read'));
const job = workflow.jobs.renovate;
const targets = job.strategy.matrix.repository;
assert.equal(new Set(targets).size, targets.length);
for (const target of ['dotfiles', 'containers', 'beelink', 'renovate-config']) {
  assert.ok(targets.includes(target));
}
assert.equal(job.strategy['fail-fast'], false);
assert.ok(job.if.includes("vars.RENOVATE_APP_ID != ''"));
assert.equal(job.env.RENOVATE_TOKEN, undefined);
assert.equal(job.env.RENOVATE_REQUIRE_CONFIG, 'required');
assert.equal(job.env.RENOVATE_REPOSITORY, '${{ github.repository_owner }}/${{ matrix.repository }}');
const token = job.steps.find(step => step.id === 'app-token');
const dry = job.steps.find(step => step.env?.RENOVATE_DRY_RUN);
const live = job.steps.find(step => step.env?.RENOVATE_TOKEN?.includes('app-token.outputs.token'));
assert.equal(token.with.owner, '${{ github.repository_owner }}');
assert.equal(token.with.repositories, '${{ matrix.repository }}');
assert.equal(token.with['permission-workflows'], 'write');
assert.equal(live.if, "github.event_name == 'schedule' || !inputs.dry_run");
assert.equal(token.if, live.if);
assert.equal(dry.if, "github.event_name == 'workflow_dispatch' && inputs.dry_run");
assert.equal(dry.env.RENOVATE_TOKEN, '${{ github.token }}');
assert.equal(dry.env.RENOVATE_DRY_RUN, 'full');
assert.equal(live.env.RENOVATE_DRY_RUN, undefined);
assert.equal(dry.run, 'renovate "$RENOVATE_REPOSITORY"');
assert.equal(live.run, dry.run);
console.log('Runner passed: explicit targets, scoped App tokens, read-only dry runs.');
