import type { DevLoopLanguage } from "./language.js";

export type MessageDictionary = Record<string, string>;

const EN_MESSAGES: MessageDictionary = {
  "shared.language.toggle": "中文",

  "console.hero.eyebrow": "Default Entry Console",
  "console.hero.title": "DevLoop control console",
  "console.hero.emptySummary":
    "Choose a single action for a quick check, or run a full workflow to let DevLoop drive the sequence for you.",
  "console.hero.currentIterationSummary":
    "Current requirement track: {title} ({status}). Capture the next request here so your PRD and test basis stay fresh.",
  "console.help.button": "Help",
  "console.hero.recommendedLabel": "Recommended first move",
  "console.hero.recommendedValue": "Development check",
  "console.error.title": "Execution failed",
  "console.error.captureFallback": "Requirement capture failed",
  "console.error.iterationsFallback": "Failed to load iterations",
  "console.panel.iterationsEyebrow": "Requirement-first",
  "console.panel.iterationsTitle": "Current iteration workspace",
  "console.panel.actionsEyebrow": "Quick actions",
  "console.panel.actionsTitle": "Single-step controls",
  "console.panel.workflowsEyebrow": "One-click workflows",
  "console.panel.workflowsTitle": "Guided verification runs",
  "console.panel.resultsEyebrow": "Execution results",
  "console.panel.resultsTitle": "Latest run details",
  "console.empty.title": "No run yet",
  "console.empty.description":
    "Use a quick action or workflow to populate step-by-step evidence here.",
  "console.logs.show": "Show logs",
  "console.logs.hide": "Hide logs",
  "console.help.quickActionLine": "Quick actions run one step at a time.",
  "console.help.workflowLine": "Workflows run a checked sequence for you.",
  "console.help.snapshotLine": "Snapshot mode works without git.",
  "console.help.gitPendingLine": "Git-pending means git exists but the first commit does not.",
  "console.help.startUiLine": "Start DevLoop UI opens the existing dashboard view.",
  "console.help.viewFull": "View full help",
  "console.help.close": "Close",
  "console.help.modalEyebrow": "Help",
  "console.help.modalTitle": "How this console works",
  "console.help.fullEyebrow": "Reference",
  "console.help.fullTitle": "Full help",
  "console.help.fullClose": "Close full help",
  "console.help.dailyTitle": "Daily usage guide",
  "console.help.dailyBody":
    "Run a quick action when you need one signal, or the development check when you want a light confidence pass after coding.",
  "console.help.prereleaseTitle": "Pre-release guidance",
  "console.help.prereleaseBody":
    "Use the pre-release workflow before shipping so sync, API smoke, browser smoke, and release evidence are reviewed together.",
  "console.help.nogitTitle": "No-git to git upgrade",
  "console.help.nogitBody":
    "Snapshot mode works without git. Once the project gets a real HEAD, DevLoop upgrades into git-backed evidence automatically.",
  "console.help.troubleshootingTitle": "Failure troubleshooting",
  "console.help.troubleshootingBody":
    "Open step logs first. Failed API smoke usually points to a route regression, while failed release-check points to missing verification evidence.",
  "console.action.sync.title": "Sync project",
  "console.action.sync.description": "Refresh the registry and capture the current revision evidence.",
  "console.action.local-api-smoke.title": "Run local-api-smoke",
  "console.action.local-api-smoke.description":
    "Hit the local health, status, impact, recent-run, and release endpoints.",
  "console.action.browser-dashboard-smoke.title": "Run browser-dashboard-smoke",
  "console.action.browser-dashboard-smoke.description":
    "Verify the bundled dashboard shell and its same-origin APIs.",
  "console.action.status.title": "Show status summary",
  "console.action.status.description":
    "Read the current verification posture without changing project state.",
  "console.action.release-check.title": "Run release-check",
  "console.action.release-check.description":
    "Evaluate whether current evidence is clear, degraded, or blocking.",
  "console.action.start-ui.title": "Start DevLoop UI",
  "console.action.start-ui.description":
    "Launch or reuse the existing dashboard view from inside the console.",
  "console.capture.titleLabel": "Optional new PRD title",
  "console.capture.titlePlaceholder": "Leave blank to continue the current iteration",
  "console.capture.inputLabel": "Requirement input",
  "console.capture.inputPlaceholder":
    "Describe the new requirement, follow-up tweak, refactor, or regression fix you just asked AI to build.",
  "console.capture.submit": "Capture requirement",
  "console.capture.running": "Capturing…",
  "console.capture.currentHint":
    "Title left blank means this note will extend the current iteration: {title}",
  "console.capture.newHint":
    "Add a title when this should open a brand-new PRD instead of extending an existing one.",
  "console.iteration.currentTitle": "Active and reopened iterations",
  "console.iteration.currentBody": "These are the requirement tracks that still define your test basis.",
  "console.iteration.emptyTitle": "No active iteration yet",
  "console.iteration.emptyBody":
    "Capture the first requirement and DevLoop will generate the PRD and machine iteration record.",
  "console.iteration.status.active": "Active",
  "console.iteration.status.paused": "Paused",
  "console.iteration.status.done": "Done",
  "console.iteration.status.reopened": "Reopened",
  "console.iteration.status.archived": "Archived",
  "console.workflow.development-check.title": "Development check",
  "console.workflow.development-check.description":
    "Run the light post-dev sweep before you move on.",
  "console.workflow.pre-release-check.title": "Pre-release check",
  "console.workflow.pre-release-check.description":
    "Run the full pre-release sequence with browser and release validation.",
  "console.running": "Running…",
  "console.summary.workflow.passed": "Workflow completed successfully",
  "console.summary.workflow.failed": "Workflow stopped on a failing step",
  "console.summary.action.sync.passed": "Registry synced successfully",
  "console.summary.action.status.passed": "Loaded status summary",
  "console.summary.action.release-check.passed": "Release check passed",
  "console.summary.action.release-check.warn": "Release check completed with warnings",
  "console.summary.action.release-check.failed": "Release check blocked progress",
  "console.summary.action.start-ui.passed": "DevLoop UI is available",
  "console.summary.action.start-ui.failed": "DevLoop UI could not be started",
  "console.summary.action.local-api-smoke.passed": "local-api-smoke completed successfully",
  "console.summary.action.local-api-smoke.failed": "local-api-smoke failed",
  "console.summary.action.browser-dashboard-smoke.passed":
    "browser-dashboard-smoke completed successfully",
  "console.summary.action.browser-dashboard-smoke.failed": "browser-dashboard-smoke failed",
  "console.step.skipped": "Skipped because an earlier workflow step failed.",
  "console.status.passed": "passed",
  "console.status.failed": "failed",
  "console.status.skipped": "skipped",
  "console.error.actionFallback": "Action failed",
  "console.error.workflowFallback": "Workflow failed",
  "console.results.openUi": "Open DevLoop UI",

  "dashboard.loading": "Assembling release telemetry…",
  "dashboard.unavailableTitle": "Dashboard unavailable",
  "dashboard.unavailableBody": "The release desk could not load its first snapshot.",
  "dashboard.retryInitial": "Retry initial load",
  "dashboard.masthead.eyebrow": "M1 Browser",
  "dashboard.masthead.title": "Release Command Desk",
  "dashboard.masthead.copy":
    "A warm operations board for spotting unverified change, reading release pressure, and staying close to the impact queue without duplicating server logic.",
  "dashboard.masthead.mode": "Mode",
  "dashboard.masthead.lastRefresh": "Last board refresh",
  "dashboard.masthead.pending": "Pending",
  "dashboard.refresh": "Refresh release desk",
  "dashboard.banner.title": "Dashboard refresh failed",
  "dashboard.gate.eyebrow": "Release gate",
  "dashboard.gate.passTag": "PASS",
  "dashboard.gate.warnTag": "WARN",
  "dashboard.gate.blockTag": "BLOCK",
  "dashboard.gate.passValue": "Clear to move with current evidence.",
  "dashboard.gate.warnValue": "Release evidence is degraded until git-backed history exists.",
  "dashboard.gate.blockValue": "Hold release until the open checks are resolved.",
  "dashboard.gate.unmetNone": "No unmet release requirements reported",
  "dashboard.gate.unmetSuffix": "unmet release requirements",
  "dashboard.gate.covered": "Head smoke and P0 checks are covered",
  "dashboard.metric.featureMap": "Feature map",
  "dashboard.metric.featureMapBody": "Tracked features in the registry summary",
  "dashboard.metric.p0Attention": "P0 attention",
  "dashboard.metric.p0AttentionBody": "High-risk features that are not yet in `tested` state",
  "dashboard.metric.impactQueue": "Impact queue",
  "dashboard.metric.impactQueueBody": "Features currently queued for verification impact review",
  "dashboard.metric.pressure": "Pressure index",
  "dashboard.metric.pressureBody": "A quick count of items demanding release attention right now",
  "dashboard.sync.label": "Registry sync",
  "dashboard.sync.upgradeBridge": "Upgrade bridge",
  "dashboard.panel.ledgerEyebrow": "Status ledger",
  "dashboard.panel.ledgerTitle": "Verification posture",
  "dashboard.panel.watchEyebrow": "P0 watchlist",
  "dashboard.panel.watchTitle": "High-risk features",
  "dashboard.panel.watchEmpty": "All P0 features are currently verified",
  "dashboard.panel.watchBody": "Priority zero feature outside the verified lane",
  "dashboard.panel.iterationsEyebrow": "Requirement verification",
  "dashboard.panel.iterationsTitle": "Active iterations",
  "dashboard.panel.iterationsEmpty": "No active requirement iterations right now",
  "dashboard.panel.runsEyebrow": "Recent runs",
  "dashboard.panel.runsTitle": "Latest verification evidence",
  "dashboard.panel.runsEmpty": "No verification runs recorded yet",
  "dashboard.panel.queueEyebrow": "Impact queue",
  "dashboard.panel.queueTitle": "Change-driven verification work",
  "dashboard.panel.queueHint":
    "Relative API calls keep this package ready for same-origin serving in the next task.",
  "dashboard.table.feature": "Feature",
  "dashboard.table.confidence": "Confidence",
  "dashboard.table.scope": "Recommended scope",
  "dashboard.table.signals": "Signals",
  "dashboard.table.observed": "Observed",
  "dashboard.table.revision": "Revision",
  "dashboard.table.noSignals": "No file matches recorded",
  "dashboard.table.empty": "No impacted features queued",
  "dashboard.confidence.high": "High",
  "dashboard.confidence.medium": "Medium",
  "dashboard.confidence.low": "Low",
  "dashboard.scope.current": "Current",
  "dashboard.mode.git": "Git-backed mode",
  "dashboard.mode.git-pending": "Git detected, awaiting first commit",
  "dashboard.mode.snapshot": "Snapshot mode",
  "dashboard.requirement.missing_head_smoke_run": "Missing head smoke run",
  "dashboard.requirement.missing_git_revision_evidence": "Missing git revision evidence",
  "dashboard.requirement.p0_not_verified": "P0 not verified",
  "dashboard.requirement.iteration_pending": "Iteration checklist still pending",
  "dashboard.timestamp.none": "No sync recorded",
  "dashboard.status.tested": "Tested",
  "dashboard.status.changed_untested": "Changed, untested",
  "dashboard.status.rework_untested": "Rework pending",
  "dashboard.status.failed": "Failed",
  "dashboard.status.needs-triage": "Needs triage",
  "dashboard.status.never_tested": "Never tested",
  "dashboard.scope.smoke": "Smoke",
  "dashboard.scope.impacted": "Impacted only",
  "dashboard.scope.current+p0": "Current + P0",
  "dashboard.scope.full": "Full sweep",
  "dashboard.run.passed": "Passed",
  "dashboard.run.failed": "Failed",
  "dashboard.run.partial": "Partial",
  "dashboard.run.aborted": "Aborted",
  "dashboard.iteration.acceptancePending": "{count} acceptance pending",
  "dashboard.iteration.regressionPending": "{count} regression pending"
};

const ZH_MESSAGES: MessageDictionary = {
  "shared.language.toggle": "EN",

  "console.hero.eyebrow": "默认入口面板",
  "console.hero.title": "DevLoop 控制台",
  "console.hero.emptySummary": "你可以先跑一个单步动作快速检查，或者直接运行一键流程，让 DevLoop 帮你串起整段验证。",
  "console.hero.currentIterationSummary":
    "当前需求主线：{title}（{status}）。把下一条需求记在这里，PRD 和测试依据就不会断线。",
  "console.help.button": "帮助",
  "console.hero.recommendedLabel": "推荐先做这一步",
  "console.hero.recommendedValue": "开发检查",
  "console.error.title": "执行失败",
  "console.error.captureFallback": "需求捕获失败",
  "console.error.iterationsFallback": "加载迭代失败",
  "console.panel.iterationsEyebrow": "需求优先",
  "console.panel.iterationsTitle": "当前迭代工作台",
  "console.panel.actionsEyebrow": "快捷动作",
  "console.panel.actionsTitle": "单步控制",
  "console.panel.workflowsEyebrow": "一键流程",
  "console.panel.workflowsTitle": "引导式验证",
  "console.panel.resultsEyebrow": "执行结果",
  "console.panel.resultsTitle": "最近一次运行详情",
  "console.empty.title": "还没有运行记录",
  "console.empty.description": "执行一个快捷动作或流程后，这里会展示按步骤沉淀下来的验证证据。",
  "console.logs.show": "查看日志",
  "console.logs.hide": "隐藏日志",
  "console.help.quickActionLine": "快捷动作一次只运行一个步骤。",
  "console.help.workflowLine": "一键流程会帮你顺序执行整组检查。",
  "console.help.snapshotLine": "没有 git 时，Snapshot 模式也可以正常使用。",
  "console.help.gitPendingLine": "Git-pending 表示已经初始化 git，但还没有首个 commit。",
  "console.help.startUiLine": "启动 DevLoop UI 会打开现有的仪表盘视图。",
  "console.help.viewFull": "查看完整帮助",
  "console.help.close": "关闭",
  "console.help.modalEyebrow": "帮助",
  "console.help.modalTitle": "这个控制台怎么用",
  "console.help.fullEyebrow": "参考",
  "console.help.fullTitle": "完整帮助",
  "console.help.fullClose": "关闭完整帮助",
  "console.help.dailyTitle": "日常使用指南",
  "console.help.dailyBody": "当你只需要一个信号时，运行单个快捷动作；当你刚完成开发、想做一轮轻量信心检查时，运行开发检查。",
  "console.help.prereleaseTitle": "发版前建议",
  "console.help.prereleaseBody": "在发版前使用预发布检查，把同步、API smoke、浏览器 smoke 和发布判断放在同一轮证据里一起确认。",
  "console.help.nogitTitle": "从无 git 到接入 git",
  "console.help.nogitBody": "没有 git 时可以先用 Snapshot 模式；项目后续有了真正的 HEAD 后，DevLoop 会自动升级为 git-backed 证据模式。",
  "console.help.troubleshootingTitle": "失败排查",
  "console.help.troubleshootingBody": "先展开步骤日志。API smoke 失败通常指向接口回归，release-check 失败通常表示缺少验证证据。",
  "console.action.sync.title": "同步项目",
  "console.action.sync.description": "刷新 registry，并记录当前版本证据。",
  "console.action.local-api-smoke.title": "运行 local-api-smoke",
  "console.action.local-api-smoke.description": "检查本地 health、status、impact、recent-run 和 release 相关接口。",
  "console.action.browser-dashboard-smoke.title": "运行 browser-dashboard-smoke",
  "console.action.browser-dashboard-smoke.description": "验证 dashboard 壳和它的同源 API 是否可用。",
  "console.action.status.title": "查看状态摘要",
  "console.action.status.description": "在不改动项目状态的前提下读取当前验证态势。",
  "console.action.release-check.title": "运行 release-check",
  "console.action.release-check.description": "判断当前证据是可放行、降级告警，还是需要阻塞。",
  "console.action.start-ui.title": "启动 DevLoop UI",
  "console.action.start-ui.description": "从控制台内启动或复用现有 dashboard 视图。",
  "console.capture.titleLabel": "可选的新 PRD 标题",
  "console.capture.titlePlaceholder": "留空则继续当前迭代",
  "console.capture.inputLabel": "Requirement input",
  "console.capture.inputPlaceholder": "把你刚刚交给 AI 的新需求、补充修改、重构项或回归修复写在这里。",
  "console.capture.submit": "捕获需求",
  "console.capture.running": "捕获中…",
  "console.capture.currentHint": "标题留空时，这条记录会继续追加到当前迭代：{title}",
  "console.capture.newHint": "如果这是全新的 PRD，请补一个标题；否则可以直接留空继续当前迭代。",
  "console.iteration.currentTitle": "活跃与重新打开的迭代",
  "console.iteration.currentBody": "这些需求主线会直接决定你当前该测什么。",
  "console.iteration.emptyTitle": "还没有活跃迭代",
  "console.iteration.emptyBody": "先捕获第一条需求，DevLoop 就会自动生成 PRD 和机器迭代记录。",
  "console.iteration.status.active": "进行中",
  "console.iteration.status.paused": "暂停",
  "console.iteration.status.done": "完成",
  "console.iteration.status.reopened": "重新打开",
  "console.iteration.status.archived": "归档",
  "console.workflow.development-check.title": "开发检查",
  "console.workflow.development-check.description": "完成开发后，先做一轮轻量串行检查。",
  "console.workflow.pre-release-check.title": "预发布检查",
  "console.workflow.pre-release-check.description": "在发布前执行包含浏览器和发布判断的完整检查流程。",
  "console.running": "运行中…",
  "console.summary.workflow.passed": "流程已成功完成",
  "console.summary.workflow.failed": "流程在某一步失败后已停止",
  "console.summary.action.sync.passed": "项目状态已同步",
  "console.summary.action.status.passed": "状态摘要已加载",
  "console.summary.action.release-check.passed": "发布检查已通过",
  "console.summary.action.release-check.warn": "发布检查完成，但存在告警",
  "console.summary.action.release-check.failed": "发布检查判定当前不能继续",
  "console.summary.action.start-ui.passed": "DevLoop UI 已可用",
  "console.summary.action.start-ui.failed": "DevLoop UI 启动失败",
  "console.summary.action.local-api-smoke.passed": "local-api-smoke 已成功完成",
  "console.summary.action.local-api-smoke.failed": "local-api-smoke 执行失败",
  "console.summary.action.browser-dashboard-smoke.passed": "browser-dashboard-smoke 已成功完成",
  "console.summary.action.browser-dashboard-smoke.failed": "browser-dashboard-smoke 执行失败",
  "console.step.skipped": "由于前一步失败，后续步骤已跳过。",
  "console.status.passed": "通过",
  "console.status.failed": "失败",
  "console.status.skipped": "跳过",
  "console.error.actionFallback": "动作执行失败",
  "console.error.workflowFallback": "流程执行失败",
  "console.results.openUi": "打开 DevLoop UI",

  "dashboard.loading": "正在整理发布相关信息…",
  "dashboard.unavailableTitle": "仪表盘暂时不可用",
  "dashboard.unavailableBody": "发布台的首轮快照加载失败了。",
  "dashboard.retryInitial": "重试初始加载",
  "dashboard.masthead.eyebrow": "M1 浏览器面板",
  "dashboard.masthead.title": "发布指挥台",
  "dashboard.masthead.copy": "一个更温和的发布操作台，帮你观察未验证变更、读取发布压力，并持续贴近 impact queue，而不用复制后端逻辑。",
  "dashboard.masthead.mode": "模式",
  "dashboard.masthead.lastRefresh": "上次刷新时间",
  "dashboard.masthead.pending": "等待中",
  "dashboard.refresh": "刷新发布台",
  "dashboard.banner.title": "仪表盘刷新失败",
  "dashboard.gate.eyebrow": "发布闸门",
  "dashboard.gate.passTag": "通过",
  "dashboard.gate.warnTag": "告警",
  "dashboard.gate.blockTag": "阻塞",
  "dashboard.gate.passValue": "以当前证据来看，可以继续推进。",
  "dashboard.gate.warnValue": "在 git-backed 历史证据出现前，当前发布证据仍处于降级状态。",
  "dashboard.gate.blockValue": "在这些未解决检查收敛前，先暂停发布。",
  "dashboard.gate.unmetNone": "当前没有未满足的发布要求",
  "dashboard.gate.unmetSuffix": "项未满足的发布要求",
  "dashboard.gate.covered": "Head smoke 与 P0 检查都已覆盖",
  "dashboard.metric.featureMap": "功能地图",
  "dashboard.metric.featureMapBody": "当前 registry 摘要中被追踪的功能数",
  "dashboard.metric.p0Attention": "P0 关注项",
  "dashboard.metric.p0AttentionBody": "仍未进入 `tested` 状态的高风险功能",
  "dashboard.metric.impactQueue": "Impact 队列",
  "dashboard.metric.impactQueueBody": "当前等待验证影响评估的功能数量",
  "dashboard.metric.pressure": "压力指数",
  "dashboard.metric.pressureBody": "快速反映当前需要发布关注的项目数量",
  "dashboard.sync.label": "Registry 同步",
  "dashboard.sync.upgradeBridge": "升级桥接",
  "dashboard.panel.ledgerEyebrow": "状态账本",
  "dashboard.panel.ledgerTitle": "验证态势",
  "dashboard.panel.watchEyebrow": "P0 观察列表",
  "dashboard.panel.watchTitle": "高风险功能",
  "dashboard.panel.watchEmpty": "当前所有 P0 功能都已验证",
  "dashboard.panel.watchBody": "这个 P0 功能目前不在已验证通道内",
  "dashboard.panel.iterationsEyebrow": "需求验证",
  "dashboard.panel.iterationsTitle": "活跃迭代",
  "dashboard.panel.iterationsEmpty": "当前没有活跃的需求迭代",
  "dashboard.panel.runsEyebrow": "最近运行",
  "dashboard.panel.runsTitle": "最新验证证据",
  "dashboard.panel.runsEmpty": "还没有记录任何验证运行",
  "dashboard.panel.queueEyebrow": "Impact 队列",
  "dashboard.panel.queueTitle": "变更驱动的验证工作",
  "dashboard.panel.queueHint": "这里仍然使用相对 API 路径，方便后续继续以同源方式提供服务。",
  "dashboard.table.feature": "功能",
  "dashboard.table.confidence": "置信度",
  "dashboard.table.scope": "建议范围",
  "dashboard.table.signals": "信号",
  "dashboard.table.observed": "发现时间",
  "dashboard.table.revision": "版本",
  "dashboard.table.noSignals": "没有记录到文件命中信号",
  "dashboard.table.empty": "当前没有待处理的 impacted 功能",
  "dashboard.confidence.high": "高",
  "dashboard.confidence.medium": "中",
  "dashboard.confidence.low": "低",
  "dashboard.scope.current": "当前范围",
  "dashboard.mode.git": "Git 证据模式",
  "dashboard.mode.git-pending": "已检测到 git，等待首个 commit",
  "dashboard.mode.snapshot": "Snapshot 模式",
  "dashboard.requirement.missing_head_smoke_run": "缺少 head smoke 运行记录",
  "dashboard.requirement.missing_git_revision_evidence": "缺少 git 版本证据",
  "dashboard.requirement.p0_not_verified": "P0 尚未验证",
  "dashboard.requirement.iteration_pending": "迭代检查项仍未完成",
  "dashboard.timestamp.none": "还没有同步记录",
  "dashboard.status.tested": "已验证",
  "dashboard.status.changed_untested": "有变更，未验证",
  "dashboard.status.rework_untested": "返工待验证",
  "dashboard.status.failed": "失败",
  "dashboard.status.needs-triage": "待分诊",
  "dashboard.status.never_tested": "从未验证",
  "dashboard.scope.smoke": "Smoke",
  "dashboard.scope.impacted": "仅受影响范围",
  "dashboard.scope.current+p0": "当前范围 + P0",
  "dashboard.scope.full": "全量",
  "dashboard.run.passed": "通过",
  "dashboard.run.failed": "失败",
  "dashboard.run.partial": "部分完成",
  "dashboard.run.aborted": "中止",
  "dashboard.iteration.acceptancePending": "{count} 个验收项待验证",
  "dashboard.iteration.regressionPending": "{count} 个回归项待验证"
};

export const MESSAGES: Record<DevLoopLanguage, MessageDictionary> = {
  "en-US": EN_MESSAGES,
  "zh-CN": ZH_MESSAGES
};

export function t(language: DevLoopLanguage, key: string) {
  return MESSAGES[language][key] ?? MESSAGES["en-US"][key] ?? key;
}

export function getLanguageToggleLabel(language: DevLoopLanguage) {
  return t(language, "shared.language.toggle");
}

export function translateConsoleActionSummary(
  language: DevLoopLanguage,
  actionId: string,
  status: "passed" | "failed",
  fallback: string,
  data?: unknown
) {
  if (actionId === "release-check" && typeof data === "object" && data !== null) {
    const decision = "decision" in data ? data.decision : undefined;

    if (decision === "pass" || decision === "warn") {
      return t(language, `console.summary.action.release-check.${decision}`);
    }
  }

  const key = `console.summary.action.${actionId}.${status}`;
  const translated = MESSAGES[language][key];

  return translated ?? fallback;
}

export function translateConsoleWorkflowSummary(
  language: DevLoopLanguage,
  status: "passed" | "failed"
) {
  return t(language, `console.summary.workflow.${status}`);
}

export function translateConsoleIterationStatus(language: DevLoopLanguage, status: string) {
  return t(language, `console.iteration.status.${status}`);
}

export function translateDashboardFeatureStatus(language: DevLoopLanguage, status: string) {
  return t(language, `dashboard.status.${status}`);
}

export function translateDashboardScope(language: DevLoopLanguage, scope: string) {
  return t(language, `dashboard.scope.${scope}`);
}

export function translateDashboardRunStatus(language: DevLoopLanguage, status: string) {
  return t(language, `dashboard.run.${status}`);
}

export function translateDashboardMode(language: DevLoopLanguage, mode: string) {
  return t(language, `dashboard.mode.${mode}`);
}

export function translateDashboardConfidence(language: DevLoopLanguage, confidence: string) {
  return t(language, `dashboard.confidence.${confidence}`);
}

export function translateDashboardRequirement(language: DevLoopLanguage, requirement: string) {
  const [key, detail] = requirement.split(":");
  const translated = t(language, `dashboard.requirement.${key}`);

  if (translated === `dashboard.requirement.${key}`) {
    return requirement.replaceAll("_", " ");
  }

  return detail ? `${translated}: ${detail}` : translated;
}
