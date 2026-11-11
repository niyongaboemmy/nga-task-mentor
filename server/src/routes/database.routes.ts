import { NextFunction, Request, Response, Router } from "express";
import { requireAi } from "../middleware/requireAi";
import {
  listTables,
  getTableStructure,
  getTableData,
  runQuery,
  getQueryHistory,
  exportTable,
  getServerStatus,
  generateSqlWithAI,
} from "../controllers/database.controller";
import { protect, authorizePermission, requireDbStepUp } from "../middleware/auth";

const router = Router();

/**
 * The raw database console (TM-10) is a platform operator's tool:
 *  - off unless DB_CONSOLE_ENABLED=true;
 *  - only in the platform-primary tenant (with database per tenant it would
 *    otherwise show one school's database to that school's admin, and the
 *    operator never needs it there);
 *  - read-only: row edits are gone and /query runs SELECT/SHOW/DESCRIBE/
 *    EXPLAIN only (database.controller.ts);
 *  - still behind DATABASE_ADMIN_ACCESS and the step-up token.
 */
export const dbConsoleEnabled = () => String(process.env.DB_CONSOLE_ENABLED || "").toLowerCase() === "true";

const consoleGate = (req: Request, res: Response, next: NextFunction) => {
  if (!dbConsoleEnabled() || !req.tenant?.isPrimary) {
    return res.status(404).json({ success: false, code: "DB_CONSOLE_DISABLED", message: "The database console is not available." });
  }
  next();
};

const readOnly = (_req: Request, res: Response) =>
  res.status(405).json({ success: false, code: "DB_CONSOLE_READ_ONLY", message: "The database console is read-only." });

router.use(protect);

router.get("/tables", authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate, requireDbStepUp, listTables);
router.get(
  "/tables/:table/structure",
  authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate,
  requireDbStepUp,
  getTableStructure,
);
router.get(
  "/tables/:table/data",
  authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate,
  requireDbStepUp,
  getTableData,
);
router.post(
  "/tables/:table/rows",
  authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate,
  requireDbStepUp,
  readOnly,
);
router.put(
  "/tables/:table/rows",
  authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate,
  requireDbStepUp,
  readOnly,
);
router.delete(
  "/tables/:table/rows",
  authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate,
  requireDbStepUp,
  readOnly,
);
router.get(
  "/tables/:table/export",
  authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate,
  requireDbStepUp,
  exportTable,
);
router.post("/query", authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate, requireDbStepUp, runQuery);
router.post(
  "/query/ai-generate",
  authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate,
  requireDbStepUp,
  requireAi("author"),
  generateSqlWithAI,
);
router.get(
  "/query/history",
  authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate,
  requireDbStepUp,
  getQueryHistory,
);
router.get("/status", authorizePermission("DATABASE_ADMIN_ACCESS"), consoleGate, requireDbStepUp, getServerStatus);

export default router;
