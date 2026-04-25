import type {IntegrationError, Result} from "../types/errors.js";
import type {TrackerIssue} from "../types/task.js";

export type TrackerIssueQuery = {
  eligibleStatuses: string[];
  eligibilityLabel: string;
};

export type TrackerStatusUpdate = {
  issueId: string;
  statusName: string;
};

export type TrackerComment = {
  issueId: string;
  body: string;
};

export interface TrackerAdapter {
  verifyAccess(): Promise<Result<void, IntegrationError>>;
  listEligibleIssues(query: TrackerIssueQuery): Promise<Result<TrackerIssue[], IntegrationError>>;
  updateStatus(update: TrackerStatusUpdate): Promise<Result<void, IntegrationError>>;
  addComment(comment: TrackerComment): Promise<Result<{ marker: string }, IntegrationError>>;
}
