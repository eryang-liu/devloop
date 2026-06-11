import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeProjectRoot } from "./paths.js";

const execFileAsync = promisify(execFile);

export type ProjectVcsMode = "snapshot" | "git-pending" | "git";

export type ProjectVcsState = {
  mode: ProjectVcsMode;
  gitRoot: string | null;
  headSha: string | null;
};

function parseChangedFilesPorcelain(stdout: string): string[] {
  const records = stdout.split("\0");
  const changedFiles = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];

    if (!record || record.length < 4) {
      continue;
    }

    const status = record.slice(0, 2);
    const path = record.slice(3);

    if (!path) {
      continue;
    }

    changedFiles.add(path);

    if (status.includes("R") || status.includes("C")) {
      index += 1;
    }
  }

  return [...changedFiles];
}

async function execGit(projectRoot: string | URL, args: string[]): Promise<string> {
  const cwd = normalizeProjectRoot(projectRoot);
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

export async function getChangedFiles(projectRoot: string | URL): Promise<string[]> {
  const cwd = normalizeProjectRoot(projectRoot);
  const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "-z"], { cwd });

  return parseChangedFilesPorcelain(stdout);
}

export async function getHeadSha(projectRoot: string | URL): Promise<string> {
  return execGit(projectRoot, ["rev-parse", "HEAD"]);
}

export async function detectProjectVcsState(projectRoot: string | URL): Promise<ProjectVcsState> {
  let gitRoot: string;

  try {
    gitRoot = await execGit(projectRoot, ["rev-parse", "--show-toplevel"]);
  } catch {
    return {
      mode: "snapshot",
      gitRoot: null,
      headSha: null
    };
  }

  try {
    const headSha = await getHeadSha(projectRoot);
    return {
      mode: "git",
      gitRoot,
      headSha
    };
  } catch {
    return {
      mode: "git-pending",
      gitRoot,
      headSha: null
    };
  }
}
