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
import { protect, authorize, requireDbStepUp } from "../middleware/auth";

const router = Router();

router.use(protect);

router.get("/tables", authorize("admin"), requireDbStepUp, listTables);
router.get(
  "/tables/:table/structure",
  authorize("admin"),
  requireDbStepUp,
  getTableStructure,
);
router.get(
  "/tables/:table/data",
  authorize("admin"),
  requireDbStepUp,
  getTableData,
);
router.post(
  "/tables/:table/rows",
  authorize("admin"),
  requireDbStepUp,
  insertRow,
);
router.put(
  "/tables/:table/rows",
  authorize("admin"),
  requireDbStepUp,
  updateRow,
);
router.delete(
  "/tables/:table/rows",
  authorize("admin"),
  requireDbStepUp,
  deleteRow,
);
router.get(
  "/tables/:table/export",
  authorize("admin"),
  requireDbStepUp,
  exportTable,
);
router.post("/query", authorize("admin"), requireDbStepUp, runQuery);
router.post(
  "/query/ai-generate",
  authorize("admin"),
  requireDbStepUp,
  generateSqlWithAI,
);
router.get(
  "/query/history",
  authorize("admin"),
  requireDbStepUp,
  getQueryHistory,
);
router.get("/status", authorize("admin"), requireDbStepUp, getServerStatus);

export default router;
