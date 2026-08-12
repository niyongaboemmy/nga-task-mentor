import api from "../utils/axiosConfig";

export interface DbTableSummary {
  tableName: string;
  approxRowCount: number | null;
  dataLength: number | null;
  indexLength: number | null;
  sizeBytes: number | null;
}

export interface DbColumnInfo {
  name: string;
  type: string;
  nullable: "YES" | "NO";
  key: string;
  default: string | null;
  extra: string;
  maxLength: number | null;
}

export interface DbIndexInfo {
  indexName: string;
  columnName: string;
  nonUnique: number;
  seqInIndex: number;
}

export interface DbTableStructure {
  columns: DbColumnInfo[];
  indexes: DbIndexInfo[];
}

export interface DbTableDataResult {
  rows: Record<string, any>[];
  total: number;
  page: number;
  limit: number;
}

export interface DbQueryResult {
  rows: Record<string, any>[];
  rowCount: number | null;
  executionMs: number;
  statementType: string;
}

export interface DbQueryLogEntry {
  id: number;
  userId: number;
  queryText: string;
  statementType: string;
  isWrite: boolean;
  rowCount: number | null;
  executionMs: number | null;
  status: "success" | "error";
  errorMessage: string | null;
  createdAt: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

const dbAccessHeaders = () => {
  const token = sessionStorage.getItem("dbAccessToken");
  return token ? { "X-Db-Access-Token": token } : {};
};

export const confirmDbAccess = async (
  password: string,
): Promise<{ dbAccessToken: string; expiresIn: number }> => {
  const response = await api.post("/auth/confirm-db-access", { password });
  return response.data;
};

export const getTables = async (): Promise<DbTableSummary[]> => {
  const response = await api.get("/database/tables", {
    headers: dbAccessHeaders(),
  });
  return response.data.data;
};

export const getTableStructure = async (
  table: string,
): Promise<DbTableStructure> => {
  const response = await api.get(`/database/tables/${table}/structure`, {
    headers: dbAccessHeaders(),
  });
  return response.data.data;
};

export const getTableData = async (
  table: string,
  params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "ASC" | "DESC";
    search?: string;
  } = {},
): Promise<DbTableDataResult> => {
  const response = await api.get(`/database/tables/${table}/data`, {
    params,
    headers: dbAccessHeaders(),
  });
  return response.data;
};

export const insertRow = async (
  table: string,
  values: Record<string, any>,
): Promise<any> => {
  const response = await api.post(
    `/database/tables/${table}/rows`,
    { values },
    { headers: dbAccessHeaders() },
  );
  return response.data;
};

export const updateRow = async (
  table: string,
  values: Record<string, any>,
  where: Record<string, any>,
): Promise<any> => {
  const response = await api.put(
    `/database/tables/${table}/rows`,
    { values, where },
    { headers: dbAccessHeaders() },
  );
  return response.data;
};

export const deleteRow = async (
  table: string,
  where: Record<string, any>,
): Promise<any> => {
  const response = await api.delete(`/database/tables/${table}/rows`, {
    data: { where },
    headers: dbAccessHeaders(),
  });
  return response.data;
};

export const runQuery = async (
  query: string,
  confirm: boolean = false,
): Promise<DbQueryResult> => {
  const response = await api.post(
    "/database/query",
    { query, confirm },
    { headers: dbAccessHeaders() },
  );
  return response.data.data;
};

export const getQueryHistory = async (
  params: { page?: number; limit?: number } = {},
): Promise<{
  data: DbQueryLogEntry[];
  total: number;
  page: number;
  limit: number;
}> => {
  const response = await api.get("/database/query/history", {
    params,
    headers: dbAccessHeaders(),
  });
  return response.data;
};

export const exportTable = async (
  table: string,
  format: "csv" | "sql",
): Promise<void> => {
  const response = await api.get(`/database/tables/${table}/export`, {
    params: { format },
    headers: dbAccessHeaders(),
    responseType: "blob",
  });

  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${table}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export interface DbServerStatus {
  version: string | null;
  uptime: number | null;
  threadsConnected: number | null;
  dbSizeMb: number;
}

export const getServerStatus = async (): Promise<DbServerStatus> => {
  const response = await api.get("/database/status", {
    headers: dbAccessHeaders(),
  });
  return response.data.data;
};
