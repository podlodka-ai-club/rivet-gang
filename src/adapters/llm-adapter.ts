import type {IntegrationError, Result} from "../types/errors.js";

export type LlmAdapter = {
  verifyModelAccess(model: string): Promise<Result<void, IntegrationError>>;
};

export type LlmFetchLike = (
  url: string,
  init: {
    method: "GET";
    headers: Record<string, string>;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type OpenAiCompatibleLlmAdapterOptions = {
  provider: string;
  token: string;
  fetchFn?: LlmFetchLike;
  baseUrl: string;
};

export class OpenAiCompatibleLlmAdapter implements LlmAdapter {
  private readonly baseUrl: string;
  private readonly fetchFn: LlmFetchLike;
  private readonly provider: string;
  private readonly token: string;

  constructor(options: OpenAiCompatibleLlmAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchFn = options.fetchFn ?? fetch;
    this.provider = options.provider;
    this.token = options.token;
  }

  async verifyModelAccess(model: string): Promise<Result<void, IntegrationError>> {
    let response: Awaited<ReturnType<LlmFetchLike>>;

    try {
      response = await this.fetchFn(`${this.baseUrl}/models/${encodeURIComponent(model)}`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.token}`
        }
      });
    } catch (error) {
      return integrationError("httpError", error instanceof Error ? error.message : `${this.provider} request failed`);
    }

    let payload: OpenAiCompatiblePayload;
    try {
      payload = await response.json() as OpenAiCompatiblePayload;
    } catch {
      return integrationError("invalidResponse", `${this.provider} API returned invalid JSON`, response.status);
    }

    if (!response.ok) {
      return integrationError(
        response.status === 401 || response.status === 403 ? "missingAuth" : "httpError",
        payload.error?.message ?? `${this.provider} API request failed`,
        response.status
      );
    }

    if (typeof payload !== "object" || payload === null || !("id" in payload)) {
      return integrationError("invalidResponse", `${this.provider} API response did not include model metadata`, response.status);
    }

    return {ok: true, value: undefined};
  }
}

type OpenAiCompatiblePayload = {
  id?: string;
  error?: {message?: string};
};

function integrationError(code: IntegrationError["code"], message: string, statusCode?: number): Result<never, IntegrationError> {
  return {
    ok: false,
    error: {
      type: "integrationError",
      provider: "llm",
      code,
      message,
      statusCode
    }
  };
}
