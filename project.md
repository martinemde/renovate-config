---
name: renovate-config
repo: https://github.com/martinemde/renovate-config
status: active
runtime: renovate-node-docker
updated: 2026-11-07
---

# Shared Renovate policy and runner

Central GitHub App runner and reusable policy for martinemde repositories. `default.json` is the published
preset; repository-specific discovery and exceptions stay with each consumer.
See README.md for adoption, limitations, required repository protection, and
validation. Release tags are protected against updates and deletion; the `policy`
check is required on main.
