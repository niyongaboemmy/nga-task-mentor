import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { DatabaseQueryLog, User } from "../models";

const READ_STATEMENTS = ["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"];
const WRITE_STATEMENTS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "REPLACE",
  "ALTER",
  "CREATE",
  "DROP",
  "TRUNCATE",
];

const FORBIDDEN_PATTERNS = [
  /DROP\s+DATABASE/i,
  /DROP\s+SCHEMA/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /CREATE\s+USER/i,
  /DROP\s+USER/i,
  /ALTER\s+USER/i,
  /SET\s+GLOBAL/i,
  /\bSHUTDOWN\b/i,
  /LOAD_FILE/i,
  /INTO\s+OUTFILE/i,
];

const getStatementType = (query: string): string => {
  const match = query.trim().match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : "UNKNOWN";
};

const isWriteStatement = (statementType: string): boolean => {
  if (READ_STATEMENTS.includes(statementType)) return false;
  return true;
};

const tableExists = async (table: string): Promise<boolean> => {
  const rows = await sequelize.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table`,
    { replacements: { table }, type: QueryTypes.SELECT },
  );
  return Number(rows[0]?.cnt || 0) > 0;
};

const getTableColumns = async (table: string): Promise<string[]> => {
  const rows = await sequelize.query<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table ORDER BY ORDINAL_POSITION`,
    { replacements: { table }, type: QueryTypes.SELECT },
  );
  return rows.map((r) => r.COLUMN_NAME);
};

const logQuery = async (params: {
  userId: number;
  queryText: string;
  statementType: string;
  isWrite: boolean;
  rowCount?: number | null;
  executionMs?: number | null;
  status: "success" | "error";
  errorMessage?: string | null;
  ipAddress?: string | null;
}): Promise<void> => {
  try {
    await DatabaseQueryLog.create(params);
  } catch (error) {
    console.error("Failed to write database query log:", error);
  }
};

// @desc    List all tables in the current database with row count and size
// @route   GET /api/database/tables
// @access  Private/Admin (step-up required)
export const listTables = async (req: Request, res: Response) => {
  try {
    const tables = await sequelize.query(
      `SELECT
        TABLE_NAME AS tableName,
        TABLE_ROWS AS approxRowCount,
        DATA_LENGTH AS dataLength,
        INDEX_LENGTH AS indexLength,
        (DATA_LENGTH + INDEX_LENGTH) AS sizeBytes
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME ASC`,
      { type: QueryTypes.SELECT },
    );

    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    console.error("List tables error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get a table's column and index structure
// @route   GET /api/database/tables/:table/structure
// @access  Private/Admin (step-up required)
export const getTableStructure = async (req: Request, res: Response) => {
  try {
    const { table } = req.params;

    if (!(await tableExists(table))) {
      return res.status(400).json({ success: false, message: "Unknown table" });
    }

    const columns = await sequelize.query(
      `SELECT
        COLUMN_NAME AS name,
        DATA_TYPE AS type,
        IS_NULLABLE AS nullable,
        COLUMN_KEY AS \`key\`,
        COLUMN_DEFAULT AS \`default\`,
        EXTRA AS extra,
        CHARACTER_MAXIMUM_LENGTH AS maxLength
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
      ORDER BY ORDINAL_POSITION ASC`,
      { replacements: { table }, type: QueryTypes.SELECT },
    );

    const indexes = await sequelize.query(
      `SELECT
        INDEX_NAME AS indexName,
        COLUMN_NAME AS columnName,
        NON_UNIQUE AS nonUnique,
        SEQ_IN_INDEX AS seqInIndex
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
      ORDER BY INDEX_NAME ASC, SEQ_IN_INDEX ASC`,
      { replacements: { table }, type: QueryTypes.SELECT },
    );

    res.status(200).json({ success: true, data: { columns, indexes } });
  } catch (error) {
    console.error("Get table structure error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Paginated, sortable, searchable browse of a table's rows
// @route   GET /api/database/tables/:table/data
// @access  Private/Admin (step-up required)
export const getTableData = async (req: Request, res: Response) => {
  try {
    const { table } = req.params;

    if (!(await tableExists(table))) {
      return res.status(400).json({ success: false, message: "Unknown table" });
    }

    const columns = await getTableColumns(table);
    if (columns.length === 0) {
      return res.status(400).json({ success: false, message: "Unknown table" });
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25),
    );
    const offset = (page - 1) * limit;

    const sortByRaw = String(req.query.sortBy || "");
    const sortBy = columns.includes(sortByRaw) ? sortByRaw : columns[0];
    const sortDir =
      String(req.query.sortDir || "ASC").toUpperCase() === "DESC"
        ? "DESC"
        : "ASC";

    const search = req.query.search ? String(req.query.search) : "";

    let whereClause = "";
    const replacements: Record<string, any> = { limit, offset };

    if (search) {
      const searchConditions = columns
        .map((col, idx) => {
          const paramName = `search_${idx}`;
          replacements[paramName] = `%${search}%`;
          return `CAST(\`${col}\` AS CHAR) LIKE :${paramName}`;
        })
        .join(" OR ");
      whereClause = `WHERE ${searchConditions}`;
    }

    const countRows = await sequelize.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM \`${table}\` ${whereClause}`,
      { replacements, type: QueryTypes.SELECT },
    );
    const total = Number(countRows[0]?.cnt || 0);

    const rows = await sequelize.query(
      `SELECT * FROM \`${table}\` ${whereClause} ORDER BY \`${sortBy}\` ${sortDir} LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT },
    );

    res.status(200).json({ success: true, rows, total, page, limit });
  } catch (error) {
    console.error("Get table data error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Insert a row into a table
// @route   POST /api/database/tables/:table/rows
// @access  Private/Admin (step-up required)
export const insertRow = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { table } = req.params;
  const { values } = req.body || {};

  try {
    if (!(await tableExists(table))) {
      return res.status(400).json({ success: false, message: "Unknown table" });
    }

    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return res
        .status(400)
        .json({ success: false, message: "values must be an object" });
    }

    const columns = await getTableColumns(table);
    const keys = Object.keys(values);

    if (keys.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No values provided" });
    }

    const invalidKeys = keys.filter((k) => !columns.includes(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unknown column(s): ${invalidKeys.join(", ")}`,
      });
    }

    const columnList = keys.map((k) => `\`${k}\``).join(", ");
    const placeholderList = keys.map((k) => `:${k}`).join(", ");

    const [, metadata] = await sequelize.query(
      `INSERT INTO \`${table}\` (${columnList}) VALUES (${placeholderList})`,
      { replacements: values, type: QueryTypes.INSERT },
    );

    await logQuery({
      userId: (req as any).user.id,
      queryText: `INSERT INTO ${table} (${columnList})`,
      statementType: "INSERT",
      isWrite: true,
      rowCount: (metadata as any) || 1,
      executionMs: Date.now() - startTime,
      status: "success",
      ipAddress: req.ip || null,
    });

    res.status(201).json({ success: true, data: { insertId: metadata } });
  } catch (error: any) {
    await logQuery({
      userId: (req as any).user.id,
      queryText: `INSERT INTO ${table}`,
      statementType: "INSERT",
      isWrite: true,
      executionMs: Date.now() - startTime,
      status: "error",
      errorMessage: error.message,
      ipAddress: req.ip || null,
    });
    console.error("Insert row error:", error);
    res.status(400).json({ success: false, message: error.message || "Server error" });
  }
};

// @desc    Update row(s) in a table by a primary-key-based where clause
// @route   PUT /api/database/tables/:table/rows
// @access  Private/Admin (step-up required)
export const updateRow = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { table } = req.params;
  const { values, where } = req.body || {};

  try {
    if (!(await tableExists(table))) {
      return res.status(400).json({ success: false, message: "Unknown table" });
    }

    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return res
        .status(400)
        .json({ success: false, message: "values must be an object" });
    }
    if (!where || typeof where !== "object" || Array.isArray(where)) {
      return res
        .status(400)
        .json({ success: false, message: "where must be an object" });
    }

    const whereKeys = Object.keys(where);
    if (whereKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: "where clause is required for row updates",
      });
    }

    const columns = await getTableColumns(table);
    const valueKeys = Object.keys(values);

    const invalidValueKeys = valueKeys.filter((k) => !columns.includes(k));
    const invalidWhereKeys = whereKeys.filter((k) => !columns.includes(k));
    if (invalidValueKeys.length > 0 || invalidWhereKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unknown column(s): ${[...invalidValueKeys, ...invalidWhereKeys].join(", ")}`,
      });
    }

    if (valueKeys.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No values provided" });
    }

    const replacements: Record<string, any> = {};
    const setClause = valueKeys
      .map((k) => {
        const paramName = `v_${k}`;
        replacements[paramName] = values[k];
        return `\`${k}\` = :${paramName}`;
      })
      .join(", ");
    const whereClause = whereKeys
      .map((k) => {
        const paramName = `w_${k}`;
        replacements[paramName] = where[k];
        return `\`${k}\` = :${paramName}`;
      })
      .join(" AND ");

    const [, metadata] = await sequelize.query(
      `UPDATE \`${table}\` SET ${setClause} WHERE ${whereClause}`,
      { replacements, type: QueryTypes.UPDATE },
    );

    await logQuery({
      userId: (req as any).user.id,
      queryText: `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
      statementType: "UPDATE",
      isWrite: true,
      rowCount: (metadata as any) ?? null,
      executionMs: Date.now() - startTime,
      status: "success",
      ipAddress: req.ip || null,
    });

    res.status(200).json({ success: true, data: { affectedRows: metadata } });
  } catch (error: any) {
    await logQuery({
      userId: (req as any).user.id,
      queryText: `UPDATE ${table}`,
      statementType: "UPDATE",
      isWrite: true,
      executionMs: Date.now() - startTime,
      status: "error",
      errorMessage: error.message,
      ipAddress: req.ip || null,
    });
    console.error("Update row error:", error);
    res.status(400).json({ success: false, message: error.message || "Server error" });
  }
};

// @desc    Delete row(s) from a table by a primary-key-based where clause
// @route   DELETE /api/database/tables/:table/rows
// @access  Private/Admin (step-up required)
export const deleteRow = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { table } = req.params;
  const { where } = req.body || {};

  try {
    if (!(await tableExists(table))) {
      return res.status(400).json({ success: false, message: "Unknown table" });
    }

    if (!where || typeof where !== "object" || Array.isArray(where)) {
      return res
        .status(400)
        .json({ success: false, message: "where must be an object" });
    }

    const whereKeys = Object.keys(where);
    if (whereKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: "where clause is required for row deletion",
      });
    }

    const columns = await getTableColumns(table);
    const invalidWhereKeys = whereKeys.filter((k) => !columns.includes(k));
    if (invalidWhereKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unknown column(s): ${invalidWhereKeys.join(", ")}`,
      });
    }

    const replacements: Record<string, any> = {};
    const whereClause = whereKeys
      .map((k) => {
        const paramName = `w_${k}`;
        replacements[paramName] = where[k];
        return `\`${k}\` = :${paramName}`;
      })
      .join(" AND ");

    const [, metadata] = (await sequelize.query(
      `DELETE FROM \`${table}\` WHERE ${whereClause}`,
      { replacements, type: QueryTypes.RAW },
    )) as [unknown, any];

    await logQuery({
      userId: (req as any).user.id,
      queryText: `DELETE FROM ${table} WHERE ${whereClause}`,
      statementType: "DELETE",
      isWrite: true,
      rowCount: (metadata as any) ?? null,
      executionMs: Date.now() - startTime,
      status: "success",
      ipAddress: req.ip || null,
    });

    res.status(200).json({ success: true, data: { affectedRows: metadata } });
  } catch (error: any) {
    await logQuery({
      userId: (req as any).user.id,
      queryText: `DELETE FROM ${table}`,
      statementType: "DELETE",
      isWrite: true,
      executionMs: Date.now() - startTime,
      status: "error",
      errorMessage: error.message,
      ipAddress: req.ip || null,
    });
    console.error("Delete row error:", error);
    res.status(400).json({ success: false, message: error.message || "Server error" });
  }
};

// @desc    Run a free-form SQL statement
// @route   POST /api/database/query
// @access  Private/Admin (step-up required)
export const runQuery = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { query, confirm } = req.body || {};
  const userId = (req as any).user.id;
  const ipAddress = req.ip || null;

  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ success: false, message: "Query is required" });
  }

  const trimmed = query.trim();
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    return res.status(400).json({
      success: false,
      message: "Only a single SQL statement is allowed",
    });
  }

  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return res.status(400).json({
      success: false,
      message: "This statement is not permitted",
    });
  }

  const statementType = getStatementType(trimmed);
  const isWrite = isWriteStatement(statementType);

  if (isWrite && confirm !== true) {
    return res.status(400).json({
      success: false,
      message: "This is a write operation; resend with confirm: true",
    });
  }

  try {
    let rows: any;
    let metadata: any;

    if (READ_STATEMENTS.includes(statementType)) {
      rows = await sequelize.query(trimmed, { type: QueryTypes.SELECT });
    } else {
      [rows, metadata] = await sequelize.query(trimmed, { type: QueryTypes.RAW });
    }

    const rowCount = Array.isArray(rows)
      ? rows.length
      : typeof metadata === "number"
        ? metadata
        : null;

    await logQuery({
      userId,
      queryText: trimmed,
      statementType,
      isWrite,
      rowCount,
      executionMs: Date.now() - startTime,
      status: "success",
      ipAddress,
    });

    res.status(200).json({
      success: true,
      data: {
        rows: Array.isArray(rows) ? rows : [],
        rowCount,
        executionMs: Date.now() - startTime,
        statementType,
      },
    });
  } catch (error: any) {
    await logQuery({
      userId,
      queryText: trimmed,
      statementType,
      isWrite,
      executionMs: Date.now() - startTime,
      status: "error",
      errorMessage: error.message,
      ipAddress,
    });
    console.error("Run query error:", error);
    res.status(400).json({ success: false, message: error.message || "Query failed" });
  }
};

// @desc    Paginated query history for all admins
// @route   GET /api/database/query/history
// @access  Private/Admin (step-up required)
export const getQueryHistory = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25),
    );
    const offset = (page - 1) * limit;

    const { rows, count } = await DatabaseQueryLog.findAndCountAll({
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: rows,
      total: count,
      page,
      limit,
    });
  } catch (error) {
    console.error("Get query history error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Export a table's contents as CSV or SQL
// @route   GET /api/database/tables/:table/export
// @access  Private/Admin (step-up required)
export const exportTable = async (req: Request, res: Response) => {
  try {
    const { table } = req.params;
    const format = String(req.query.format || "csv").toLowerCase();

    if (!["csv", "sql"].includes(format)) {
      return res
        .status(400)
        .json({ success: false, message: "format must be csv or sql" });
    }

    if (!(await tableExists(table))) {
      return res.status(400).json({ success: false, message: "Unknown table" });
    }

    const columns = await getTableColumns(table);
    const rows = await sequelize.query<Record<string, any>>(
      `SELECT * FROM \`${table}\``,
      { type: QueryTypes.SELECT },
    );

    if (format === "csv") {
      const escapeCsv = (value: any): string => {
        if (value === null || value === undefined) return "";
        const str =
          value instanceof Date ? value.toISOString() : String(value);
        if (/[",\n]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const lines = [columns.join(",")];
      for (const row of rows) {
        lines.push(columns.map((c) => escapeCsv(row[c])).join(","));
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${table}.csv"`,
      );
      return res.status(200).send(lines.join("\n"));
    }

    const escapeSqlValue = (value: any): string => {
      if (value === null || value === undefined) return "NULL";
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      const str = value instanceof Date ? value.toISOString() : String(value);
      return `'${str.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
    };

    const columnList = columns.map((c) => `\`${c}\``).join(", ");
    const lines = rows.map((row) => {
      const valueList = columns.map((c) => escapeSqlValue(row[c])).join(", ");
      return `INSERT INTO \`${table}\` (${columnList}) VALUES (${valueList});`;
    });

    res.setHeader("Content-Type", "application/sql");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${table}.sql"`,
    );
    res.status(200).send(lines.join("\n"));
  } catch (error) {
    console.error("Export table error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Server status: version, uptime, connections, DB size
// @route   GET /api/database/status
// @access  Private/Admin (step-up required)
export const getServerStatus = async (req: Request, res: Response) => {
  try {
    const versionRows = await sequelize.query<{ version: string }>(
      `SELECT VERSION() AS version`,
      { type: QueryTypes.SELECT },
    );
    const uptimeRows = await sequelize.query<{
      Variable_name: string;
      Value: string;
    }>(`SHOW STATUS LIKE 'Uptime'`, { type: QueryTypes.SELECT });
    const threadsRows = await sequelize.query<{
      Variable_name: string;
      Value: string;
    }>(`SHOW STATUS LIKE 'Threads_connected'`, { type: QueryTypes.SELECT });
    const sizeRows = await sequelize.query<{ sizeMb: number }>(
      `SELECT SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024 AS sizeMb
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()`,
      { type: QueryTypes.SELECT },
    );

    res.status(200).json({
      success: true,
      data: {
        version: versionRows[0]?.version || null,
        uptime: uptimeRows[0]?.Value ? Number(uptimeRows[0].Value) : null,
        threadsConnected: threadsRows[0]?.Value
          ? Number(threadsRows[0].Value)
          : null,
        dbSizeMb: sizeRows[0]?.sizeMb ? Number(sizeRows[0].sizeMb) : 0,
      },
    });
  } catch (error) {
    console.error("Get server status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
