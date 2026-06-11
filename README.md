# DevLoop

DevLoop is a requirement-first dev loop for AI builders: capture what you asked AI to change, turn it into living PRDs, keep regression checks visible, and replace release anxiety with verifiable confidence.

DevLoop 是一个面向 AI 开发者的需求优先开发闭环：把你交给 AI 的需求收进可持续演进的 PRD，把回归验证持续挂在台面上，用可验证证据替代“做完了但不敢发”的焦虑。

It is built for a very specific modern problem:
When AI makes development 20x faster, teams stop writing things down, stop tracking regression scope, and eventually stop trusting what is "done".

它专门解决一种越来越常见的现代开发焦虑：
AI 把开发速度放大之后，团队往往来不及记录需求、来不及系统回归，最后变成“功能好像做完了，但没人真的敢发”。

Built for solo builders and small teams using tools like Codex, Cursor, and Claude Code.

适合重度使用 Codex、Cursor、Claude Code 等 AI 工具的个人开发者和小团队。

## Why DevLoop

- Capture raw AI requests before they disappear from chat history
- Turn messy iteration changes into living PRDs and acceptance checkpoints
- Keep test evidence, regression scope, and release risk in one visible loop
- Work before git, after git, and through the transition in between

## What Makes It Different

Most dev tools start from changed files or test commands.
DevLoop starts from the real user request, because that is the only stable source of truth when AI-driven iteration gets messy.

很多开发工具从“改了哪些文件”开始。
DevLoop 从“这次到底要改什么需求”开始，因为在高频 AI 迭代里，需求本身才是最不容易跑偏的测试锚点。

适合这些场景：

- AI 辅助开发太快，几天后已经说不清改过哪些功能
- 测了什么、没测什么、哪些改动可能带来回归，没有统一视图
- 想在上线前做一次系统性验证，却不知道该从哪里开始
- 项目一开始没有 git，后面才接入 git，工具仍然要能平滑工作

## Quick Start

The fastest way to understand DevLoop is:

```bash
devloop capture --raw-request "重构 onboarding 向导并补回归验证"
devloop iteration list
devloop
```

If you are running the built artifact inside this repository, use:

```bash
node packages/cli/dist/main.js capture --raw-request "重构 onboarding 向导并补回归验证"
node packages/cli/dist/main.js iteration list
node packages/cli/dist/main.js
```

This is the core idea:

1. Capture the real requirement you gave to AI
2. Append it to the current iteration or open a new PRD thread
3. Run the right verification workflow around that requirement
4. Keep evidence and release confidence visible over time

If you only remember one thing, remember this:
DevLoop is not a generic test runner. It is a requirement-to-verification loop.

## What DevLoop Produces

The most important output locations are:

- 机器真相：`.devloop/iterations/`
- 人类可读 PRD：`docs/prd/YYYY-MM-DD/*.md`
- 测试运行证据：`.devloop/test-runs/`
- 现有 feature/impact 支撑证据：`.devloop/registry.json`

These artifacts stay local to your project, so they work in non-git repos and continue to work after a repo later moves onto git.

## Daily Entry Points

The default human-facing entry point is:

```bash
devloop
```

That launches the local control console and opens it in a browser. The console is designed for the most common day-to-day actions:

- Quick actions: run one focused verification step
- One-click workflows: run a lightweight dev check or a fuller pre-release check
- Execution results: inspect recent runs and logs
- Help: show the lightweight and full help surfaces
- Start DevLoop UI: open the dashboard when you need the broader panel view

CLI help is still available:

```bash
devloop --help
devloop -h
devloop help
```

## Requirement-First Workflow

DevLoop's opinionated flow is not "start from changed files".
It is "start from the real product or refactor request, then test around that requirement".

Rules of thumb:

- `devloop capture` 默认会按 `manual` 来源捕获需求
- 如果当前有活跃迭代，控制台里留空标题提交，会默认把需求追加到当前迭代
- 如果这是一个全新需求，补一个标题即可新开 PRD
- release-check 现在会同时看 smoke/P0 证据和活跃迭代里未完成的验收/回归项

## Current Capabilities

- `devloop`: start the default control console
- `devloop doctor`: check whether the current directory has `.devloop/config.yml`
- `devloop status`: print the current verification summary
- `devloop capture`: capture a new requirement, refactor task, follow-up, or regression fix
- `devloop iteration list` / `devloop iteration show <id>`: inspect current and past iterations
- `devloop sync`: refresh local registry state
- `devloop release-check`: evaluate release readiness
- `devloop record-run`: record a manual test run and affected features
- `devloop run-scenario`: execute built-in smoke scenarios and record them
- `devloop ui`: launch the local dashboard and same-origin API server

## Language Support

Both the control console and `devloop ui` support `zh-CN` and `en-US`.

- 控制台和 `devloop ui` 都支持 `zh-CN` / `en-US`
- 首次打开默认跟随浏览器语言：`zh*` 会归一到 `zh-CN`，其他语言归一到 `en-US`
- 右上角可以手动切换语言
- 控制台和 dashboard 共用同一份语言偏好，会自动同步
- 结构化结果摘要会翻译，原始日志保持原样，方便排查

## Git and Non-Git Projects

DevLoop does not require git on day one.

- 没有 git 时，DevLoop 以 `snapshot` 模式工作，不阻塞使用
- 项目后来初始化了 git 但还没有首个 commit 时，会进入 `git-pending`
- 有了首个 commit 后，会自动升级到 `git` 模式，并保留之前的快照历史桥接

This lets a project start in local-only mode and later grow into git-backed evidence without manual migration.

## Local Development

Requirements: `Node.js >= 18`

Install dependencies:

```bash
npx -y pnpm@10.0.0 install
```

Build the workspace:

```bash
npx -y pnpm@10.0.0 build
```

Launch the default console:

```bash
node packages/cli/dist/main.js
```

Then open:

```text
http://127.0.0.1:4301
```

Notes:

- `@devloop/cli build` 会把已构建的 dashboard 和 console 静态资源分别复制到 `packages/cli/dist/ui` 与 `packages/cli/dist/console`
- `devloop` 会从 CLI 包自身的 `dist/console` 提供控制台界面
- `devloop ui` 会从 CLI 包自身的 `dist/ui` 提供 dashboard 界面
- API 保持同源，通过 `http://127.0.0.1:<port>/api/*` 访问
- 如果已经把 CLI 安装到本地环境，等价命令是 `devloop`

如果你更偏好直接打开 dashboard，也仍然可以继续使用：

```bash
node packages/cli/dist/main.js ui --port 4310
```

## Use It In This Repository

This repository already includes `.devloop/config.yml`, so you can use DevLoop immediately.

1. 安装依赖

```bash
npx -y pnpm@10.0.0 install
```

2. 构建 CLI、Server、UI

```bash
npx -y pnpm@10.0.0 build
```

3. 直接打开默认控制台

```bash
node packages/cli/dist/main.js
```

Recommended first actions:

- `Sync project`：先同步当前项目状态
- `Run local-api-smoke`：做一轮本地 API 级 smoke
- `Development check`：日常开发后的一键轻量检查
- `Pre-release check`：发版前把 sync、API smoke、browser smoke、release-check 串起来
- `Start DevLoop UI`：需要查看已有 dashboard 面板时再打开

That is the shortest happy path in this repo:
capture one requirement, sync once, run the suggested checks, then inspect release readiness.

如果你想直接用 CLI，也可以继续这样跑：

```bash
node packages/cli/dist/main.js capture --raw-request "新增一个需求自动生成 PRD 的入口"
node packages/cli/dist/main.js capture --title "Locale polish" --raw-request "统一控制台和 UI 的语言切换行为"
node packages/cli/dist/main.js iteration list
node packages/cli/dist/main.js iteration show iter_xxx
node packages/cli/dist/main.js sync
node packages/cli/dist/main.js status
node packages/cli/dist/main.js run-scenario default-console-smoke
node packages/cli/dist/main.js run-scenario local-api-smoke
node packages/cli/dist/main.js run-scenario browser-dashboard-smoke
node packages/cli/dist/main.js record-run \
  --scope smoke \
  --status passed \
  --scenario local-api-smoke \
  --artifact artifacts/smoke-report.txt
```

Run a release check:

```bash
node packages/cli/dist/main.js release-check
```

如果你只想单独打开 dashboard：

```bash
node packages/cli/dist/main.js ui --port 4311
```

然后访问：

```text
http://127.0.0.1:4311
```

This repository sets `gate.strict_snapshot: false` in `.devloop/config.yml`, so release checks can still pass in the pre-git phase. Once git is introduced, DevLoop automatically upgrades to git-backed evidence mode without manual history migration.

## Common Workflows

After a normal development session:

```bash
node packages/cli/dist/main.js sync
node packages/cli/dist/main.js run-scenario default-console-smoke
node packages/cli/dist/main.js run-scenario local-api-smoke
node packages/cli/dist/main.js status
```

Before a release:

```bash
node packages/cli/dist/main.js capture --raw-request "补齐这轮发版前最后一项调整"
node packages/cli/dist/main.js sync
node packages/cli/dist/main.js run-scenario local-api-smoke
node packages/cli/dist/main.js run-scenario browser-dashboard-smoke
node packages/cli/dist/main.js release-check
```

## Docs

- [PRD-dev-loop.md](./PRD-dev-loop.md)
