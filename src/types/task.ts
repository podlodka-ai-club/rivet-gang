export type TrackerIssue = {
  providerId: string;
  identifier: string;
  title: string;
  description: string | null;
  state: string;
  labels: string[];
  url: string | null;
  updatedAt: string | null;
};
