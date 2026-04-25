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
