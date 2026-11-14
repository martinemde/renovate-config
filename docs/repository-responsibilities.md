# Renovate repository responsibilities

Audited 2026-11-14 against repository configs and GitHub main-branch rules.

The runner lives only in `martinemde/renovate-config`. The workflow matrix is the
source of truth for enrollment; this document explains responsibility, not a
second runner configuration. Per-repository rules override the shared preset.

| Repository | Responsibility / current policy | Main required checks observed |
| --- | --- | --- |
| renovate-config | Shared versioned policy, central App runner, its own action/image updates | policy |
| dotfiles | Personal tool, plugin, runtime and dotfile dependency pins | Nine integrity/unit/integration checks |
| martinemde.com | Blog dependencies/tooling; local recommended preset, manual merge | None (deletion/force-push protection only) |
| micropub-publisher | App dependencies/tooling; local recommended preset, manual merge | conformance; Unit tests; Lint and type checks |
| almanac | Targeted but **skipped**: no Renovate config on main; no GitHub CI | None |
| containers | Build-input pins, source-version proposals and GitHub Actions; merge rebuilds/publishes | None |
| beelink | Allowlisted deployed/candidate Quadlet image references, not host-wide package management | None |
| homeassistant | Python/test and integration pins, mise and add-on bases; manual merge, no deployment or flashing | Not audited |
| dohm-ble | Python/test and HACS runtime dependencies, CI actions; manual merge, no BLE operations | Not audited |
| unifi | Provider constraints/lockfiles and mise tools; manual merge, no infrastructure apply | Not audited |

## Publication is not deployment

Containers owns base-image recipe updates and publication. Beelink owns consumer
pin proposals. Those are separate PRs: rebuilding an image does not advance an
immutable consumer digest. Rethink's CI-verified-main publication/controller flow
is separate; do not add a redundant source-pin/deployment bot. Legacy local-only
image IDs cannot be discovered as registry packages. Do not broaden the Quadlet
allowlist without reviewing the affected service's update/maintenance contract.

Containers is review-only. The local audit patch makes beelink fully review-only
(actions otherwise inherited automerge); publish that patch before treating all
beelink proposals as manual merge. NUI version proposals need coordinated
source commit, checksum and possibly lock-overlay review; a version-only PR is
not expected to build. No workflow here authorizes runtime migration or restart.

## Local consumer improvements prepared

Validated with the central pinned Renovate engine, not yet pushed:

- Beelink: enable shared-preset updates, disable automerge for every manager,
  and exclude the controller-owned Rethink digest from Renovate discovery.
- Containers: explain the NUI revision/checksum/overlay review checklist in its
  version-update PR body. Existing integrity checks remain unchanged.

GHCR Docker releases lack timestamps in the inspected Renovate datasource;
strict timestamp-required aging can suppress proposals forever, including NUI
consumer digest updates. This audit does **not** weaken that policy. Decide
whether to allow a narrow manually reviewed no-timestamp exception or supply an
independent publication-age check. Waiting seven days does not create a missing
timestamp.

## Consumer gaps

- Blog and micropub duplicate the baseline rather than use the shared owner
  preset. Both explicitly disable automerge. Consolidation must preserve that
  override and the blog's `typescript <7` compatibility rule. Do not change their
  merge policy merely by adopting the shared preset.
- Blog's required-CI ruleset is disabled and names stale contexts. Its actual
  jobs are `check` and `test`; CI has no build. Add a build and fix contexts
  before enabling enforcement. Micropub already requires its actual checks and
  builds in conformance; let Renovate propose outstanding action digest pins.
- Almanac needs a repo config and Rust CI before it is an effective consumer.
  The runner uses `requireConfig=required` with onboarding disabled, so its
  current green dry-run job is a skip, not evidence of update coverage. Keep
  automerge off when onboarding. Its application can assist Renovate PRs but
  does not replace dependency discovery.
- Containers/beelink have no enforced main checks, but remain manual merge.
  Add required existing container smoke checks before considering automerge;
  beelink needs meaningful static validation plus separate runtime acceptance.

## Improvements and outstanding checks

- Retired dotfiles scheduling/live writes; centralized one writer and App secrets.
- Added containers, beelink and the runner itself to the central explicit targets.
- Dry runs use single-target **read-only** App tokens so private beelink can be
  inspected; public-only fallback without an App ID uses GITHUB_TOKEN.
- Central policy/runner tests pass locally; initial central GitHub policy CI passed.
- GitHub branch protection does not itself prove test quality. Review-only repos
  with no required checks can still be manually merged without successful CI.
- Audit automerge eligibility alongside effective required checks before enabling
  additional automatic merges. Required checks and preset policy are independent.
- App credentials being present is not live activation evidence. Verify a central
  live job and an App-authored dashboard/PR. Never run the hosted Mend writer or
  the old dotfiles live workflow alongside the central writer.
