/**
 * Tenant scope of the admin DB console (POST /api/database/query).
 *
 * One MySQL database per school, and the app's pool user can reach every
 * school's database (the tenant router switches with USE). The console runs
 * a school admin's free-form SQL on that same pool, so on top of "read-only"
 * it must keep the statement inside the current school's database:
 *
 *   - no database-qualified name (`other.t`, `other`.`t`, other . t,
 *     a.b.c) unless the qualifier IS the current database;
 *   - no reference at all to information_schema, mysql,
 *     performance_schema or sys (they list / expose every database);
 *   - SHOW only as SHOW [FULL] TABLES / TABLE STATUS (no FROM/IN),
 *     SHOW [FULL] COLUMNS|FIELDS / INDEX|INDEXES|KEYS FROM t (one FROM/IN),
 *     SHOW CREATE TABLE|VIEW t -- never SHOW DATABASES, PROCESSLIST, GRANTS…;
 *   - no MySQL executable comments (`/*! … *\/`), which run their body.
 *
 * This is a parser-free check over a tokenised statement (string literals
 * and comments removed), so it errs on the side of refusing.
 *
 * Defence in depth (recommended for production): give the console its own
 * MySQL user whose grants cover only the school's database, e.g.
 *
 *   CREATE USER 'tm_console_t7'@'127.0.0.1' IDENTIFIED BY '…';
 *   GRANT SELECT, SHOW VIEW ON `<DB_NAME>_t7`.* TO 'tm_console_t7'@'127.0.0.1';
 *
 * (DB_NAME itself for the primary school). With such a user even a gap in
 * this check could not read another school's database. Keep sql_mode
 * without ANSI_QUOTES: this check treats "…" as a string literal.
 */

export const SYSTEM_SCHEMAS = ["information_schema", "mysql", "performance_schema", "sys"];

type Token = { kind: "word" | "quoted" | "dot" | "other"; text: string };

/** Split SQL into identifiers/words, backtick identifiers, dots and the rest; drop strings and comments. */
export function tokenize(sql: string): { tokens: Token[]; executableComment: boolean; unterminated: boolean } {
  const tokens: Token[] = [];
  let executableComment = false;
  let unterminated = false;
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "/" && next === "*") {
      if (sql[i + 2] === "!" || sql[i + 2] === "+") executableComment = true;
      const end = sql.indexOf("*/", i + 2);
      if (end < 0) {
        unterminated = true;
        break;
      }
      i = end + 2;
    } else if (c === "#" || (c === "-" && next === "-" && (i + 2 >= n || /\s/.test(sql[i + 2])))) {
      const end = sql.indexOf("\n", i);
      i = end < 0 ? n : end + 1;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (sql[j] === "\\") j += 2;
        else if (sql[j] === c && sql[j + 1] === c) j += 2;
        else if (sql[j] === c) {
          closed = true;
          break;
        } else j++;
      }
      if (!closed) {
        unterminated = true;
        break;
      }
      tokens.push({ kind: "other", text: "''" });
      i = j + 1;
    } else if (c === "`") {
      let j = i + 1;
      let text = "";
      let closed = false;
      while (j < n) {
        if (sql[j] === "`" && sql[j + 1] === "`") {
          text += "`";
          j += 2;
        } else if (sql[j] === "`") {
          closed = true;
          break;
        } else text += sql[j++];
      }
      if (!closed) {
        unterminated = true;
        break;
      }
      tokens.push({ kind: "quoted", text });
      i = j + 1;
    } else if (c === ".") {
      tokens.push({ kind: "dot", text: "." });
      i++;
    } else if (/[A-Za-z0-9_$\u0080-￿]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$\u0080-￿]/.test(sql[j])) j++;
      tokens.push({ kind: "word", text: sql.slice(i, j) });
      i = j;
    } else {
      tokens.push({ kind: "other", text: c });
      i++;
    }
  }
  return { tokens, executableComment, unterminated };
}

const NUMBER_RE = /^\d+(e\d*)?$/i;
const isNumber = (t: Token | undefined) => !!t && t.kind === "word" && NUMBER_RE.test(t.text);
const isIdent = (t: Token | undefined) => !!t && (t.kind === "quoted" || (t.kind === "word" && !isNumber(t)));

export interface ConsoleScope {
  /** The database the statement will run in (SELECT DATABASE()). */
  currentDb: string;
  /** Every database the server lets this connection see (SCHEMATA); qualifiers naming one are refused. */
  databases?: string[];
}

/** Why the statement may not run in the console, or null when it stays in the current database. */
export function consoleScopeViolation(sql: string, scope: ConsoleScope): string | null {
  const { tokens, executableComment, unterminated } = tokenize(sql);
  if (executableComment) return "MySQL executable comments (/*! … */) are not allowed.";
  if (unterminated) return "The statement has an unterminated string, identifier or comment.";
  const current = scope.currentDb.toLowerCase();
  const known = new Set((scope.databases ?? []).map((d) => d.toLowerCase()));

  for (const t of tokens) {
    if ((t.kind === "word" || t.kind === "quoted") && SYSTEM_SCHEMAS.includes(t.text.toLowerCase())) {
      return `References to ${t.text.toLowerCase()} are not allowed.`;
    }
  }

  // Qualified names: walk every ident (. ident)+ chain.
  for (let i = 0; i < tokens.length; i++) {
    if (!isIdent(tokens[i]) || tokens[i - 1]?.kind === "dot") continue;
    // A decimal like 1.5 / 1.e5 is not a name.
    if (isNumber(tokens[i])) continue;
    const parts = [tokens[i].text];
    let j = i;
    while (tokens[j + 1]?.kind === "dot" && (isIdent(tokens[j + 2]) || tokens[j + 2]?.text === "*")) {
      parts.push(tokens[j + 2].text);
      j += 2;
    }
    if (parts.length < 2) continue;
    const qualifier = parts[0].toLowerCase();
    if (qualifier === current) continue;
    // db.table.column: the first part is always a database.
    if (parts.length >= 3) return `Only the current database (${scope.currentDb}) may be queried.`;
    // x.y: a database when x names one the server knows (else table.column / alias.column).
    if (known.has(qualifier)) return `Only the current database (${scope.currentDb}) may be queried.`;
    i = j;
  }

  const words = tokens.filter((t) => t.kind === "word").map((t) => t.text.toUpperCase());
  if (words[0] === "SHOW") return showViolation(words);
  return null;
}

function showViolation(words: string[]): string | null {
  const rest = words[1] === "FULL" ? words.slice(2) : words.slice(1);
  const fromCount = rest.filter((w) => w === "FROM" || w === "IN").length;
  const head = rest[0];
  const refuse = "Only SHOW TABLES, SHOW TABLE STATUS, SHOW COLUMNS, SHOW INDEX and SHOW CREATE TABLE/VIEW of the current database are allowed.";
  if (head === "TABLES") return fromCount === 0 ? null : refuse;
  if (head === "TABLE" && rest[1] === "STATUS") return fromCount === 0 ? null : refuse;
  if (head === "COLUMNS" || head === "FIELDS" || head === "INDEX" || head === "INDEXES" || head === "KEYS") {
    return fromCount === 1 ? null : refuse;
  }
  if (head === "CREATE" && (rest[1] === "TABLE" || rest[1] === "VIEW")) return null;
  return refuse;
}
