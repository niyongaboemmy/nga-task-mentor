import { z } from "zod";

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name is required")
    .max(100, "name is too long")
    .regex(/^[a-zA-Z0-9 _-]+$/, "name contains invalid characters"),
  description: z.string().trim().max(255).optional().nullable(),
  permissionKeys: z.array(z.string().min(1)).default([]),
});

export const updateRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name is required")
    .max(100, "name is too long")
    .regex(/^[a-zA-Z0-9 _-]+$/, "name contains invalid characters")
    .optional(),
  description: z.string().trim().max(255).optional().nullable(),
  permissionKeys: z.array(z.string().min(1)).optional(),
});

export const assignRoleSchema = z.object({
  roleId: z.number().int().positive("roleId must be a positive integer"),
});

export type CreateRolePayload = z.infer<typeof createRoleSchema>;
export type UpdateRolePayload = z.infer<typeof updateRoleSchema>;
export type AssignRolePayload = z.infer<typeof assignRoleSchema>;
