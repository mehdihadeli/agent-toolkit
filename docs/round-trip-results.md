# Round-Trip Validation

Round-trip validation checks that a plugin remains usable after packaging metadata is read by each supported host.

## Current checks

1. Run `python tools/validate_repository.py` to parse manifests, check marketplace paths, validate skills, and detect dead local Markdown links.
2. Run `vally lint .` for skill and evaluation structure.
3. Run `dotnet test --solution agent-toolkit.slnx` for .NET plugins and tests.

## Results record

Record validation with:

- date and commit;
- host or command tested;
- plugin and version;
- expected discovery or runtime behavior;
- result and failure details;
- follow-up issue, if any.

Do not claim a host round trip was verified when only JSON parsing or local build validation was performed.
