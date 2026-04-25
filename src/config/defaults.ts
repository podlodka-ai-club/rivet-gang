export const defaultConfigYaml = `tracker:
  provider: linear
  authEnv: GR_LINEAR_API_KEY
  team: null
  eligibleStatuses:
    - To Do
  inAnalysisStatus: In Analysis
  inReviewStatus: In Review
  blockedStatus: Blocked
  clarificationReturnStatus: To Do
  eligibilityLabel: ai-agent
vcs:
  provider: github
  defaultBranch: main
  branchPrefix: ai-agent
llm:
  provider: null
  model: null
  authEnv: GR_LLM_API_KEY
  baseUrl: null
validation:
  test: null
  lint: null
  typecheck: null
  secretScan: null
limits:
  maxParallelTasks: 1
  maxClarificationRounds: 1
  maxRepairAttempts: 2
killSwitch:
  enabled: false
`;

export const defaultRuntimeConfig = {
  tracker: {
    provider: "linear",
    authEnv: "GR_LINEAR_API_KEY",
    team: null,
    eligibleStatuses: ["To Do"],
    inAnalysisStatus: "In Analysis",
    inReviewStatus: "In Review",
    blockedStatus: "Blocked",
    clarificationReturnStatus: "To Do",
    eligibilityLabel: "ai-agent"
  },
  vcs: {
    provider: "github",
    defaultBranch: "main",
    branchPrefix: "ai-agent"
  },
  llm: {
    provider: null,
    model: null,
    authEnv: "GR_LLM_API_KEY",
    baseUrl: null
  },
  validation: {
    test: null,
    lint: null,
    typecheck: null,
    secretScan: null
  },
  limits: {
    maxParallelTasks: 1,
    maxClarificationRounds: 1,
    maxRepairAttempts: 2
  },
  killSwitch: {
    enabled: false
  }
};

export const defaultTrackerConfig = defaultRuntimeConfig.tracker;
