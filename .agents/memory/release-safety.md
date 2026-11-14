---
name: Release safety
description: Assistant withdrawal and isolated staging requirement.
---
The user says the CGE assistant was published before it was production-ready.
Keep it withdrawn from public use until cleanup and approval. Preserve its code.

**Why:** The user requested temporary removal and separate staging and production
so tests and unfinished work do not affect the next production release.

**How to apply:** Test unfinished work in an isolated staging project with separate
data and credentials. Promote only approved changes, not the entire work in progress.
