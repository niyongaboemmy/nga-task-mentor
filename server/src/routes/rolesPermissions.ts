import { Router } from "express";
import {
  getPermissionCatalog,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignUserRole,
} from "../controllers/rolePermission.controller";
import { protect, authorizePermission } from "../middleware/auth";
import { publishAiChange } from "../services/aiLive";
import { validate } from "../middleware/validation.middleware";
import {
  createRoleSchema,
  updateRoleSchema,
  assignRoleSchema,
} from "../validations/rolePermission.validation";

const router = Router();

router.use(protect);

// A role's permissions (AI_USE among them) or a user's role changed: open TMCode apps ask for
// their AI status again (GET /api/tmcode/ai/events).
router.use((req, res, next) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) publishAiChange({ cause: "access" });
    });
  }
  next();
});

router.get(
  "/permissions",
  authorizePermission("ROLES_PERMISSIONS_VIEW", "ROLES_PERMISSIONS_MANAGE"),
  getPermissionCatalog,
);

router
  .route("/roles")
  .get(
    authorizePermission("ROLES_PERMISSIONS_VIEW", "ROLES_PERMISSIONS_MANAGE"),
    listRoles,
  )
  .post(
    authorizePermission("ROLES_PERMISSIONS_MANAGE"),
    validate(createRoleSchema),
    createRole,
  );

router
  .route("/roles/:id")
  .get(
    authorizePermission("ROLES_PERMISSIONS_VIEW", "ROLES_PERMISSIONS_MANAGE"),
    getRole,
  )
  .put(
    authorizePermission("ROLES_PERMISSIONS_MANAGE"),
    validate(updateRoleSchema),
    updateRole,
  )
  .delete(authorizePermission("ROLES_PERMISSIONS_MANAGE"), deleteRole);

router.put(
  "/users/:userId/role",
  authorizePermission("ROLES_PERMISSIONS_MANAGE"),
  validate(assignRoleSchema),
  assignUserRole,
);

export default router;
