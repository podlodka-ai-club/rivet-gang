import {readFile, stat} from "node:fs/promises";
import {dirname, isAbsolute, join, resolve} from "node:path";

export type VcsReadinessConfig = {
  provider: string;
  defaultBranch: string;
  branchPrefix: string;
};

export type VcsReadinessResult =
  | { status: "pass"; message: string }
  | { status: "fail"; message: string };

export async function checkVcsReadiness(cwd: string, config: VcsReadinessConfig): Promise<VcsReadinessResult> {
  if (config.provider !== "github" || config.defaultBranch.trim() === "" || config.branchPrefix.trim() === "") {
    return {
      status: "fail",
      message: "github provider, default branch, and branch prefix are required. Fix: set vcs.provider, vcs.defaultBranch, and vcs.branchPrefix in .ai-agent/config.yaml."
    };
  }

  if (!isSafeBranchName(config.defaultBranch)) {
    return {
      status: "fail",
      message: `default branch ${config.defaultBranch} is not a valid ref name. Fix: update vcs.defaultBranch in .ai-agent/config.yaml.`
    };
  }

  if (!isSafeBranchName(config.branchPrefix)) {
    return {
      status: "fail",
      message: `branch prefix ${config.branchPrefix} is not a valid ref prefix. Fix: update vcs.branchPrefix in .ai-agent/config.yaml.`
    };
  }

  const gitDir = await findGitDir(cwd);
  if (gitDir === null) {
    return {
      status: "fail",
      message: "git repository metadata is not available. Fix: run rg doctor from a Git repository checkout."
    };
  }

  if (!await isFile(join(gitDir, "HEAD"))) {
    return {
      status: "fail",
      message: "git HEAD is not available. Fix: repair the local Git checkout and rerun rg doctor."
    };
  }

  if (!await hasBranchRef(gitDir, config.defaultBranch)) {
    return {
      status: "fail",
      message: `default branch ${config.defaultBranch} is not available locally or as origin/${config.defaultBranch}. Fix: fetch the default branch or update vcs.defaultBranch in .ai-agent/config.yaml.`
    };
  }

  return {
    status: "pass",
    message: `github configured for ${config.defaultBranch}; git repository and default branch are available`
  };
}

async function findGitDir(cwd: string): Promise<string | null> {
  const dotGit = join(cwd, ".git");

  try {
    const dotGitStat = await stat(dotGit);
    if (dotGitStat.isDirectory()) {
      return dotGit;
    }

    if (!dotGitStat.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  let text: string;
  try {
    text = await readFile(dotGit, "utf8");
  } catch {
    return null;
  }

  const match = text.match(/^gitdir:\s*(.+)\s*$/m);
  if (!match) {
    return null;
  }

  return isAbsolute(match[1]) ? match[1] : resolve(dirname(dotGit), match[1]);
}

async function hasBranchRef(gitDir: string, branch: string): Promise<boolean> {
  const commonGitDir = await findCommonGitDir(gitDir);
  const gitDirs = commonGitDir === gitDir ? [gitDir] : [gitDir, commonGitDir];

  for (const candidateGitDir of gitDirs) {
    if (await hasBranchRefIn(candidateGitDir, branch)) {
      return true;
    }
  }

  return false;
}

async function findCommonGitDir(gitDir: string): Promise<string> {
  try {
    const text = await readFile(join(gitDir, "commondir"), "utf8");
    const commonDir = text.trim();
    if (commonDir === "") {
      return gitDir;
    }

    return isAbsolute(commonDir) ? commonDir : resolve(gitDir, commonDir);
  } catch {
    return gitDir;
  }
}

async function hasBranchRefIn(gitDir: string, branch: string): Promise<boolean> {
  return await isUsableLooseRef(join(gitDir, "refs", "heads", ...branch.split("/")))
    || await isUsableLooseRef(join(gitDir, "refs", "remotes", "origin", ...branch.split("/")))
    || await packedRefsContain(gitDir, branch);
}

async function packedRefsContain(gitDir: string, branch: string): Promise<boolean> {
  try {
    const text = await readFile(join(gitDir, "packed-refs"), "utf8");
    return text.split(/\r?\n/).some((line) => {
      return isPackedRefLine(line, `refs/heads/${branch}`) || isPackedRefLine(line, `refs/remotes/origin/${branch}`);
    });
  } catch {
    return false;
  }
}

async function isUsableLooseRef(path: string): Promise<boolean> {
  try {
    const refStat = await stat(path);
    if (!refStat.isFile()) {
      return false;
    }

    const text = await readFile(path, "utf8");
    return isUsableRefValue(text.trim());
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

function isPackedRefLine(line: string, refName: string): boolean {
  if (line.startsWith("#") || line.startsWith("^")) {
    return false;
  }

  const [value, name] = line.split(" ");
  return name === refName && isUsableRefValue(value);
}

function isUsableRefValue(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value) && !/^0{40}$/.test(value);
}

function isSafeBranchName(branch: string): boolean {
  if (branch.trim() !== branch || branch === "" || isAbsolute(branch)) {
    return false;
  }

  if (
    branch === "@"
    || branch.endsWith(".")
    || branch.includes("..")
    || branch.includes("@{")
    || /[\x00-\x20~^:?*[\\]/.test(branch)
  ) {
    return false;
  }

  return !branch.split("/").some((part) => {
    return part === "" || part === "." || part === ".." || part.startsWith(".") || part.endsWith(".lock");
  });
}
