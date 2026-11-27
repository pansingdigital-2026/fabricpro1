/**
 * SERVER-ONLY MySQL connection pool + query-plan executor.
 *
 * Configuration comes from the hosting environment:
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */
import mysql from "mysql2/promise";

import {
  BOOL_COLUMNS,
  JSON_COLUMNS,
  KNOWN_TABLES,
  PUBLIC_READABLE,
  RELATIONS,
  type Relation,
} from "./schema";
import type { DbResult, Filter, QueryPlan } from "./plan";
import { mysqlDateTime } from "./datetime";

let pool: mysql.Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env["DB_HOST"] && process.env["DB_NAME"] && process.env["DB_USER"]);
}

export function getPool(): mysql.Pool {
  if (pool) return pool;
  if (!isDatabaseConfigured()) {
    throw new Error(
      "Database is not configured. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME.",
    );
  }
  pool = mysql.createPool({
    host: process.env["DB_HOST"]!,
    port: Number(process.env["DB_PORT"] ?? 3306),
    user: process.env["DB_USER"]!,
    password: process.env["DB_PASSWORD"] ?? "",
    database: process.env["DB_NAME"]!,
    waitForConnections: true,
    connectionLimit: Number(process.env["DB_POOL_SIZE"] ?? 8),
    maxIdle: 4,
    idleTimeout: 30_000,
    enableKeepAlive: true,
    timezone: "Z",
    charset: "utf8mb4_general_ci",
    supportBigNumbers: true,
  });
  return pool;
}

export async function sql<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const [rows] = await getPool().query(query, params);
  return rows as T[];
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return `\`${name}\``;
}

function assertTable(table: string) {
  if (!KNOWN_TABLES.includes(table)) throw new Error(`Unknown table: ${table}`);
}

function isJsonCol(table: string, col: string) {
  return (JSON_COLUMNS[table] ?? []).includes(col);
}

function encode(table: string, col: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (isJsonCol(table, col)) return JSON.stringify(value ?? null);
  if (["published_at", "scheduled_for", "created_at", "updated_at"].includes(col))
    return mysqlDateTime(value);
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function decodeRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const bools = BOOL_COLUMNS[table] ?? [];
  const jsons = JSON_COLUMNS[table] ?? [];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (bools.includes(k)) out[k] = Boolean(v);
    else if (jsons.includes(k) && typeof v === "string") {
      try {
        out[k] = JSON.parse(v);
      } catch {
        out[k] = v;
      }
    } else out[k] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* select parsing                                                      */
/* ------------------------------------------------------------------ */

interface Embed {
  alias: string;
  relationKey: string;
  select: string;
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function parseSelect(select: string): { columns: string[]; embeds: Embed[] } {
  const columns: string[] = [];
  const embeds: Embed[] = [];
  for (const token of splitTopLevel(select)) {
    const match = /^(?:([a-zA-Z0-9_]+):)?([a-zA-Z0-9_]+)\((.*)\)$/.exec(token);
    if (match) {
      embeds.push({
        alias: match[1] ?? match[2]!,
        relationKey: match[2]!,
        select: match[3]!,
      });
    } else if (token === "*" || IDENT.test(token)) {
      columns.push(token);
    }
  }
  return { columns, embeds };
}

/* ------------------------------------------------------------------ */
/* where building                                                      */
/* ------------------------------------------------------------------ */

function filterSql(table: string, f: Filter, params: unknown[]): string {
  const col = ident(f.col);
  switch (f.op) {
    case "in": {
      const list = (f.value as unknown[]) ?? [];
      if (!list.length) return "1 = 0";
      params.push(...list.map((v) => encode(table, f.col, v)));
      return `${col} IN (${list.map(() => "?").join(", ")})`;
    }
    case "is":
      if (f.value === null) return `${col} IS NULL`;
      params.push(encode(table, f.col, f.value));
      return `${col} <=> ?`;
    case "not_is":
      if (f.value === null) return `${col} IS NOT NULL`;
      params.push(encode(table, f.col, f.value));
      return `NOT (${col} <=> ?)`;
    case "like":
      params.push(f.value);
      return `${col} LIKE ?`;
    case "neq":
      params.push(encode(table, f.col, f.value));
      return `${col} <> ?`;
    default: {
      const map: Record<string, string> = { eq: "=", lt: "<", lte: "<=", gt: ">", gte: ">=" };
      params.push(encode(table, f.col, f.value));
      return `${col} ${map[f.op] ?? "="} ?`;
    }
  }
}

function orSql(table: string, expr: string, params: unknown[]): string {
  const parts = splitTopLevel(expr).map((clause) => {
    const first = clause.indexOf(".");
    const second = clause.indexOf(".", first + 1);
    if (first < 0 || second < 0) return "1 = 1";
    const col = clause.slice(0, first);
    const op = clause.slice(first + 1, second);
    const raw = clause.slice(second + 1);
    const value = raw === "null" ? null : raw;
    const opMap: Record<string, Filter["op"]> = {
      eq: "eq",
      neq: "neq",
      like: "like",
      ilike: "like",
      lt: "lt",
      lte: "lte",
      gt: "gt",
      gte: "gte",
      is: "is",
    };
    return filterSql(table, { col, op: opMap[op] ?? "eq", value }, params);
  });
  return `(${parts.join(" OR ")})`;
}

function buildWhere(plan: QueryPlan, params: unknown[]): string {
  const clauses = plan.filters.map((f) => filterSql(plan.table, f, params));
  for (const expr of plan.or ?? []) clauses.push(orSql(plan.table, expr, params));
  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

/* ------------------------------------------------------------------ */
/* embeds                                                              */
/* ------------------------------------------------------------------ */

async function attachEmbeds(table: string, rows: Record<string, unknown>[], embeds: Embed[]) {
  if (!rows.length) return;
  for (const embed of embeds) {
    const rel: Relation | undefined = RELATIONS[table]?.[embed.relationKey];
    if (!rel) continue;
    const inner = parseSelect(embed.select);

    if (rel.kind === "one") {
      const ids = [...new Set(rows.map((r) => r[rel.fk]).filter(Boolean))];
      if (!ids.length) {
        for (const r of rows) r[embed.alias] = null;
        continue;
      }
      const cols = inner.columns.includes("*")
        ? "*"
        : [...new Set([rel.pk, ...inner.columns])].map(ident).join(", ");
      const found = await sql(
        `SELECT ${cols} FROM ${ident(rel.table)} WHERE ${ident(rel.pk)} IN (${ids
          .map(() => "?")
          .join(", ")})`,
        ids,
      );
      const decoded = found.map((r) => decodeRow(rel.table, r));
      await attachEmbeds(rel.table, decoded, inner.embeds);
      const byId = new Map(decoded.map((r) => [r[rel.pk], r]));
      for (const r of rows) r[embed.alias] = byId.get(r[rel.fk]) ?? null;
    } else {
      const keys = [...new Set(rows.map((r) => r[rel.parentKey]).filter(Boolean))];
      if (!keys.length) {
        for (const r of rows) r[embed.alias] = [];
        continue;
      }
      const found = await sql(
        `SELECT * FROM ${ident(rel.table)} WHERE ${ident(rel.childKey)} IN (${keys
          .map(() => "?")
          .join(", ")})`,
        keys,
      );
      const decoded = found.map((r) => decodeRow(rel.table, r));
      await attachEmbeds(rel.table, decoded, inner.embeds);
      for (const r of rows) {
        r[embed.alias] = decoded.filter((c) => c[rel.childKey] === r[rel.parentKey]);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* executor                                                            */
/* ------------------------------------------------------------------ */

export interface ExecuteOptions {
  /** Public (signed-out) callers may only read whitelisted tables. */
  publicOnly?: boolean;
}

export async function executePlan(
  plan: QueryPlan,
  options: ExecuteOptions = {},
): Promise<DbResult> {
  try {
    assertTable(plan.table);
    if (options.publicOnly) {
      if (plan.op !== "select" || !PUBLIC_READABLE.has(plan.table)) {
        throw new Error("Not allowed");
      }
    }
    return await run(plan);
  } catch (e) {
    return {
      data: null,
      error: { message: e instanceof Error ? e.message : String(e) },
      count: null,
    };
  }
}

function shape(plan: QueryPlan, rows: Record<string, unknown>[], count: number | null): DbResult {
  if (plan.single) {
    if (!rows.length) {
      if (plan.single === "one") return { data: null, error: { message: "No rows found" }, count };
      return { data: null, error: null, count };
    }
    return { data: rows[0]!, error: null, count };
  }
  return { data: rows, error: null, count };
}

async function run(plan: QueryPlan): Promise<DbResult> {
  switch (plan.op) {
    case "select":
      return runSelect(plan);
    case "insert":
      return runInsert(plan);
    case "update":
      return runUpdate(plan);
    case "upsert":
      return runUpsert(plan);
    case "delete":
      return runDelete(plan);
  }
}

async function runSelect(plan: QueryPlan): Promise<DbResult> {
  const parsed = parseSelect(plan.select ?? "*");
  const relations = RELATIONS[plan.table] ?? {};
  const needed = new Set<string>(parsed.columns);
  for (const embed of parsed.embeds) {
    const rel = relations[embed.relationKey];
    if (!rel) continue;
    needed.add(rel.kind === "one" ? rel.fk : rel.parentKey);
  }
  const cols =
    parsed.columns.includes("*") || !needed.size ? "*" : [...needed].map(ident).join(", ");

  const params: unknown[] = [];
  const where = buildWhere(plan, params);

  let count: number | null = null;
  if (plan.count) {
    const countParams: unknown[] = [];
    const countWhere = buildWhere(plan, countParams);
    const res = await sql<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${ident(plan.table)}${countWhere}`,
      countParams,
    );
    count = Number(res[0]?.n ?? 0);
  }

  const order = plan.order.length
    ? ` ORDER BY ${plan.order.map((o) => `${ident(o.col)} ${o.asc ? "ASC" : "DESC"}`).join(", ")}`
    : "";
  const limit = plan.single && !plan.limit ? 1 : plan.limit;
  const limitSql = limit ? ` LIMIT ${Number(limit)}` : "";
  const offsetSql = plan.offset ? ` OFFSET ${Number(plan.offset)}` : "";

  const rows = await sql(
    `SELECT ${cols} FROM ${ident(plan.table)}${where}${order}${limitSql}${offsetSql}`,
    params,
  );
  const decoded = rows.map((r) => decodeRow(plan.table, r));
  await attachEmbeds(plan.table, decoded, parsed.embeds);
  return shape(plan, decoded, count);
}

function asRows(values: QueryPlan["values"]): Record<string, unknown>[] {
  if (!values) return [];
  return Array.isArray(values) ? values : [values];
}

async function selectByIds(table: string, ids: unknown[]): Promise<Record<string, unknown>[]> {
  if (!ids.length) return [];
  const rows = await sql(
    `SELECT * FROM ${ident(table)} WHERE \`id\` IN (${ids.map(() => "?").join(", ")})`,
    ids,
  );
  return rows.map((r) => decodeRow(table, r));
}

async function runInsert(plan: QueryPlan): Promise<DbResult> {
  const rows = asRows(plan.values);
  const hasId = plan.table !== "content_tags" && plan.table !== "site_settings";
  const ids: unknown[] = [];
  for (const row of rows) {
    const record = { ...row };
    if (hasId && !record["id"]) record["id"] = crypto.randomUUID();
    if (hasId) ids.push(record["id"]);
    const keys = Object.keys(record);
    const params = keys.map((k) => encode(plan.table, k, record[k]));
    await sql(
      `INSERT INTO ${ident(plan.table)} (${keys.map(ident).join(", ")}) VALUES (${keys
        .map(() => "?")
        .join(", ")})`,
      params,
    );
  }
  if (!plan.returning) return shape(plan, [], null);
  return shape(plan, await selectByIds(plan.table, ids), null);
}

async function runUpdate(plan: QueryPlan): Promise<DbResult> {
  const values = { ...(plan.values as Record<string, unknown>) };
  delete values["id"];
  const keys = Object.keys(values);
  if (!keys.length) return shape(plan, [], null);
  const params: unknown[] = keys.map((k) => encode(plan.table, k, values[k]));
  const where = buildWhere(plan, params);
  if (!where) throw new Error("Refusing to update every row");
  await sql(
    `UPDATE ${ident(plan.table)} SET ${keys.map((k) => `${ident(k)} = ?`).join(", ")}${where}`,
    params,
  );
  if (!plan.returning) return shape(plan, [], null);
  const readParams: unknown[] = [];
  const readWhere = buildWhere(plan, readParams);
  const rows = await sql(`SELECT * FROM ${ident(plan.table)}${readWhere}`, readParams);
  return shape(
    plan,
    rows.map((r) => decodeRow(plan.table, r)),
    null,
  );
}

async function runUpsert(plan: QueryPlan): Promise<DbResult> {
  const rows = asRows(plan.values);
  const ids: unknown[] = [];
  const hasId = plan.table !== "content_tags" && plan.table !== "site_settings";
  for (const row of rows) {
    const record = { ...row };
    if (hasId && !record["id"]) record["id"] = crypto.randomUUID();
    if (hasId) ids.push(record["id"]);
    const keys = Object.keys(record);
    const params = keys.map((k) => encode(plan.table, k, record[k]));
    const updates = keys.filter((k) => k !== "id").map((k) => `${ident(k)} = VALUES(${ident(k)})`);
    await sql(
      `INSERT INTO ${ident(plan.table)} (${keys.map(ident).join(", ")}) VALUES (${keys
        .map(() => "?")
        .join(", ")})` + (updates.length ? ` ON DUPLICATE KEY UPDATE ${updates.join(", ")}` : ""),
      params,
    );
  }
  if (!plan.returning) return shape(plan, [], null);
  return shape(plan, await selectByIds(plan.table, ids), null);
}

async function runDelete(plan: QueryPlan): Promise<DbResult> {
  const params: unknown[] = [];
  const where = buildWhere(plan, params);
  if (!where) throw new Error("Refusing to delete every row");
  await sql(`DELETE FROM ${ident(plan.table)}${where}`, params);
  return shape(plan, [], null);
}
