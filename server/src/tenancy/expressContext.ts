import { currentTenantOrNull, runWithTenant } from "../vendor/nga-tenancy";

/**
 * Keeps the tenant context across Express middleware.
 *
 * The auth middleware calls next() inside runWithTenant(), so everything that
 * runs synchronously or on promises after it inherits the tenant. But some
 * middleware resumes the chain from an event emitted by the request stream
 * (multer/busboy finishing a multipart upload, body parsers mounted after
 * auth): those events run in the socket's async context, which has no
 * tenant, and the handler would query tenant 1 (shadow) or throw (enforce).
 *
 * Every Express layer therefore re-enters `req.tenant` (set by the auth
 * middleware via enterTenant) when the current context lost it.
 */

let patched = false;

export function installExpressTenantContext(): void {
  if (patched) return;
  patched = true;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Layer = require("express/lib/router/layer");
  const handleRequest = Layer.prototype.handle_request;
  const handleError = Layer.prototype.handle_error;

  const reenter = (req: any, run: () => void) => {
    const tenant = req?.tenant;
    if (tenant && currentTenantOrNull()?.tid !== tenant.tid) return runWithTenant(tenant, run);
    return run();
  };

  Layer.prototype.handle_request = function (this: any, req: any, res: any, next: any) {
    return reenter(req, () => handleRequest.call(this, req, res, next));
  };
  Layer.prototype.handle_error = function (this: any, error: any, req: any, res: any, next: any) {
    return reenter(req, () => handleError.call(this, error, req, res, next));
  };
}

installExpressTenantContext();
