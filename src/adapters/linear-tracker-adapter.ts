import type {
  TrackerAdapter,
  TrackerComment,
  TrackerIssueQuery,
  TrackerStatusUpdate
} from "./tracker-adapter.js";
import type {IntegrationError, Result} from "../types/errors.js";
import type {TrackerIssue} from "../types/task.js";

export const linearAgentCommentMarker = "<!-- rg:linear-agent-comment -->";

export type FetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type LinearTrackerAdapterOptions = {
  token: string;
  fetchFn?: FetchLike;
  endpoint?: string;
};

export class LinearTrackerAdapter implements TrackerAdapter {
  private readonly endpoint: string;
  private readonly fetchFn: FetchLike;
  private readonly token: string;

  constructor(options: LinearTrackerAdapterOptions) {
    this.endpoint = options.endpoint ?? "https://api.linear.app/graphql";
    this.fetchFn = options.fetchFn ?? fetch;
    this.token = options.token;
  }

  async verifyAccess(): Promise<Result<void, IntegrationError>> {
    const result = await this.graphql<{ viewer: { id: string } }>("query Viewer { viewer { id } }");
    if (!result.ok) {
      return result;
    }

    return { ok: true, value: undefined };
  }

  async listEligibleIssues(query: TrackerIssueQuery): Promise<Result<TrackerIssue[], IntegrationError>> {
    const result = await this.graphql<{ issues: { nodes: LinearIssueNode[] } }>(
      `query EligibleIssues {
        issues {
          nodes {
            id
            identifier
            title
            description
            url
            updatedAt
            state { name }
            labels { nodes { name } }
          }
        }
      }`
    );

    if (!result.ok) {
      return result;
    }

    const issues = result.value.issues.nodes
      .map(normalizeIssue)
      .filter((issue) => query.eligibleStatuses.includes(issue.state))
      .filter((issue) => issue.labels.includes(query.eligibilityLabel));

    return { ok: true, value: issues };
  }

  async updateStatus(update: TrackerStatusUpdate): Promise<Result<void, IntegrationError>> {
    const stateId = await this.resolveWorkflowStateId(update.statusName);
    if (!stateId.ok) {
      return stateId;
    }

    const result = await this.graphql<{ issueUpdate: { success: boolean } }>(
      `mutation IssueUpdate($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) {
          success
        }
      }`,
      { id: update.issueId, stateId: stateId.value }
    );

    if (!result.ok) {
      return result;
    }

    if (!result.value.issueUpdate.success) {
      return integrationError("invalidResponse", "Linear did not confirm the issue status update");
    }

    return { ok: true, value: undefined };
  }

  async addComment(comment: TrackerComment): Promise<Result<{ marker: string }, IntegrationError>> {
    const body = comment.body.includes(linearAgentCommentMarker)
      ? comment.body
      : `${linearAgentCommentMarker}\n${comment.body}`;

    const result = await this.graphql<{ commentCreate: { success: boolean } }>(
      `mutation CommentCreate($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
        }
      }`,
      { issueId: comment.issueId, body }
    );

    if (!result.ok) {
      return result;
    }

    if (!result.value.commentCreate.success) {
      return integrationError("invalidResponse", "Linear did not confirm comment creation");
    }

    return { ok: true, value: { marker: linearAgentCommentMarker } };
  }

  private async resolveWorkflowStateId(statusName: string): Promise<Result<string, IntegrationError>> {
    const result = await this.graphql<{ workflowStates: { nodes: Array<{ id: string; name: string }> } }>(
      `query WorkflowStates {
        workflowStates {
          nodes {
            id
            name
          }
        }
      }`
    );

    if (!result.ok) {
      return result;
    }

    const state = result.value.workflowStates.nodes.find((node) => node.name === statusName);
    if (!state) {
      return integrationError("notFound", `Linear workflow state was not found: ${statusName}`);
    }

    return { ok: true, value: state.id };
  }

  private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<Result<T, IntegrationError>> {
    let response: Awaited<ReturnType<FetchLike>>;

    try {
      response = await this.fetchFn(this.endpoint, {
        method: "POST",
        headers: {
          "authorization": this.token,
          "content-type": "application/json"
        },
        body: JSON.stringify({ query, variables })
      });
    } catch (error) {
      return integrationError("httpError", error instanceof Error ? error.message : "Linear request failed");
    }

    let payload: LinearGraphqlPayload<T>;
    try {
      payload = await response.json() as LinearGraphqlPayload<T>;
    } catch {
      return integrationError("invalidResponse", "Linear returned invalid JSON", response.status);
    }

    if (!response.ok) {
      return integrationError("httpError", "Linear HTTP request failed", response.status);
    }

    if (payload.errors && payload.errors.length > 0) {
      return integrationError("graphqlError", payload.errors.map((error) => error.message).join("; "), response.status);
    }

    if (!payload.data) {
      return integrationError("invalidResponse", "Linear response did not include data", response.status);
    }

    return { ok: true, value: payload.data };
  }
}

type LinearGraphqlPayload<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type LinearIssueNode = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string | null;
  updatedAt: string | null;
  state: { name: string } | null;
  labels: { nodes: Array<{ name: string }> } | null;
};

function normalizeIssue(issue: LinearIssueNode): TrackerIssue {
  return {
    providerId: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    state: issue.state?.name ?? "",
    labels: issue.labels?.nodes.map((label) => label.name) ?? [],
    url: issue.url,
    updatedAt: issue.updatedAt
  };
}

function integrationError(
  code: IntegrationError["code"],
  message: string,
  statusCode?: number
): Result<never, IntegrationError> {
  return {
    ok: false,
    error: {
      type: "integrationError",
      provider: "linear",
      code,
      message,
      statusCode
    }
  };
}
