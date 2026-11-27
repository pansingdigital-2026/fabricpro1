/**
 * Database-agnostic query plan + a small chainable builder.
 *
 * The builder mirrors the tiny slice of the PostgREST-style API the CMS used
 * before the move to MySQL, so route/component code stays unchanged. Awaiting
 * a builder serializes it to a plain JSON plan and hands it to a runner:
 *
 *   - on the server the runner executes SQL against MySQL directly
 *   - in the browser the runner posts the plan to an authenticated server fn
 *
 * This module is isomorphic: no node imports, no secrets.
 */

export type FilterOp =
  | "eq"
  | "neq"
  | "in"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "like"
  | "is"
  | "not_is";

export interface Filter {
  col: string;
  op: FilterOp;
  value: unknown;
}

export interface OrderBy {
  col: string;
  asc: boolean;
}

export interface QueryPlan {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  select?: string | undefined;
  filters: Filter[];
  /** Raw PostgREST-style `or` groups, e.g. "title.like.%x%,excerpt.like.%x%". */
  or?: string[];
  order: OrderBy[];
  limit?: number | undefined;
  offset?: number | undefined;
  count?: boolean;
  single?: "one" | "maybe" | undefined;
  values?: Record<string, unknown> | Record<string, unknown>[] | undefined;
  onConflict?: string | undefined;
  returning?: boolean;
}

export interface DbError {
  message: string;
  code?: string;
}

// Results are dynamically shaped by the caller's `select`, so `any` keeps the
// call sites (which cast to their own types) ergonomic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DbResult<T = any> {
  data: T;
  error: DbError | null;
  count: number | null;
}

export type PlanRunner = (plan: QueryPlan) => Promise<DbResult>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Builder<T = any> implements PromiseLike<DbResult<T>> {
  private plan: QueryPlan;
  private run: PlanRunner;

  constructor(run: PlanRunner, plan: QueryPlan) {
    this.run = run;
    this.plan = plan;
  }

  private add(f: Filter) {
    this.plan.filters.push(f);
    return this;
  }

  select(select?: string, opts?: { count?: "exact" }) {
    if (this.plan.op === "select") this.plan.select = select ?? "*";
    else this.plan.returning = true;
    if (opts?.count === "exact") this.plan.count = true;
    return this;
  }

  eq(col: string, value: unknown) {
    return this.add({ col, op: "eq", value });
  }
  neq(col: string, value: unknown) {
    return this.add({ col, op: "neq", value });
  }
  in(col: string, value: unknown[]) {
    return this.add({ col, op: "in", value });
  }
  lt(col: string, value: unknown) {
    return this.add({ col, op: "lt", value });
  }
  lte(col: string, value: unknown) {
    return this.add({ col, op: "lte", value });
  }
  gt(col: string, value: unknown) {
    return this.add({ col, op: "gt", value });
  }
  gte(col: string, value: unknown) {
    return this.add({ col, op: "gte", value });
  }
  like(col: string, value: string) {
    return this.add({ col, op: "like", value });
  }
  ilike(col: string, value: string) {
    return this.add({ col, op: "like", value });
  }
  is(col: string, value: unknown) {
    return this.add({ col, op: "is", value });
  }
  /** Only `not(col, "is", null)` is used by the CMS. */
  not(col: string, op: string, value: unknown) {
    if (op === "is") return this.add({ col, op: "not_is", value });
    return this.add({ col, op: "neq", value });
  }
  or(expr: string) {
    (this.plan.or ??= []).push(expr);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.plan.order.push({ col, asc: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.plan.limit = n;
    return this;
  }
  range(from: number, to: number) {
    this.plan.offset = from;
    this.plan.limit = to - from + 1;
    return this;
  }
  single() {
    this.plan.single = "one";
    return this;
  }
  maybeSingle() {
    this.plan.single = "maybe";
    return this;
  }

  toPlan(): QueryPlan {
    return this.plan;
  }

  then<R1 = DbResult<T>, R2 = never>(
    onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run(this.plan).then(
      (r) => r as DbResult<T>,
      (e: unknown) => ({
        data: null,
        error: { message: e instanceof Error ? e.message : String(e) },
        count: null,
      }) as DbResult<T>,
    ).then(onfulfilled, onrejected);
  }
}

function basePlan(table: string, op: QueryPlan["op"]): QueryPlan {
  return { table, op, filters: [], order: [] };
}

export interface TableRef {
  select(select?: string, opts?: { count?: "exact" }): Builder;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): Builder;
  update(values: Record<string, unknown>): Builder;
  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string },
  ): Builder;
  delete(): Builder;
}

export interface DbClient {
  from(table: string): TableRef;
}

export function createDbClient(run: PlanRunner): DbClient {
  return {
    from(table: string): TableRef {
      return {
        select(select, opts) {
          const b = new Builder(run, basePlan(table, "select"));
          return b.select(select ?? "*", opts);
        },
        insert(values) {
          const plan = basePlan(table, "insert");
          plan.values = values;
          return new Builder(run, plan);
        },
        update(values) {
          const plan = basePlan(table, "update");
          plan.values = values;
          return new Builder(run, plan);
        },
        upsert(values, opts) {
          const plan = basePlan(table, "upsert");
          plan.values = values;
          plan.onConflict = opts?.onConflict;
          return new Builder(run, plan);
        },
        delete() {
          return new Builder(run, basePlan(table, "delete"));
        },
      };
    },
  };
}
