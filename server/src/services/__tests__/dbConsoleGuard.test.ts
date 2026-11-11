import { consoleScopeViolation } from "../dbConsoleGuard";

const scope = { currentDb: "tm_t7", databases: ["tm", "tm_t7", "tm_t8", "information_schema", "mysql", "sys", "performance_schema"] };
const ok = (sql: string) => expect(consoleScopeViolation(sql, scope)).toBeNull();
const refused = (sql: string) => expect(consoleScopeViolation(sql, scope)).not.toBeNull();

describe("DB console tenant scope", () => {
  it("allows ordinary reads on the current database", () => {
    ok("SELECT * FROM users");
    ok("SELECT u.id, u.email FROM users u JOIN courses c ON c.id = u.course_id WHERE u.id > 1.5");
    ok("SELECT `u`.`id` FROM `users` AS `u`");
    ok("SELECT * FROM tm_t7.users");
    ok("SELECT * FROM `tm_t7`.`users`");
    ok("SELECT * FROM users WHERE email = 'tm_t8.users' OR note = \"mysql\"");
    ok("SHOW TABLES");
    ok("SHOW FULL TABLES LIKE 'u%'");
    ok("SHOW TABLE STATUS");
    ok("SHOW COLUMNS FROM users");
    ok("SHOW INDEX FROM users");
    ok("SHOW CREATE TABLE users");
    ok("DESCRIBE users");
    ok("EXPLAIN SELECT * FROM users");
    ok("SELECT 1 -- tm_t8.users\n");
  });

  it("refuses another school's database however it is written", () => {
    refused("SELECT * FROM tm_t8.users");
    refused("SELECT * FROM `tm_t8`.`users`");
    refused("SELECT * FROM `tm_t8`.users");
    refused("SELECT * FROM tm_t8 . users");
    refused("SELECT * FROM TM_T8.users");
    refused("SELECT tm_t8.users.email FROM users");
    refused("SELECT * FROM users WHERE id IN (SELECT id FROM tm.users)");
    refused("DESCRIBE tm_t8.users");
    refused("SHOW CREATE TABLE tm_t8.users");
    refused("SELECT * FROM x.y.z");
  });

  it("refuses system schemas and database listings", () => {
    refused("SELECT * FROM information_schema.TABLES");
    refused("SELECT * FROM `INFORMATION_SCHEMA`.`SCHEMATA`");
    refused("SELECT * FROM mysql.user");
    refused("SELECT * FROM performance_schema.events_statements_history");
    refused("SELECT * FROM sys.schema_table_statistics");
    refused("SHOW DATABASES");
    refused("SHOW SCHEMAS");
    refused("SHOW TABLES FROM tm_t8");
    refused("SHOW TABLES IN tm_t8");
    refused("SHOW TABLE STATUS FROM tm_t8");
    refused("SHOW COLUMNS FROM users FROM tm_t8");
    refused("SHOW PROCESSLIST");
    refused("SHOW GRANTS");
  });

  it("refuses executable comments and unterminated input", () => {
    refused("SELECT 1 /*!, (SELECT email FROM tm_t8.users LIMIT 1) */");
    refused("SELECT 'abc");
    refused("SELECT `abc");
  });
});
