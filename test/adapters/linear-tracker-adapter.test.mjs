import assert from "node:assert/strict";
import {test} from "node:test";
import {
  LinearTrackerAdapter,
  linearAgentCommentMarker
} from "../../dist/adapters/linear-tracker-adapter.js";

test("Linear adapter filters eligible issues by status and ai-agent label", async () => {
  const adapter = new LinearTrackerAdapter({
    token: "token",
    fetchFn: async () => response({
      data: {
        issues: {
          nodes: [
            issue({ id: "1", state: "To Do", labels: ["ai-agent"] }),
            issue({ id: "2", state: "To Do", labels: ["manual"] }),
            issue({ id: "3", state: "In Progress", labels: ["ai-agent"] })
          ]
        }
      }
    })
  });

  const result = await adapter.listEligibleIssues({
    eligibleStatuses: ["To Do"],
    eligibilityLabel: "ai-agent"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.map((item) => item.providerId), ["1"]);
});

test("Linear adapter normalizes GraphQL errors even when HTTP succeeds", async () => {
  const adapter = new LinearTrackerAdapter({
    token: "token",
    fetchFn: async () => response({
      errors: [{ message: "Authentication failed" }]
    })
  });

  const result = await adapter.verifyAccess();

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "graphqlError");
  assert.equal(result.error.provider, "linear");
});

test("Linear adapter updates issue status through workflow state lookup", async () => {
  const bodies = [];
  const adapter = new LinearTrackerAdapter({
    token: "token",
    fetchFn: async (_url, init) => {
      const body = JSON.parse(init.body);
      bodies.push(body);

      if (body.query.includes("WorkflowStates")) {
        return response({
          data: {
            workflowStates: {
              nodes: [{ id: "state-review", name: "In Review" }]
            }
          }
        });
      }

      return response({
        data: {
          issueUpdate: { success: true }
        }
      });
    }
  });

  const result = await adapter.updateStatus({ issueId: "RIV-1", statusName: "In Review" });

  assert.equal(result.ok, true);
  assert.equal(bodies[1].variables.id, "RIV-1");
  assert.equal(bodies[1].variables.stateId, "state-review");
});

test("Linear adapter adds stable marker to comments", async () => {
  let requestBody;
  const adapter = new LinearTrackerAdapter({
    token: "token",
    fetchFn: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return response({
        data: {
          commentCreate: { success: true }
        }
      });
    }
  });

  const result = await adapter.addComment({ issueId: "RIV-1", body: "Question?" });

  assert.equal(result.ok, true);
  assert.equal(result.value.marker, linearAgentCommentMarker);
  assert.match(requestBody.variables.body, new RegExp(linearAgentCommentMarker));
  assert.match(requestBody.variables.body, /Question\?/);
});

test("Linear adapter lists agent-labeled issues across statuses with pagination", async () => {
  const bodies = [];
  const adapter = new LinearTrackerAdapter({
    token: "token",
    fetchFn: async (_url, init) => {
      const body = JSON.parse(init.body);
      bodies.push(body);

      if (!body.variables.after) {
        return response({
          data: {
            issues: {
              nodes: [
                issue({id: "1", state: "To Do", labels: ["ai-agent"]}),
                issue({id: "2", state: "In Progress", labels: ["ai-agent"]})
              ],
              pageInfo: {hasNextPage: true, endCursor: "cursor-2"}
            }
          }
        });
      }

      return response({
        data: {
          issues: {
            nodes: [
              issue({id: "3", state: "Blocked", labels: ["ai-agent"]})
            ],
            pageInfo: {hasNextPage: false, endCursor: null}
          }
        }
      });
    }
  });

  const result = await adapter.listAgentIssues({
    eligibilityLabel: "ai-agent"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.map((item) => item.providerId), ["1", "2", "3"]);
  assert.equal(bodies[0].variables.labelName, "ai-agent");
  assert.equal(bodies[1].variables.after, "cursor-2");
});

test("Linear adapter normalizes agent-issue query errors", async () => {
  const adapter = new LinearTrackerAdapter({
    token: "token",
    fetchFn: async () => response({
      errors: [{message: "Bad request"}]
    })
  });

  const result = await adapter.listAgentIssues({
    eligibilityLabel: "ai-agent"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "graphqlError");
});

test("Linear adapter rejects inconsistent pagination metadata", async () => {
  const adapter = new LinearTrackerAdapter({
    token: "token",
    fetchFn: async () => response({
      data: {
        issues: {
          nodes: [
            issue({id: "1", state: "To Do", labels: ["ai-agent"]})
          ],
          pageInfo: {hasNextPage: true, endCursor: null}
        }
      }
    })
  });

  const result = await adapter.listAgentIssues({
    eligibilityLabel: "ai-agent"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalidResponse");
});

function response(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return payload;
    }
  };
}

function issue({ id, state, labels }) {
  return {
    id,
    identifier: `RIV-${id}`,
    title: `Issue ${id}`,
    description: null,
    url: `https://linear.app/example/issue/RIV-${id}`,
    updatedAt: "2026-04-25T12:00:00.000Z",
    state: { name: state },
    labels: {
      nodes: labels.map((name) => ({ name }))
    }
  };
}
