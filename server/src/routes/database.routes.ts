import { Router } from "express";
import {
  listTables,
  getTableStructure,
  getTableData,
  insertRow,
  updateRow,
  deleteRow,
  runQuery,
  getQueryHistory,
  exportTable,
  getServerStatus,
  generateSqlWithAI,
} from "../controllers/database.controller";
import { protect, authorizePermission, requireDbStepUp } from "../middleware/auth";

const router = Router();

router.use(protect);

router.get("/tables", authorizePermission("DATABASE_ADMIN_ACCESS"), requireDbStepUp, listTables);
router.get(
  "/tables/:table/structure",
  authorizePermission("DATABASE_ADMIN_ACCESS"),
  requireDbStepUp,
  getTableStructure,
);
router.get(
  "/tables/:table/data",
  authorizePermission("DATABASE_ADMIN_ACCESS"),
  requireDbStepUp,
  getTableData,
);
router.post(
  "/tables/:table/rows",
  authorizePermission("DATABASE_ADMIN_ACCESS"),
  requireDbStepUp,
  insertRow,
);
router.put(
  "/tables/:table/rows",
  authorizePermission("DATABASE_ADMIN_ACCESS"),
  requireDbStepUp,
  updateRow,
);
router.delete(
  "/tables/:table/rows",
  authorizePermission("DATABASE_ADMIN_ACCESS"),
  requireDbStepUp,
  deleteRow,
);
router.get(
  "/tables/:table/export",
  authorizePermission("DATABASE_ADMIN_ACCESS"),
  requireDbStepUp,
  exportTable,
);
router.post("/query", authorizePermission("DATABASE_ADMIN_ACCESS"), requireDbStepUp, runQuery);
router.post(
  "/query/ai-generate",
  authorizePermission("DATABASE_ADMIN_ACCESS"),
  requireDbStepUp,
  generateSqlWithAI,
);
router.get(
  "/query/history",
  authorizePermission("DATABASE_ADMIN_ACCESS"),
  requireDbStepUp,
  getQueryHistory,
);
router.get("/status", authorizePermission("DATABASE_ADMIN_ACCESS"), requireDbStepUp, getServerStatus);

export default router;
