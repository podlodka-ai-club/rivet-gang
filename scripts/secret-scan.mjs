import {readFile, readdir} from "node:fs/promises";
import {join, relative} from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".ai-agent",
  ".git",
  ".agents",
  ".claude",
  "_bmad",
  "dist",
  "node_modules"
]);

const ignoredFiles = new Set([
  "package-lock.json"
]);

const secretPatterns = [
  {name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{30,}/g},
  {name: "Linear API key", pattern: /lin_api_[0-9A-Za-z_-]{20,}/g},
  {name: "OpenAI API key", pattern: /sk-[0-9A-Za-z_-]{32,}/g},
  {name: "GitHub token", pattern: /(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36,}/g},
  {name: "GitHub fine-grained token", pattern: /github_pat_[0-9A-Za-z_]{82,}/g}
];

const findings = [];

for await (const path of walk(root)) {
  const text = await readText(path);
  if (text === null) {
    continue;
  }

  for (const {name, pattern} of secretPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      findings.push({name, path, index: match.index ?? 0});
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    const location = lineColumn(await readFile(finding.path, "utf8"), finding.index);
    console.error(`${finding.name} found at ${relative(root, finding.path)}:${location.line}:${location.column}`);
  }

  process.exit(1);
}

console.log("No common API key patterns found.");

async function* walk(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        yield* walk(join(directory, entry.name));
      }
      continue;
    }

    if (entry.isFile() && !ignoredFiles.has(entry.name)) {
      yield join(directory, entry.name);
    }
  }
}

async function readText(path) {
  const buffer = await readFile(path);
  if (buffer.includes(0)) {
    return null;
  }

  return buffer.toString("utf8");
}

function lineColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split("\n");

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}
