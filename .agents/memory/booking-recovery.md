---
name: Booking recovery privacy and retries
description: Privacy and conservative submission recovery decisions for unfinished bookings
---
Keep contact details out of booking recovery storage; require re-entry and fresh terms acceptance after refresh, while preserving the newsletter choice.

**Why:** Resume convenience should not leave personal contact information on shared devices. Newsletter refusal must not silently revert to consent.

**How to apply:** Extend recovery through an explicit non-contact field allowlist, not by serializing the whole form or AI extraction state.

Do not automatically retry an unconfirmed booking submission.

**Why:** The booking endpoint does not provide durable idempotency. A lost response can mean the booking was created even though the browser cannot confirm it.

**How to apply:** Keep a tab-level attempt guard before sending, and direct ambiguous outcomes to support. If browser storage is unavailable, let visitors explicitly approve a one-time submission after warning that refresh protection is unavailable; do not block booking entirely. Automated retries need server-side idempotency first.
