---
name: editorial-qa
description: Use this skill when reviewing a technical article for depth, correctness, architecture quality, technical credibility, and publication readiness.
---

# Editorial QA

Review the article like a principal engineer reviewing a design memo that will be published externally.

## Check For

- Weak thesis or generic framing
- Missing trade-offs or missing alternatives
- Hand-wavy AI claims without evaluation or failure analysis
- Missing operational detail: deployment, observability, cost, security, scale
- Architecture sections that describe components but not responsibilities or boundaries
- Code examples that do not clearly serve the thesis
- Conclusions that do not help a practitioner make a decision

## Outcome

- List the highest-severity quality gaps first.
- Recommend concrete rewrites.
- Flag what still needs verification before publication.
