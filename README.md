# DevLoop

DevLoop is a requirement-first dev loop for AI builders: capture what you asked AI to change, turn it into living PRDs, keep regression checks visible, and replace release anxiety with verifiable confidence.

DevLoop 是一个面向 AI 开发者的需求优先开发闭环：把你交给 AI 的需求收进可持续演进的 PRD，把回归验证持续挂在台面上，用可验证证据替代“做完了但不敢发”的焦虑。

DevLoop 是一个面向本地开发流程的开发-测试台账与可视化执行工具，专门解决这类高频痛点：

- AI 辅助开发太快，几天后已经说不清改过哪些功能
- 测了什么、没测什么、哪些改动可能带来回归，没有统一视图
- 想在上线前做一次系统性验证，却不知道该从哪里开始
- 有的项目没有 git，或者一开始没上 git，工具仍然要能工作

当前仓库已经具备一条可用的本地闭环：CLI、同源 API 服务、本地仪表盘，以及无 git 到 git 的平滑升级能力。

## 需求优先工作流

现在 DevLoop 的主线不是“先看哪些文件改了”，而是“先把这次真实需求收进迭代 PRD，再围着它测”。

最常用的入口：

```bash
devloop capture --raw-request "重构 onboarding 向导并补回归验证"
devloop iteration list
devloop
devloop ui --port 4310
```

如果你在当前仓库直接运行构建产物，对应命令是：

```bash
node packages/cli/dist/main.js capture --raw-request "重构 onboarding 向导并补回归验证"
node packages/cli/dist/main.js iteration list
node packages/cli/dist/main.js
node packages/cli/dist/main.js ui --port 4310
```

这条工作流里最关键的几个产物位置：

- 机器真相：`.devloop/iterations/`
- 人类可读 PRD：`docs/prd/YYYY-MM-DD/*.md`
- 测试运行证据：`.devloop/test-runs/`
- 现有 feature/impact 支撑证据：`.devloop/registry.json`

使用规则：

- `devloop capture` 默认会按 `manual` 来源捕获需求
- 如果当前有活跃迭代，控制台里留空标题提交，会默认把需求追加到当前迭代
- 如果这是一个全新需求，补一个标题即可新开 PRD
- release-check 现在会同时看 smoke/P0 证据和活跃迭代里未完成的验收/回归项

## 默认入口

现在默认的人机入口是：

```bash
devloop
```

如果你是在当前仓库里直接运行构建产物，对应命令是：

```bash
node packages/cli/dist/main.js
```

执行后会启动本地控制台并自动打开浏览器。控制台里会提供：

- Quick actions：单步动作，适合日常开发后快速验证
- One-click workflows：一键流程，适合做一次完整开发检查或发版前检查
- Execution results：查看每一步的结果和按需展开的日志
- Help：先看轻量帮助，再进入完整帮助页
- Start DevLoop UI：从控制台里继续打开已有的 dashboard

语言说明：

- 控制台和 `devloop ui` 都支持 `zh-CN` / `en-US`
- 首次打开默认跟随浏览器语言：`zh*` 会归一到 `zh-CN`，其他语言归一到 `en-US`
- 右上角可以手动切换语言
- 控制台和 dashboard 共用同一份语言偏好，会自动同步
- 结构化结果摘要会翻译，原始日志保持原样，方便排查

CLI 帮助仍然保留：

```bash
devloop --help
devloop -h
devloop help
```

## 当前能力

- `devloop`：启动默认控制台，统一入口进入常用动作、工作流、帮助和 UI
- `devloop doctor`：检查当前目录是否存在 `.devloop/config.yml`
- `devloop status`：输出当前项目的验证状态摘要
- `devloop capture`：把一条新需求、补充修改、重构项或回归修复收进迭代与 PRD
- `devloop iteration list` / `devloop iteration show <id>`：查看当前和历史迭代
- `devloop sync`：更新本地 registry
- `devloop release-check`：执行发布前校验
- `devloop record-run`：手动记录一次测试运行，并更新覆盖到的功能状态
- `devloop run-scenario`：执行内置 smoke 场景并自动记录结果
- `devloop ui`：启动同源 dashboard，UI 和 `/api/*` 由同一个本地服务提供

VCS 行为：

- 没有 git 时，DevLoop 以 `snapshot` 模式工作，不阻塞使用
- 项目后来初始化了 git 但还没有首个 commit 时，会进入 `git-pending`
- 有了首个 commit 后，会自动升级到 `git` 模式，并保留之前的快照历史桥接

要求：`Node.js >= 18`

## 本地开发（M1）

安装依赖：

```bash
npx -y pnpm@10.0.0 install
```

构建工作区包：

```bash
npx -y pnpm@10.0.0 build
```

启动默认控制台：

```bash
node packages/cli/dist/main.js
```

启动后访问：

```text
http://127.0.0.1:4301
```

说明：

- `@devloop/cli build` 会把已构建的 dashboard 和 console 静态资源分别复制到 `packages/cli/dist/ui` 与 `packages/cli/dist/console`
- `devloop` 会从 CLI 包自身的 `dist/console` 提供控制台界面
- `devloop ui` 会从 CLI 包自身的 `dist/ui` 提供 dashboard 界面
- API 保持同源，通过 `http://127.0.0.1:<port>/api/*` 访问
- 如果已经把 CLI 安装到本地环境，等价命令是 `devloop`

如果你更偏好直接打开 dashboard，也仍然可以继续使用：

```bash
node packages/cli/dist/main.js ui --port 4310
```

## 给当前项目直接用起来

这个仓库已经带好 `.devloop/config.yml`，所以可以直接跑。

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

打开后优先推荐这几种用法：

- `Sync project`：先同步当前项目状态
- `Run local-api-smoke`：做一轮本地 API 级 smoke
- `Development check`：日常开发后的一键轻量检查
- `Pre-release check`：发版前把 sync、API smoke、browser smoke、release-check 串起来
- `Start DevLoop UI`：需要查看已有 dashboard 面板时再打开

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

7. 做一次发布前检查

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

当前仓库的 `.devloop/config.yml` 已经把 `gate.strict_snapshot` 设为 `false`，所以在没有 git 的阶段也能通过 release check；等项目后面接入 git 后，DevLoop 会自动切换到 git-backed 证据模式，不需要你手工迁移历史。也就是说：

- 没有 git 时可以先正常使用 DevLoop
- 后面初始化 git 但还没有首个 commit 时，会进入 `git-pending`
- 有了首个 commit 后，会自动升级到 `git` 模式，并桥接之前的快照历史
- 如果之前已经手动切换过语言，后续无论从控制台还是 dashboard 进入，都会沿用同一份语言设置

## 常用工作流

日常开发后：

```bash
node packages/cli/dist/main.js sync
node packages/cli/dist/main.js run-scenario default-console-smoke
node packages/cli/dist/main.js run-scenario local-api-smoke
node packages/cli/dist/main.js status
```

准备发版前：

```bash
node packages/cli/dist/main.js capture --raw-request "补齐这轮发版前最后一项调整"
node packages/cli/dist/main.js sync
node packages/cli/dist/main.js run-scenario local-api-smoke
node packages/cli/dist/main.js run-scenario browser-dashboard-smoke
node packages/cli/dist/main.js release-check
```

## 文档

- [PRD-dev-loop.md](/Users/jeff/developer/devLoop/PRD-dev-loop.md)
