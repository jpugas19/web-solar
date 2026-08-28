import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon<false>> | null = null;

export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, any>[]> {
  if (!_sql) {
    _sql = neon<false>(process.env.DATABASE_URL!);
  }
  return _sql(strings, ...values);
}
