# Versioning with NBGV

Agent Toolkit uses [Nerdbank.GitVersioning (NBGV)](https://dotnet.github.io/Nerdbank.GitVersioning/)
to calculate repository release versions from `version.json` and Git history.
Release Drafter writes release notes; it does not choose the release version.

## Release contract

- `main` is the long-lived development branch.
- Preview versions use `MAJOR.MINOR.PATCH-preview.{height}`.
- RC versions use `MAJOR.MINOR.PATCH-rc.{height}`.
- Stable versions use `MAJOR.MINOR.PATCH`.
- Preview and RC CI versions append the UTC year/day-of-year and workflow run number.
- RC and stable tags identify the exact approved commit.

The repository release version does not automatically change plugin manifest
versions, marketplace registrations, or .NET assembly versions. Each plugin
remains an independent release boundary. When changing a plugin version, keep
its host manifests and marketplace registrations aligned.

## Configuration

The root [version.json](../version.json) defines the release line:

```json
{
  "$schema": "https://raw.githubusercontent.com/dotnet/Nerdbank.GitVersioning/main/src/NerdBank.GitVersioning/version.schema.json",
  "version": "1.0.0-preview.{height}",
  "publicReleaseRefSpec": [
    "^refs/heads/main$",
    "^refs/tags/v\\d+\\.\\d+\\.\\d+(?:-rc\\.\\d+)?$"
  ]
}
```

The local tool manifest pins NBGV 3.10.94. From the repository root:

```bash
dotnet tool restore
dotnet nbgv get-version -v SemVer2
```

Public release refs prevent the topic-branch commit suffix on `main` and valid
RC or stable tags. CI checks out the complete Git history before calculation
because NBGV derives height from that history.

## Version shapes

| Source ref | Calculated release version | Environment output | Release Drafter action |
| --- | --- | --- | --- |
| `main`, preview height `0` | `1.0.0-preview.0` | `none` | No release |
| `main`, preview height `1+` | `1.0.0-preview.N.YYDDD.RUN_NUMBER` | `dev` | Draft prerelease |
| `v1.0.0-rc.1` | `1.0.0-rc.1.YYDDD.RUN_NUMBER` | `staging` | Draft prerelease |
| `v1.0.0` | `1.0.0` | `production` | Published stable release |
| `main`, RC or stable version | NBGV version unchanged | `none` | Validation only; tag required |

`YYDDD` is the UTC two-digit year and day of year. `RUN_NUMBER` is
`GITHUB_RUN_NUMBER`. These suffixes distinguish workflow runs without replacing
the NBGV height. The environment output is a classification, not a configured
GitHub deployment environment.

Tagged releases retain the original Git tag even when the RC release name has
a CI suffix. Preview drafts use `v` followed by the calculated CI version as
their proposed tag. Draft releases do not create tags until published.

## Release commands

Run helpers from the repository root. Start a preview train:

```bash
bash ./scripts/release-version.sh prepare-train 1.1.0
git add version.json
git commit -m "chore: start 1.1.0 preview train"
```

The helper writes `1.1.0-preview.{height}` and removes old bootstrap height
offsets. Ordinary changes do not edit `version.json`; accepted commits advance
the preview height.

Prepare RC or stable release intent through a reviewed pull request. Choose
one command for the desired stage:

```bash
bash ./scripts/release-version.sh prepare-rc 1.1.0
bash ./scripts/release-version.sh prepare-stable 1.1.0
```

Commit and merge that change before tagging. On the approved merged commit:

```bash
dotnet tool restore
dotnet nbgv get-version -v SemVer2
dotnet test --solution agent-toolkit.slnx --configuration Release
bash ./scripts/release-version.sh tag
git push origin <tag-created-by-nbgv>
```

`nbgv tag` tags the calculated version; it does not edit `version.json`.
The helper never commits or pushes automatically.

## CI calculation and releases

[scripts/calculate-version.sh](../scripts/calculate-version.sh) is the single
CI calculation path. It emits `version`, `assembly_version`,
`informational_version`, `environment`, `docker_tag`, and `commit` through
`GITHUB_OUTPUT`. Informational versions append the short commit as build
metadata. The Docker tag output is available for future consumers; this
workflow does not publish container images.

The calculator rejects unsupported refs and release tags that do not match
the NBGV version of their commit. For example, a commit calculated as
`1.1.0-rc.1` cannot publish under `v1.1.0-rc.2`.

[Build-Test-Publish](../.github/workflows/build-and-publish.yml) builds and tests
the .NET solution on pull requests, pushes to `main`, and `v*` tags. Manual runs
also validate the selected ref. Calculation runs only for `main` or `v*` tags
after tests pass. Bootstrap previews and untagged RC/stable commits do not
update releases.

For eligible versions, the workflow calls Release Drafter v7 with explicit
`version`, `name`, `tag`, and the triggering commit SHA. Only stable tags publish
immediately; preview and RC notes remain drafts. Release Drafter uses
[.github/release-drafter.yml](../.github/release-drafter.yml) to group merged
pull requests. The separate [labeler workflow](../.github/workflows/labeler.yml)
applies labels from conventional pull request titles and branch names.

The release job uses `GITHUB_TOKEN` with `contents: write` and
`pull-requests: read`. No NuGet secret is needed: this workflow publishes
GitHub release notes only, not NuGet packages, custom archives, or binaries.
GitHub supplies its standard source archives for published tags. Existing
evaluation, harness, and documentation workflows remain separate.

## Local validation

```bash
bash -n scripts/calculate-version.sh scripts/release-version.sh
python -m unittest discover -s tests/versioning -p 'test_*.py'
node --test tests/docs-website/documents.test.mjs
python tools/validate_repository.py
```

The calculator tests use a mock NBGV executable and never create tags or releases.
