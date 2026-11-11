# Spike S-2: Sequelize routing per tenant database

**Decision: option (a)**, one Sequelize instance; an `afterPoolAcquire` hook issues `USE \`<tenant db>\`` when the pooled connection points elsewhere (`server/src/tenancy/dbRouter.ts`). Test: `server/src/tests/tenancyRouter.integration.spec.ts`.

## Why not (b), one Sequelize instance per tenant
sequelize-typescript binds each model class to one instance (static `sequelize` on the class). A second `addModels()` rebinds the classes instead of copying them. Per-tenant instances would therefore need a model factory and a per-request lookup at ~1,000 ORM call sites in 106 files.

## What (a) needed beyond `USE`
1. **Prepared statements.** mysql2 caches them per connection, and bound queries (`INSERT ... VALUES (?)`) use `execute()`. A statement resolves its tables when it is prepared, so after `USE` it kept writing to the previous tenant's database. The spike's first run showed exactly this: tenant 2's INSERTs landed in tenant 1. The hook now clears the connection's statement LRU (each statement is closed) before every switch.
2. **`sequelize.config.database`.** It is now a getter that returns the current tenant's database. Sequelize reads it for INFORMATION_SCHEMA lookups (`Model.sync`'s `tableExists`, `showAllTables`, FK reflection). Without the getter, a sync in tenant 2 saw tenant 1's tables and created nothing.
3. **Failure handling.** When the hook throws (no context under enforce, or the database is missing), it releases the connection first, so the pool does not leak.

## Verified on MySQL 5.7 (MAMP :8889)
- Tenant isolation holds under 30 interleaved queries over the 5-connection pool.
- Includes (joins) stay inside the tenant.
- A transaction pinned to tenant 2 survives tenant-1 traffic in the middle of it, and a rollback leaves the data untouched.
- `TENANCY_MODE=enforce` throws `TenantContextMissing`, and the pool is still usable afterwards.
- Shadow mode falls back to tenant 1.
- A missing tenant database gives `TenantDatabaseUnavailable` without leaking connections.

## Caveats
- A raw `USE` from application code would break the per-connection tracking. The DB console blocks `USE` and is read-only, and nothing else issues one.
- The DB console also refuses anything outside the current school's database (server/src/services/dbConsoleGuard.ts): database-qualified names other than the current DB, information_schema / mysql / performance_schema / sys, SHOW DATABASES and SHOW … FROM <db>, and `/*! */` executable comments. Recommended in production on top of that: run the console as a dedicated MySQL user granted only `SELECT, SHOW VIEW` on that school's database (DB_NAME for the primary school, `<DB_NAME>_t<tid>` for others), since the app's pool user reaches every school's database.
- Context can be lost across event-emitter resumption (multer/busboy). Express layers re-enter `req.tenant` (`tenancy/expressContext.ts`).
