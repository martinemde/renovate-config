# Renovate config

Shared dependency-update policy and central GitHub App runner for Martin's
repositories. Repository-specific managers, file patterns, grouping, and
compatibility exceptions belong in the consuming repository.

See [repository responsibilities and audit](docs/repository-responsibilities.md)
for update ownership, required checks, and remaining gaps.

## Runner

`.github/workflows/renovate.yml` runs at minutes 7 and 37 of every hour UTC.
Its explicit matrix targets dotfiles, martinemde.com, micropub-publisher,
almanac, containers, beelink, renovate-config, homeassistant, dohm-ble, and unifi. Each job reads the target's
own config and gets an App token scoped to that repository. Failed jobs do not
stop other repositories. There is no autodiscovery or global automerge override.
`default.json` remains the published preset; `renovate.json` configures updates
to this repository's runner and CI, with automerge disabled.

Containers pin PRs trigger build/smoke checks; merging affected recipes into main
triggers publication. Beelink tracks allowlisted consumer Quadlet image pins.
Both remain review-only. Renovate does not deploy or restart services. NUI source
version PRs still require reviewed revision/checksum updates before they build.

### Move the existing App runner from dotfiles

Keep the same GitHub App and its permissions. Its account-wide installation
already covers the targets; tokens remain restricted to one target per job.
Do not enable the hosted Mend writer alongside this runner.

1. Publish the dispatch-only, read-only replacement for the dotfiles Renovate
   workflow. Disable its old scheduled workflow during cutover and wait for any
   in-flight live run to finish. Do this before enabling this runner.
2. Store `RENOVATE_APP_PRIVATE_KEY` as an Actions secret in **renovate-config**.
   GitHub cannot read or transfer an existing Actions secret. Upload the original
   PEM securely with `gh secret set RENOVATE_APP_PRIVATE_KEY -R martinemde/renovate-config < /secure/path/app.pem`.
   If the original is unavailable, generate a new key for the same App in GitHub
   settings. Never commit a key or print it in logs.
3. Set Actions variable `RENOVATE_APP_ID` to the existing App ID/client ID
   (currently `Iv23libaqaPV53cngKCW`), not the installation ID. Set it last:
   scheduled jobs skip while it is absent. No credential is copied by this code
   change.
4. Dispatch **Renovate** here with `dry_run: true` first. With App credentials
   configured, this gets a read-only App token per target (including private
   beelink). Without an App ID it falls back to `GITHUB_TOKEN` for public targets;
   that token cannot read other private repositories. Dry runs write no branches,
   PRs, or dashboards.
   Then dispatch with `dry_run: false` and verify each target's job plus an
   App-authored dashboard or PR. A dry run is not proof of live activation.
5. Once the central live run succeeds, remove the old App ID variable and private
   key secret from dotfiles. Revoke a replaced key only after successful cutover.

The App permissions are contents, pull requests, issues, workflows and commit
statuses read/write; administration, checks and vulnerability alerts read.
The workflow's own `GITHUB_TOKEN` stays read-only. App-authored dependency PRs
can trigger target CI; `GITHUB_TOKEN`-authored writes would not. Missing live
credentials fail manual live dispatch explicitly. Migration is not complete
until the old writer is stopped and a central live run succeeds.


## Adopt

Add `renovate.json` using a reviewed release:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>martinemde/renovate-config#v1.0.0"],
  "packageRules": [
    { "matchManagers": ["renovate-config"], "automerge": false }
  ]
}
```

Pin a reviewed release, not `main`. This repository protects `v*` release tags
against updates and deletion with a no-bypass GitHub ruleset. A tag is not
immutable by naming convention alone; repository administrators can change rules.
For stronger content-addressed pinning, use the release commit SHA instead.
Review preset version changes like code changes. If you restrict `enabledManagers`,
include `renovate-config` so Renovate can propose preset updates. Keep repository `packageRules`
after inherited rules; for example, a final file-matching `automerge: false` rule
keeps untested terminal plugins review-only.

## Policy

- Recommended Renovate defaults, semantic commits, dependency dashboard, and
  `deps` / `automated` labels.
- Two PRs per hour and five concurrent PRs for ordinary updates.
- Seven-day minimum release age. Missing release timestamps fail closed;
  strict internal checks hold those updates pending rather than admitting them.
- Squash PR automerge for minor, patch, and digest updates only. Major updates
  explicitly disable automerge. Pin/pinDigest updates remain review-only.
- Renovate performs the merge (`platformAutomerge: false`).
- Pin GitHub Action references and Docker images to digests.
- GitHub vulnerability alerts and OSV alerts are enabled. Security updates bypass
  release aging but require review, even when the fix is minor, patch, or digest.
  Renovate's security-update exceptions to scheduling and PR limits still apply.

## Repository checks are separate

This preset cannot create GitHub protection rules, install an App, supply tokens,
or prove that tests cover an update. Each consumer must separately configure:

1. Required CI checks in a branch ruleset/protection rule, covering the affected
   dependency's behavior. Do not use an empty check list as a substitute for tests.
2. Squash merging and appropriately scoped Renovate credentials. Restrict bypass
   privileges so the bot cannot skip the required checks.
3. Vulnerability alerts and supported lockfiles/ecosystems. Enable GitHub's
   dependency graph and grant the bot permission to read vulnerability alerts.

A seven-day delay and a digest pin do not establish package trust, provenance,
or freedom from malware. OSV and GitHub advisory coverage is incomplete; an
update not identified as vulnerable follows the ordinary automerge policy.
Local configuration can override this preset, including its safety settings.
Require review for changes to Renovate config, workflows, and release tags.

## Validate

CI and the following commands use the deployed Renovate engine, not a JSON-only
reimplementation. The behavioral test resolves built-in presets and exercises
Renovate's real update flattening, package rules, OSV rule generation, and release
age filtering. It makes no GitHub or registry requests.

```sh
image='ghcr.io/renovatebot/renovate:44.216.5@sha256:029cf58d0213a20ed3f5e2c86f6261f29e73675b7e1b86659de096e0d3408051'
docker run --rm --network none -v "$PWD:/repo:ro" -w /repo "$image" renovate-config-validator --no-global default.json
docker run --rm --network none -v "$PWD:/repo:ro" -w /repo --entrypoint node "$image" test/policy.mjs
docker run --rm --network none -v "$PWD:/repo:ro" -w /repo --entrypoint node "$image" test/runner.mjs
```

The behavioral test intentionally uses internal APIs tied to the image version.
When upgrading Renovate, review those APIs and rerun both checks before changing
the pinned image. The stable required check for this repository is `policy`.
