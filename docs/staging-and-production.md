# Staging and production

## Immediate assistant withdrawal

The homepage no longer mounts the assistant. All `/api/assistant` requests
return 503 before any assistant handlers can call AI, upload flyers, or save
submissions. The implementation remains in source for later cleanup.
This takes effect on the live site only after republishing.

## Environment boundaries

- Production: the existing project publishes centralgroupevents.com.
- Development: workspace preview is for local iteration, not release approval.
- Staging: create a separate Replit project by remixing/copying the app.
  Publish it to its own address, not the production custom domain.
  This step has not been provisioned by the code changes in this document.

Before running staging:

1. Confirm it has its own database. Never supply production DATABASE_URL or
   PRODUCTION_DATABASE_URL. Use synthetic test records, not customer data.
2. Audit copied secrets before starting the app. Remove production mail,
   integration, cron, and other service credentials; use separate test accounts
   and tokens. Do not let staging send customer email or invoke real partners.
3. Use separate session credentials and storage/upload resources. Configure the
   staging public-site URL separately so test links do not point at production.
4. Restrict staging access through publishing privacy settings where available.
5. Re-enable the assistant only in the staging project's code while testing.
   Do not re-enable it on the production release branch until approved.

## Release process

Keep production on a release branch and staging work on a separate branch.
Promote only reviewed changes, not the entire unfinished workspace.

1. Test a specific commit on staging, including booking, email, integration,
   and assistant behavior as relevant.
2. Run type checks, production build, and targeted regression tests.
3. Review database changes separately; do not push test records to production.
4. Merge only approved changes into the production release branch.
5. Verify the production workspace contains only the intended release.
6. The owner publishes, then checks live event browsing and booking.

A successful local build alone is not staging approval. Do not publish
unrelated unfinished features alongside an urgent production fix.
