export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: "VALIDATION" | "RATE_LIMIT" | "INTERNAL";
      message: string;
    };
