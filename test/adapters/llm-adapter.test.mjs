import assert from "node:assert/strict";
import {test} from "node:test";
import {OpenAiCompatibleLlmAdapter} from "../../dist/adapters/llm-adapter.js";

test("OpenAI-compatible LLM adapter verifies model access with bearer auth", async () => {
  const seen = [];
  const fetchFn = async (url, init) => {
    seen.push({url, init});
    return {
      ok: true,
      status: 200,
      async json() {
        return {id: "gpt-test"};
      }
    };
  };

  const adapter = new OpenAiCompatibleLlmAdapter({
    provider: "openai-compatible",
    token: "llm-secret",
    baseUrl: "https://llm.example/v1/",
    fetchFn
  });
  const result = await adapter.verifyModelAccess("gpt-test");

  assert.equal(result.ok, true);
  assert.equal(seen[0].url, "https://llm.example/v1/models/gpt-test");
  assert.equal(seen[0].init.method, "GET");
  assert.equal(seen[0].init.headers.authorization, "Bearer llm-secret");
});

test("OpenAI-compatible LLM adapter normalizes HTTP authentication failures", async () => {
  const adapter = new OpenAiCompatibleLlmAdapter({
    provider: "openai-compatible",
    token: "llm-secret",
    baseUrl: "https://llm.example/v1",
    fetchFn: async () => ({
      ok: false,
      status: 401,
      async json() {
        return {error: {message: "bad token"}};
      }
    })
  });

  const result = await adapter.verifyModelAccess("gpt-test");

  assert.equal(result.ok, false);
  assert.equal(result.error.provider, "llm");
  assert.equal(result.error.code, "missingAuth");
  assert.equal(result.error.statusCode, 401);
  assert.doesNotMatch(result.error.message, /llm-secret/);
});

test("OpenAI-compatible LLM adapter normalizes invalid JSON", async () => {
  const adapter = new OpenAiCompatibleLlmAdapter({
    provider: "openai-compatible",
    token: "llm-secret",
    baseUrl: "https://llm.example/v1",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      async json() {
        throw new Error("not json");
      }
    })
  });

  const result = await adapter.verifyModelAccess("gpt-test");

  assert.equal(result.ok, false);
  assert.equal(result.error.provider, "llm");
  assert.equal(result.error.code, "invalidResponse");
});
