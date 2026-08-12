import { useState, useEffect, useMemo, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { useAuth } from "../contexts/AuthContext";
import {
  confirmDbAccess,
  getTables,
  getTableStructure,
  getTableData,
  insertRow,
  updateRow,
  deleteRow,
  runQuery,
  getQueryHistory,
  exportTable,
  type DbTableSummary,
  type DbTableStructure,
  type DbTableDataResult,
  type DbQueryResult,
  type DbQueryLogEntry,
} from "../services/databaseApi";

const TOKEN_KEY = "dbAccessToken";
const EXPIRY_KEY = "dbAccessTokenExpiry";

const READ_ONLY_PATTERN = /^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i;

const detectStatementType = (query: string): string => {
  const match = query.trim().match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : "UNKNOWN";
};

type Tab = "browse" | "structure" | "export";
type TopTab = "table" | "query" | "history";

const formatBytes = (bytes: number | null): string => {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const DatabaseManagementPage: React.FC = () => {
  const { user } = useAuth();

  const [unlocked, setUnlocked] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [writeMode, setWriteMode] = useState(false);

  const [tables, setTables] = useState<DbTableSummary[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const [topTab, setTopTab] = useState<TopTab>("table");
  const [tableTab, setTableTab] = useState<Tab>("browse");

  const [structure, setStructure] = useState<DbTableStructure | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);

  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [search, setSearch] = useState("");

  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, any>>({});
  const [rowActionSubmitting, setRowActionSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, any> | null>(
    null,
  );

  const [sqlQuery, setSqlQuery] = useState("");
  const [queryRunning, setQueryRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<DbQueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [pendingConfirmType, setPendingConfirmType] = useState<string | null>(
    null,
  );

  const [history, setHistory] = useState<DbQueryLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  // ── Step-up gate ──────────────────────────────────────────────────────

  useEffect(() => {
    const storedToken = sessionStorage.getItem(TOKEN_KEY);
    const storedExpiry = sessionStorage.getItem(EXPIRY_KEY);
    if (storedToken && storedExpiry && Number(storedExpiry) > Date.now()) {
      setUnlocked(true);
      setTokenExpiry(Number(storedExpiry));
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [unlocked]);

  useEffect(() => {
    if (unlocked && tokenExpiry && now >= tokenExpiry) {
      handleLock();
      toast.error("Database access session expired.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, unlocked, tokenExpiry]);

  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setGateSubmitting(true);
    setGateError(null);
    try {
      const { dbAccessToken, expiresIn } = await confirmDbAccess(password);
      const expiry = Date.now() + expiresIn * 1000;
      sessionStorage.setItem(TOKEN_KEY, dbAccessToken);
      sessionStorage.setItem(EXPIRY_KEY, String(expiry));
      setTokenExpiry(expiry);
      setUnlocked(true);
      setPassword("");
    } catch (err: any) {
      setGateError(
        err?.response?.data?.message || "Incorrect password. Please try again.",
      );
    } finally {
      setGateSubmitting(false);
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
    setUnlocked(false);
    setTokenExpiry(null);
    setWriteMode(false);
  };

  // ── Table list ────────────────────────────────────────────────────────

  const fetchTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const data = await getTables();
      setTables(data);
    } catch {
      toast.error("Failed to load tables.");
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) fetchTables();
  }, [unlocked, fetchTables]);

  const filteredTables = useMemo(
    () =>
      tables.filter((t) =>
        t.tableName.toLowerCase().includes(tableSearch.toLowerCase()),
      ),
    [tables, tableSearch],
  );

  const selectTable = (table: string) => {
    setSelectedTable(table);
    setTopTab("table");
    setTableTab("browse");
    setPage(1);
    setSortBy("");
    setSearch("");
    setEditingRow(null);
    setShowAddRow(false);
  };

  // ── Structure ─────────────────────────────────────────────────────────

  const fetchStructure = useCallback(async () => {
    if (!selectedTable) return;
    setStructureLoading(true);
    try {
      const data = await getTableStructure(selectedTable);
      setStructure(data);
    } catch {
      toast.error("Failed to load table structure.");
    } finally {
      setStructureLoading(false);
    }
  }, [selectedTable]);

  useEffect(() => {
    if (selectedTable && tableTab === "structure") fetchStructure();
  }, [selectedTable, tableTab, fetchStructure]);

  // ── Browse data ───────────────────────────────────────────────────────

  const fetchRows = useCallback(async () => {
    if (!selectedTable) return;
    setRowsLoading(true);
    try {
      const result: DbTableDataResult = await getTableData(selectedTable, {
        page,
        limit,
        sortBy: sortBy || undefined,
        sortDir,
        search: search || undefined,
      });
      setRows(result.rows);
      setRowsTotal(result.total);
    } catch {
      toast.error("Failed to load table data.");
    } finally {
      setRowsLoading(false);
    }
  }, [selectedTable, page, limit, sortBy, sortDir, search]);

  useEffect(() => {
    if (selectedTable && tableTab === "browse") fetchRows();
  }, [selectedTable, tableTab, fetchRows]);

  useEffect(() => {
    if (selectedTable && tableTab === "structure") {
      // pre-warm structure so browse's add/edit forms know columns
      fetchStructure();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable]);

  const columnNames = useMemo(
    () => (rows.length > 0 ? Object.keys(rows[0]) : structure?.columns.map((c) => c.name) || []),
    [rows, structure],
  );

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortBy(col);
      setSortDir("ASC");
    }
  };

  const startEdit = (row: Record<string, any>) => {
    setEditingRow(row);
    setEditValues({ ...row });
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditValues({});
  };

  const primaryKeyWhere = (row: Record<string, any>): Record<string, any> => {
    const pkCols = structure?.columns.filter((c) => c.key === "PRI").map((c) => c.name);
    if (pkCols && pkCols.length > 0) {
      const where: Record<string, any> = {};
      pkCols.forEach((c) => (where[c] = row[c]));
      return where;
    }
    return { ...row };
  };

  const saveEdit = async () => {
    if (!selectedTable || !editingRow) return;
    setRowActionSubmitting(true);
    try {
      const where = primaryKeyWhere(editingRow);
      await updateRow(selectedTable, editValues, where);
      toast.success("Row updated.");
      cancelEdit();
      fetchRows();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update row.");
    } finally {
      setRowActionSubmitting(false);
    }
  };

  const confirmDeleteRow = async () => {
    if (!selectedTable || !deleteTarget) return;
    setRowActionSubmitting(true);
    try {
      const where = primaryKeyWhere(deleteTarget);
      await deleteRow(selectedTable, where);
      toast.success("Row deleted.");
      setDeleteTarget(null);
      fetchRows();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete row.");
    } finally {
      setRowActionSubmitting(false);
    }
  };

  const submitAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    setRowActionSubmitting(true);
    try {
      const values: Record<string, any> = {};
      Object.entries(newRowValues).forEach(([k, v]) => {
        if (v !== "" && v !== undefined) values[k] = v;
      });
      await insertRow(selectedTable, values);
      toast.success("Row added.");
      setShowAddRow(false);
      setNewRowValues({});
      fetchRows();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add row.");
    } finally {
      setRowActionSubmitting(false);
    }
  };

  // ── SQL query runner ──────────────────────────────────────────────────

  const isReadOnlyQuery = READ_ONLY_PATTERN.test(sqlQuery);
  const runDisabled = !sqlQuery.trim() || (!writeMode && !isReadOnlyQuery);

  const executeQuery = async (confirm: boolean) => {
    setQueryRunning(true);
    setQueryError(null);
    try {
      const result = await runQuery(sqlQuery, confirm);
      setQueryResult(result);
      setPendingConfirmType(null);
    } catch (err: any) {
      setQueryError(err?.response?.data?.message || "Query failed.");
      setQueryResult(null);
    } finally {
      setQueryRunning(false);
    }
  };

  const handleRunClick = () => {
    if (!sqlQuery.trim()) return;
    const statementType = detectStatementType(sqlQuery);
    const looksLikeWrite = !READ_ONLY_PATTERN.test(sqlQuery);
    if (looksLikeWrite && writeMode) {
      setPendingConfirmType(statementType);
      return;
    }
    executeQuery(false);
  };

  // ── Query history ─────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await getQueryHistory({ page: historyPage, limit: 25 });
      setHistory(result.data);
      setHistoryTotal(result.total);
    } catch {
      toast.error("Failed to load query history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage]);

  useEffect(() => {
    if (unlocked && topTab === "history") fetchHistory();
  }, [unlocked, topTab, fetchHistory]);

  const loadHistoryQuery = (entry: DbQueryLogEntry) => {
    setSqlQuery(entry.queryText);
    setTopTab("query");
  };

  // ── Export ────────────────────────────────────────────────────────────

  const handleExport = async (format: "csv" | "sql") => {
    if (!selectedTable) return;
    try {
      await exportTable(selectedTable, format);
    } catch {
      toast.error("Failed to export table.");
    }
  };

  // ── Guard rails ───────────────────────────────────────────────────────

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            Confirm Admin Access
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Re-enter your password to continue to Database Management.
          </p>
          <form onSubmit={handleGateSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {gateError && (
              <p className="text-sm text-red-600 dark:text-red-400">{gateError}</p>
            )}
            <button
              type="submit"
              disabled={gateSubmitting || !password}
              className="w-full px-5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {gateSubmitting ? "Verifying…" : "Confirm"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const secondsLeft = tokenExpiry ? Math.max(0, Math.floor((tokenExpiry - now) / 1000)) : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      {/* Top bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Database Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Browse, edit, and query the application database directly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            Session expires in {mm}:{ss}
          </span>
          <button
            onClick={() => setWriteMode((w) => !w)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
              writeMode
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60"
            }`}
          >
            Write mode: {writeMode ? "ON" : "OFF"}
          </button>
          <button
            onClick={handleLock}
            className="px-4 py-1.5 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Lock
          </button>
        </div>
      </div>

      {/* Top-level tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(["table", "query", "history"] as TopTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTopTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              topTab === t
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t === "table" ? "Tables" : t === "query" ? "SQL Query" : "Query History"}
          </button>
        ))}
      </div>

      {topTab === "table" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Left panel: tables list */}
          <div className="md:col-span-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 h-fit">
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search tables…"
              className="w-full px-3 py-2 mb-3 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {tablesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : (
              <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
                {filteredTables.map((t) => (
                  <li key={t.tableName}>
                    <button
                      onClick={() => selectTable(t.tableName)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between transition-colors ${
                        selectedTable === t.tableName
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <span className="truncate font-mono text-xs">{t.tableName}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-2 shrink-0 text-right">
                        <span className="block">{t.approxRowCount ?? 0} rows</span>
                        <span className="block">{formatBytes(t.sizeBytes)}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {filteredTables.length === 0 && (
                  <li className="text-sm text-gray-400 dark:text-gray-500 px-3 py-4 text-center">
                    No tables found.
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Right panel: selected table */}
          <div className="md:col-span-3">
            {!selectedTable ? (
              <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 text-sm">
                Select a table to get started.
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h2 className="font-mono font-bold text-gray-900 dark:text-white">
                    {selectedTable}
                  </h2>
                  <div className="flex gap-1">
                    {(["browse", "structure", "export"] as Tab[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTableTab(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                          tableTab === t
                            ? "bg-blue-600 text-white"
                            : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  {tableTab === "browse" && (
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                          }}
                          placeholder="Search rows…"
                          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                        {writeMode && (
                          <button
                            onClick={() => setShowAddRow(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-full transition-colors"
                          >
                            + Add row
                          </button>
                        )}
                      </div>

                      {rowsLoading ? (
                        <div className="flex justify-center py-16">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-800">
                                {columnNames.map((col) => (
                                  <th
                                    key={col}
                                    onClick={() => handleSort(col)}
                                    className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 cursor-pointer whitespace-nowrap"
                                  >
                                    {col}
                                    {sortBy === col && (sortDir === "ASC" ? " ▲" : " ▼")}
                                  </th>
                                ))}
                                {writeMode && (
                                  <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-300">
                                    Actions
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, idx) => (
                                <tr
                                  key={idx}
                                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                  {columnNames.map((col) => (
                                    <td
                                      key={col}
                                      className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-xs truncate"
                                    >
                                      {editingRow === row ? (
                                        <input
                                          value={editValues[col] ?? ""}
                                          onChange={(e) =>
                                            setEditValues((p) => ({
                                              ...p,
                                              [col]: e.target.value,
                                            }))
                                          }
                                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded"
                                        />
                                      ) : (
                                        String(row[col] ?? "")
                                      )}
                                    </td>
                                  ))}
                                  {writeMode && (
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                      {editingRow === row ? (
                                        <div className="flex gap-1 justify-end">
                                          <button
                                            onClick={saveEdit}
                                            disabled={rowActionSubmitting}
                                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={cancelEdit}
                                            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex gap-1 justify-end">
                                          <button
                                            onClick={() => startEdit(row)}
                                            className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => setDeleteTarget(row)}
                                            className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:underline"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              ))}
                              {rows.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={columnNames.length + 1}
                                    className="px-3 py-8 text-center text-gray-400 dark:text-gray-500"
                                  >
                                    No rows found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Pagination */}
                      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {rowsTotal} row{rowsTotal !== 1 ? "s" : ""} · page {page}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page * limit >= rowsTotal}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {tableTab === "structure" && (
                    <div>
                      {structureLoading ? (
                        <div className="flex justify-center py-16">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        </div>
                      ) : structure ? (
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                              Columns
                            </h3>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 dark:border-gray-800">
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Name
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Type
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Nullable
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Key
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Default
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Extra
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {structure.columns.map((c) => (
                                    <tr
                                      key={c.name}
                                      className="border-b border-gray-100 dark:border-gray-800"
                                    >
                                      <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">
                                        {c.name}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                        {c.type}
                                        {c.maxLength ? `(${c.maxLength})` : ""}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                        {c.nullable}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                        {c.key}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                        {c.default ?? "—"}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                        {c.extra}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                              Indexes
                            </h3>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 dark:border-gray-800">
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Index
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Column
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Unique
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                                      Seq
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {structure.indexes.map((idx, i) => (
                                    <tr
                                      key={`${idx.indexName}-${i}`}
                                      className="border-b border-gray-100 dark:border-gray-800"
                                    >
                                      <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">
                                        {idx.indexName}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                        {idx.columnName}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                        {idx.nonUnique === 0 ? "Yes" : "No"}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                        {idx.seqInIndex}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {tableTab === "export" && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleExport("csv")}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors"
                      >
                        Download CSV
                      </button>
                      <button
                        onClick={() => handleExport("sql")}
                        className="px-5 py-2.5 bg-gray-700 hover:bg-gray-800 text-white rounded-full text-sm font-medium transition-colors"
                      >
                        Download SQL dump
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {topTab === "query" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 mb-4">
            <CodeMirror
              value={sqlQuery}
              height="200px"
              extensions={[sql()]}
              onChange={(value) => setSqlQuery(value)}
              theme={
                document.documentElement.classList.contains("dark")
                  ? "dark"
                  : "light"
              }
            />
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {writeMode
                ? "Write mode is ON — write statements will run after confirmation."
                : "Write mode is OFF — only read statements (SELECT/SHOW/DESCRIBE/EXPLAIN) may run."}
            </p>
            <button
              onClick={handleRunClick}
              disabled={runDisabled || queryRunning}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {queryRunning ? "Running…" : "Run"}
            </button>
          </div>

          {queryError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {queryError}
            </div>
          )}

          {queryResult && (
            <div>
              <div className="flex items-center justify-between mb-3 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {queryResult.statementType} · {queryResult.rowCount ?? 0} row(s) ·{" "}
                  {queryResult.executionMs}ms
                </span>
              </div>
              {queryResult.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        {Object.keys(queryResult.rows[0]).map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          {Object.keys(queryResult.rows[0]).map((col) => (
                            <td
                              key={col}
                              className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-xs truncate"
                            >
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {topTab === "history" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          {historyLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      User
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Query
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      When
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => loadHistoryQuery(entry)}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {entry.user
                          ? `${entry.user.first_name} ${entry.user.last_name}`
                          : `#${entry.userId}`}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-md truncate">
                        {entry.queryText}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {entry.executionMs ?? "—"}ms
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            entry.status === "success"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-400 dark:text-gray-500"
                      >
                        No query history yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
            <span>{historyTotal} total</span>
            <div className="flex gap-2">
              <button
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setHistoryPage((p) => p + 1)}
                disabled={historyPage * 25 >= historyTotal}
                className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add row modal */}
      {showAddRow && selectedTable && structure && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowAddRow(false)}
        >
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Add row to {selectedTable}
              </h2>
            </div>
            <form
              onSubmit={submitAddRow}
              className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto"
            >
              {structure.columns
                .filter((c) => c.extra !== "auto_increment")
                .map((c) => (
                  <div key={c.name}>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {c.name}{" "}
                      <span className="text-gray-400">
                        ({c.type}
                        {c.nullable === "NO" ? ", required" : ""})
                      </span>
                    </label>
                    <input
                      type="text"
                      value={newRowValues[c.name] ?? ""}
                      onChange={(e) =>
                        setNewRowValues((p) => ({ ...p, [c.name]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddRow(false)}
                  className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rowActionSubmitting}
                  className="px-5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50"
                >
                  {rowActionSubmitting ? "Adding…" : "Add row"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete row confirm */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}
        >
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Delete row?
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRow}
                disabled={rowActionSubmitting}
                className="px-5 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-full disabled:opacity-50"
              >
                {rowActionSubmitting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write-query confirm */}
      {pendingConfirmType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) =>
            e.target === e.currentTarget && setPendingConfirmType(null)
          }
        >
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Confirm {pendingConfirmType} statement
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              This query will modify the database. Are you sure you want to run it?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingConfirmType(null)}
                className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => executeQuery(true)}
                disabled={queryRunning}
                className="px-5 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-full disabled:opacity-50"
              >
                {queryRunning ? "Running…" : "Yes, run it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseManagementPage;
