---
name: Assistant provider decision
description: Approved Claude model and provider restriction for event discovery.
---
The event discovery assistant must use Claude, not Gemini. The user approved `claude-haiku-4-5-20251001` in place of the requested retired Haiku 3.5 model.

**Why:** The user explicitly approved the replacement after being informed of the original model's retirement.

**How to apply:** Use this decision for the event assistant; do not change the existing flyer-extraction provider as part of this decision.

The user approved CGE-catalog-only discovery with related-activity searches instead of an external Eventbrite fallback. Do not add Posh scraping or another external feed without approval.

**Why:** External discovery access and Posh scraping permission could not be established; the user chose to proceed with the CGE catalog.
