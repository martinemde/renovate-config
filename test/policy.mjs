import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// These internal APIs are intentionally tied to the CI image version. No registry
// or GitHub calls: real preset resolution, merge, update flattening and age checks.
const engine = process.env.RENOVATE_DIST ?? '/usr/local/renovate/dist';
const load = (path) => import(`${engine}/${path}.js`);
const { getConfig } = await load('config/defaults');
const { mergeChildConfig } = await load('config/utils');
const { resolveConfigPresets } = await load('config/presets/index');
const { flattenUpdates } = await load('workers/repository/updates/flatten');
const { applyPackageRules } = await load('util/package-rules/index');
const { filterInternalChecks } = await load('workers/repository/process/lookup/filter-checks');
const { get: getVersioning } = await load('modules/versioning/index');
const { Vulnerabilities } = await load('workers/repository/process/vulnerabilities');

const preset = JSON.parse(await readFile(new URL('../default.json', import.meta.url)));
const { config: resolved } = await resolveConfigPresets(preset);
const config = mergeChildConfig(getConfig(), resolved);
assert.equal(config.prHourlyLimit, 2);
assert.equal(config.prConcurrentLimit, 5);

async function update(overrides = {}, local = {}, packageFile = 'package.json') {
  const effective = mergeChildConfig(config, local);
  const [result] = await flattenUpdates(effective, {
    npm: [{ packageFile, deps: [{
      depName: 'example', packageName: 'example', datasource: 'npm',
      currentValue: '1.0.0', currentVersion: '1.0.0',
      updates: [{ updateType: 'minor', newValue: '1.1.0', newVersion: '1.1.0', ...overrides }],
    }] }],
  });
  assert.ok(result);
  return result;
}
for (const updateType of ['minor', 'patch', 'digest']) {
  const effective = await update({ updateType });
  assert.equal(effective.automerge, true, updateType);
  assert.equal(effective.automergeType, 'pr');
  assert.equal(effective.automergeStrategy, 'squash');
  assert.equal(effective.platformAutomerge, false);
}
assert.equal((await update({ updateType: 'major', newVersion: '2.0.0' })).automerge, false);
assert.equal((await update({ updateType: 'pinDigest' })).automerge, false);
// Package rules are evaluated at multiple stages; an earlier enable must not leak.
assert.equal((await applyPackageRules({ ...config, automerge: true, updateType: 'major' })).automerge, false);
for (const updateType of ['minor', 'patch', 'digest', 'major']) {
  assert.equal((await update({ updateType, isVulnerabilityAlert: true, automerge: true })).automerge, false, `security ${updateType}`);
}
// Exercise the actual OSV rule generation (not a network/database lookup).
const securityRule = new Vulnerabilities(null).vulnerabilityToPackageRules({
  vulnerability: { id: 'GHSA-test-test-test', affected: [], references: [] },
  affected: {}, packageName: 'example', depVersion: '1.0.0',
  fixedVersion: '1.0.1', datasource: 'npm', packageFileConfig: config,
});
assert.ok(securityRule);
const security = await update({}, { packageRules: [securityRule] });
assert.equal(security.isVulnerabilityAlert, true);
assert.equal(security.automerge, false);
assert.equal(security.minimumReleaseAge, null);
assert.ok(security.addLabels.includes('security'));
// Repository rules append after shared rules, retaining review-only exceptions.
const terminalFile = 'home/.chezmoiexternals/zellij.externals.toml';
const terminal = await update({}, { packageRules: [{ matchFileNames: [terminalFile], automerge: false }] }, terminalFile);
assert.equal(terminal.automerge, false);
// Action references are pinned through Renovate's built-in helper.
const action = await applyPackageRules({ ...config, manager: 'github-actions', depType: 'action', depName: 'actions/checkout' });
assert.equal(action.pinDigests, true);
const docker = await applyPackageRules({ ...config, categories: ['docker'] });
assert.equal(docker.pinDigests, true);

// Run the actual strict release filter; both young and undated releases stay pending.
const ageConfig = { ...config, datasource: 'npm', packageName: 'example', depName: 'example', currentVersion: '1.0.0' };
for (const [releaseTimestamp, pending] of [
  [new Date(Date.now() - 8 * 86400000).toISOString(), false],
  [new Date(Date.now() - 6 * 86400000).toISOString(), true],
  [undefined, true],
]) {
  const result = await filterInternalChecks(ageConfig, getVersioning('npm'), 'minor', [{ version: '1.1.0', releaseTimestamp }]);
  assert.equal(result.pendingChecks, pending, `release timestamp ${releaseTimestamp}`);
}
console.log('Policy behavior passed: automerge, security, local overrides, pins, strict release age, PR limits.');
