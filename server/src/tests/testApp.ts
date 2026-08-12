import express from "express";
import jwt from "jsonwebtoken";
import { sequelize } from "../config/database";
import { setupAssociations, User, Role } from "../models";
import proctoringRoutes from "../routes/proctoring";
import usersRoutes from "../routes/users";
import databaseRoutes from "../routes/database.routes";
import rolesPermissionsRoutes from "../routes/rolesPermissions";

/**
 * Minimal test harness app — mounts only the routers under test against the
 * real (dev) database, using the real middleware chain. Deliberately does
 * NOT import src/index.ts, since that module calls startServer()
 * unconditionally at import time (binds a port, starts the file server,
 * etc.) which is unsafe/heavy to trigger from a test run.
 */
export function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/proctoring", proctoringRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/database", databaseRoutes);
  app.use("/api/roles-permissions", rolesPermissionsRoutes);
  return app;
}

let modelsRegistered = false;

export async function ensureModelsRegistered() {
  if (modelsRegistered) return;
  const models = await import("../models");
  sequelize.addModels([
    models.User,
    models.Assignment,
    models.Submission,
    models.Quiz,
    models.QuizQuestion,
    models.QuizAttempt,
    models.QuizSubmission,
    models.ProctoringSession,
    models.ProctoringEvent,
    models.ProctoringSettings,
    models.BloomsTaxonomyLevel,
    models.QuestionBank,
    models.ReportCard,
    models.ReportCardAttribute,
    models.ReportCardAssessment,
    models.ManualAssessment,
    models.ManualAssessmentScore,
    models.DatabaseQueryLog,
    models.Role,
    models.Permission,
    models.RolePermission,
  ]);
  setupAssociations();
  modelsRegistered = true;
}

export async function findSeededUserByRole(roleName: "admin" | "instructor" | "student") {
  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) {
    throw new Error(
      `Role '${roleName}' not found — run migrations before running integration tests`,
    );
  }
  const user = await User.findOne({ where: { role_id: role.id } });
  if (!user) {
    throw new Error(
      `No seeded user with role '${roleName}' found in the dev DB — integration tests need at least one user per role`,
    );
  }
  return user;
}

export function signTokenFor(userId: number): string {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}
