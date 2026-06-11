import { startTransition, useEffect, useMemo, useState } from "react";
import {
  getLanguageToggleLabel,
  t,
  translateConsoleActionSummary,
  translateConsoleIterationStatus,
  translateConsoleWorkflowSummary,
  useLanguage
} from "@devloop/shared-frontend";
import {
  captureIteration,
  listIterations,
  runAction,
  runWorkflow,
  type ActionExecutionResult,
  type ConsoleActionId,
  type ConsoleWorkflowId,
  type IterationStatus,
  type IterationSummary,
  type WorkflowExecutionResult,
  type WorkflowStepResult
} from "./api.js";

type ExecutionResult = ActionExecutionResult | WorkflowExecutionResult;

type ActionCard = {
  actionId: ConsoleActionId;
};

type WorkflowCard = {
  workflowId: ConsoleWorkflowId;
  steps: ConsoleActionId[];
};

const ACTION_CARDS: ActionCard[] = [
  { actionId: "sync" },
  { actionId: "local-api-smoke" },
  { actionId: "browser-dashboard-smoke" },
  { actionId: "status" },
  { actionId: "release-check" },
  { actionId: "start-ui" }
];

const WORKFLOW_CARDS: WorkflowCard[] = [
  {
    workflowId: "development-check",
    steps: ["sync", "local-api-smoke", "status"]
  },
  {
    workflowId: "pre-release-check",
    steps: ["sync", "local-api-smoke", "browser-dashboard-smoke", "release-check"]
  }
];

const HELP_BULLET_KEYS = [
  "console.help.quickActionLine",
  "console.help.workflowLine",
  "console.help.snapshotLine",
  "console.help.gitPendingLine",
  "console.help.startUiLine"
] as const;

function formatStatusTone(status: "passed" | "failed" | "skipped") {
  if (status === "passed") {
    return "result-badge result-badge--passed";
  }

  if (status === "failed") {
    return "result-badge result-badge--failed";
  }

  return "result-badge result-badge--skipped";
}

function openUrlFromAction(data: unknown) {
  if (
    typeof data === "object" &&
    data !== null &&
    "url" in data &&
    typeof data.url === "string"
  ) {
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
}

function getActionTitle(actionId: ConsoleActionId, language: "en-US" | "zh-CN") {
  return t(language, `console.action.${actionId}.title`);
}

function getActionDescription(actionId: ConsoleActionId, language: "en-US" | "zh-CN") {
  return t(language, `console.action.${actionId}.description`);
}

function getWorkflowTitle(workflowId: ConsoleWorkflowId, language: "en-US" | "zh-CN") {
  return t(language, `console.workflow.${workflowId}.title`);
}

function getWorkflowDescription(workflowId: ConsoleWorkflowId, language: "en-US" | "zh-CN") {
  return t(language, `console.workflow.${workflowId}.description`);
}

function getTranslatedActionSummary(
  result: Pick<ActionExecutionResult, "actionId" | "status" | "summary" | "data">,
  language: "en-US" | "zh-CN"
) {
  return translateConsoleActionSummary(
    language,
    result.actionId,
    result.status,
    result.summary,
    result.data
  );
}

function getTranslatedStepSummary(step: WorkflowStepResult, language: "en-US" | "zh-CN") {
  if (step.status === "skipped") {
    return t(language, "console.step.skipped");
  }

  return translateConsoleActionSummary(language, step.actionId, step.status, step.summary, step.data);
}

export default function App() {
  const { language, setLanguage } = useLanguage();
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [iterations, setIterations] = useState<IterationSummary[]>([]);
  const [captureDraft, setCaptureDraft] = useState("");
  const [captureTitle, setCaptureTitle] = useState("");
  const [capturePrdPath, setCapturePrdPath] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [fullHelpOpen, setFullHelpOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openLogSections, setOpenLogSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadIterations() {
      try {
        const items = await listIterations();

        if (!cancelled) {
          setIterations(items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t(language, "console.error.iterationsFallback")
          );
        }
      }
    }

    void loadIterations();

    return () => {
      cancelled = true;
    };
  }, [language]);

  const isBusy = busyId !== null;
  const currentIteration = useMemo(
    () => iterations.find((item) => item.status === "active" || item.status === "reopened") ?? null,
    [iterations]
  );
  const headerSummary = useMemo(() => {
    if (!execution) {
      return currentIteration
        ? t(language, "console.hero.currentIterationSummary")
            .replace("{title}", currentIteration.title)
            .replace("{status}", translateConsoleIterationStatus(language, currentIteration.status))
        : t(language, "console.hero.emptySummary");
    }

    if (execution.kind === "action") {
      return getTranslatedActionSummary(execution, language);
    }

    return translateConsoleWorkflowSummary(language, execution.status);
  }, [currentIteration, execution, language]);

  async function handleAction(actionId: ConsoleActionId) {
    setBusyId(actionId);
    setError(null);

    try {
      const result = await runAction(actionId);
      startTransition(() => {
        setExecution(result);
        setOpenLogSections({});
      });

      if (actionId === "start-ui" && result.status === "passed") {
        openUrlFromAction(result.data);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t(language, "console.error.actionFallback"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleWorkflow(workflowId: ConsoleWorkflowId) {
    setBusyId(workflowId);
    setError(null);

    try {
      const result = await runWorkflow(workflowId);
      startTransition(() => {
        setExecution(result);
        setOpenLogSections({});
      });
    } catch (workflowError) {
      setError(
        workflowError instanceof Error ? workflowError.message : t(language, "console.error.workflowFallback")
      );
    } finally {
      setBusyId(null);
    }
  }

  function toggleLogs(sectionId: string) {
    setOpenLogSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId]
    }));
  }

  async function handleCaptureRequirement() {
    const rawRequest = captureDraft.trim();

    if (!rawRequest) {
      return;
    }

    setBusyId("capture");
    setError(null);

    try {
      const result = await captureIteration({
        rawRequest,
        title: captureTitle.trim() || undefined,
        suggestedIterationId: captureTitle.trim() ? undefined : currentIteration?.id,
        intentType: captureTitle.trim() ? "new_iteration" : currentIteration ? "iteration_extension" : undefined
      });

      startTransition(() => {
        setIterations((current) => [
          {
            id: result.iteration.id,
            title: result.iteration.title,
            status: result.iteration.status,
            updatedAt: new Date().toISOString(),
            source: "manual"
          },
          ...current.filter((item) => item.id !== result.iteration.id)
        ]);
        setCaptureDraft("");
        setCaptureTitle("");
        setCapturePrdPath(result.prdPath);
      });
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : t(language, "console.error.captureFallback")
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="console-shell">
      <div className="console-shell__backdrop" aria-hidden="true" />
      <section className="hero">
        <div className="hero__eyebrow">{t(language, "console.hero.eyebrow")}</div>
        <div className="hero__row">
          <div className="hero__copy">
            <h1>{t(language, "console.hero.title")}</h1>
            <p>{headerSummary}</p>
          </div>
          <div className="hero__actions">
            <button
              className="ghost-button ghost-button--compact"
              type="button"
              onClick={() => setLanguage(language === "zh-CN" ? "en-US" : "zh-CN")}
            >
              {getLanguageToggleLabel(language)}
            </button>
            <button className="ghost-button" type="button" onClick={() => setHelpOpen(true)}>
              {t(language, "console.help.button")}
            </button>
            <div className="hero__note">
              <strong>{t(language, "console.hero.recommendedLabel")}</strong>
              <span>{t(language, "console.hero.recommendedValue")}</span>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="status-banner status-banner--error" role="alert">
          <strong>{t(language, "console.error.title")}</strong>
          <span>{error}</span>
        </section>
      ) : null}

      <section className="panel-grid">
        <article className="panel panel--iteration">
          <div className="panel__header">
            <span className="panel__eyebrow">{t(language, "console.panel.iterationsEyebrow")}</span>
            <h2>{t(language, "console.panel.iterationsTitle")}</h2>
          </div>

          <div className="iteration-workspace">
            <div className="composer-grid">
              <label className="composer-field">
                <span>{t(language, "console.capture.titleLabel")}</span>
                <input
                  type="text"
                  value={captureTitle}
                  onChange={(event) => setCaptureTitle(event.target.value)}
                  placeholder={t(language, "console.capture.titlePlaceholder")}
                />
              </label>

              <label className="composer-field composer-field--stacked">
                <span>{t(language, "console.capture.inputLabel")}</span>
                <textarea
                  aria-label={t(language, "console.capture.inputLabel")}
                  value={captureDraft}
                  onChange={(event) => setCaptureDraft(event.target.value)}
                  placeholder={t(language, "console.capture.inputPlaceholder")}
                  rows={5}
                />
              </label>

              <div className="composer-actions">
                <button type="button" disabled={isBusy || captureDraft.trim().length === 0} onClick={() => void handleCaptureRequirement()}>
                  {busyId === "capture"
                    ? t(language, "console.capture.running")
                    : t(language, "console.capture.submit")}
                </button>
                <p className="composer-note">
                  {currentIteration
                    ? t(language, "console.capture.currentHint")
                        .replace("{title}", currentIteration.title)
                    : t(language, "console.capture.newHint")}
                </p>
                {capturePrdPath ? (
                  <code className="composer-path">{capturePrdPath}</code>
                ) : null}
              </div>
            </div>

            <div className="iteration-rail">
              <div className="iteration-rail__header">
                <strong>{t(language, "console.iteration.currentTitle")}</strong>
                <span>{t(language, "console.iteration.currentBody")}</span>
              </div>
              {iterations.length ? (
                <div className="iteration-list">
                  {iterations.map((item) => (
                    <article key={item.id} className="iteration-card">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.id}</p>
                      </div>
                      <span className={`result-badge iteration-badge iteration-badge--${item.status}`}>
                        {translateConsoleIterationStatus(language, item.status as IterationStatus)}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>{t(language, "console.iteration.emptyTitle")}</strong>
                  <p>{t(language, "console.iteration.emptyBody")}</p>
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <span className="panel__eyebrow">{t(language, "console.panel.actionsEyebrow")}</span>
            <h2>{t(language, "console.panel.actionsTitle")}</h2>
          </div>
          <div className="action-grid">
            {ACTION_CARDS.map((card) => {
              const title = getActionTitle(card.actionId, language);

              return (
                <div key={card.actionId} className="action-card">
                  <div>
                    <h3>{title}</h3>
                    <p>{getActionDescription(card.actionId, language)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleAction(card.actionId)}
                  >
                    {busyId === card.actionId ? t(language, "console.running") : title}
                  </button>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <span className="panel__eyebrow">{t(language, "console.panel.workflowsEyebrow")}</span>
            <h2>{t(language, "console.panel.workflowsTitle")}</h2>
          </div>
          <div className="workflow-grid">
            {WORKFLOW_CARDS.map((card) => {
              const title = getWorkflowTitle(card.workflowId, language);

              return (
                <div key={card.workflowId} className="workflow-card">
                  <div>
                    <h3>{title}</h3>
                    <p>{getWorkflowDescription(card.workflowId, language)}</p>
                    <div className="chip-row">
                      {card.steps.map((step) => (
                        <span key={step} className="chip">
                          {getActionTitle(step, language)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleWorkflow(card.workflowId)}
                  >
                    {busyId === card.workflowId ? t(language, "console.running") : title}
                  </button>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="panel panel--results">
        <div className="panel__header">
          <span className="panel__eyebrow">{t(language, "console.panel.resultsEyebrow")}</span>
          <h2>{t(language, "console.panel.resultsTitle")}</h2>
        </div>

        {execution === null ? (
          <div className="empty-state">
            <strong>{t(language, "console.empty.title")}</strong>
            <p>{t(language, "console.empty.description")}</p>
          </div>
        ) : execution.kind === "action" ? (
          <div className="result-card">
            <div className="result-card__row">
              <div>
                <strong>{getActionTitle(execution.actionId, language)}</strong>
                <p>{getTranslatedActionSummary(execution, language)}</p>
              </div>
              <span className={formatStatusTone(execution.status)}>
                {t(language, `console.status.${execution.status}`)}
              </span>
            </div>

            {execution.actionId === "start-ui" && execution.status === "passed" ? (
              <button
                className="link-button"
                type="button"
                onClick={() => openUrlFromAction(execution.data)}
              >
                {t(language, "console.results.openUi")}
              </button>
            ) : null}

            <button
              className="link-button"
              type="button"
              onClick={() => toggleLogs(execution.executionId)}
            >
              {openLogSections[execution.executionId]
                ? t(language, "console.logs.hide")
                : t(language, "console.logs.show")}
            </button>

            {openLogSections[execution.executionId] ? (
              <div className="log-panel">
                {execution.logs.map((logLine) => (
                  <code key={logLine}>{logLine}</code>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="result-card">
            <div className="result-card__row">
              <div>
                <strong>{getWorkflowTitle(execution.workflowId, language)}</strong>
                <p>{translateConsoleWorkflowSummary(language, execution.status)}</p>
              </div>
              <span className={formatStatusTone(execution.status)}>
                {t(language, `console.status.${execution.status}`)}
              </span>
            </div>

            <div className="step-list">
              {execution.steps.map((step) => {
                const logKey = `${execution.executionId}:${step.stepId}`;

                return (
                  <div key={logKey} className="step-card">
                    <div className="result-card__row">
                      <div>
                        <strong>{getActionTitle(step.actionId, language)}</strong>
                        <p>{getTranslatedStepSummary(step, language)}</p>
                      </div>
                      <span className={formatStatusTone(step.status)}>
                        {t(language, `console.status.${step.status}`)}
                      </span>
                    </div>
                    <button
                      className="link-button"
                      type="button"
                      onClick={() => toggleLogs(logKey)}
                    >
                      {openLogSections[logKey]
                        ? t(language, "console.logs.hide")
                        : t(language, "console.logs.show")}
                    </button>
                    {openLogSections[logKey] ? (
                      <div className="log-panel">
                        {step.logs.map((logLine) => (
                          <code key={logLine}>{logLine}</code>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {helpOpen ? (
        <div className="modal-scrim" role="presentation">
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={t(language, "console.help.modalEyebrow")}
          >
            <div className="panel__header">
              <span className="panel__eyebrow">{t(language, "console.help.modalEyebrow")}</span>
              <h2>{t(language, "console.help.modalTitle")}</h2>
            </div>
            <div className="help-list">
              {HELP_BULLET_KEYS.map((key) => (
                <p key={key}>{t(language, key)}</p>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setFullHelpOpen(true)}>
                {t(language, "console.help.viewFull")}
              </button>
              <button className="ghost-button" type="button" onClick={() => setHelpOpen(false)}>
                {t(language, "console.help.close")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {fullHelpOpen ? (
        <section className="panel panel--full-help">
          <div className="panel__header">
            <span className="panel__eyebrow">{t(language, "console.help.fullEyebrow")}</span>
            <h2>{t(language, "console.help.fullTitle")}</h2>
          </div>
          <div className="help-sections">
            <div>
              <strong>{t(language, "console.help.dailyTitle")}</strong>
              <p>{t(language, "console.help.dailyBody")}</p>
            </div>
            <div>
              <strong>{t(language, "console.help.prereleaseTitle")}</strong>
              <p>{t(language, "console.help.prereleaseBody")}</p>
            </div>
            <div>
              <strong>{t(language, "console.help.nogitTitle")}</strong>
              <p>{t(language, "console.help.nogitBody")}</p>
            </div>
            <div>
              <strong>{t(language, "console.help.troubleshootingTitle")}</strong>
              <p>{t(language, "console.help.troubleshootingBody")}</p>
            </div>
          </div>
          <button className="ghost-button" type="button" onClick={() => setFullHelpOpen(false)}>
            {t(language, "console.help.fullClose")}
          </button>
        </section>
      ) : null}
    </main>
  );
}
