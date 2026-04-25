export type IntegrationErrorCode =
  | "missingConfig"
  | "missingAuth"
  | "httpError"
  | "graphqlError"
  | "invalidResponse"
  | "notFound";

export type IntegrationError = {
  type: "integrationError";
  provider: "linear";
  code: IntegrationErrorCode;
  message: string;
  statusCode?: number;
};

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
