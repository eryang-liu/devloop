import { startTransition, useEffect, useState } from "react";
import type { ColumnsType } from "antd/es/table";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Empty from "antd/es/empty";
import Spin from "antd/es/spin";
import Table from "antd/es/table";
import Tag from "antd/es/tag";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import {
  formatLocaleDateTime,
  getLanguageToggleLabel,
  t,
  translateConsoleIterationStatus,
  translateDashboardConfidence,
  translateDashboardFeatureStatus,
  translateDashboardMode,
  translateDashboardRequirement,
  translateDashboardRunStatus,
  translateDashboardScope,
  useLanguage
} from "@devloop/shared-frontend";
import {
  getDashboardData,
  type FeatureStatus,
  type ImpactRecord,
  type IterationOverview,
  type ReleaseCheckResult,
  type Revision,
  type StatusSummary,
  type TestRun
} from "./api.js";

type DashboardSnapshot = {
  status: StatusSummary;
  queue: ImpactRecord[];
  runs: TestRun[];
  release: ReleaseCheckResult;
  iterations: IterationOverview[];
  fetchedAt: string;
};

const DASHBOARD_THEME = {
  token: {
    colorPrimary: "#b14f33",
    colorInfo: "#b14f33",
    colorSuccess: "#2f7a54",
    colorWarning: "#c98a32",
    colorError: "#b3402c",
    borderRadius: 18,
    colorBgBase: "#f4ede2",
    colorTextBase: "#231913",
    fontFamily: '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif'
  }
} as const;

const STATUS_ORDER: FeatureStatus[] = [
  "tested",
  "changed_untested",
  "rework_untested",
  "failed",
  "needs-triage",
  "never_tested"
];

const STATUS_TONE: Record<
  FeatureStatus,
  "green" | "gold" | "orange" | "volcano" | "red" | "default"
> = {
  tested: "green",
  changed_untested: "gold",
  rework_untested: "orange",
  failed: "volcano",
  "needs-triage": "red",
  never_tested: "default"
};

const CONFIDENCE_COLOR: Record<ImpactRecord["confidence"], string> = {
  high: "red",
  medium: "gold",
  low: "default"
};

function formatRelativeStamp(language: "en-US" | "zh-CN", value: string | null) {
  if (!value) {
    return t(language, "dashboard.timestamp.none");
  }

  return formatLocaleDateTime(language, value, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatSha(value: string) {
  return value.slice(0, 7);
}

function formatRevision(revision: Revision) {
  if (revision.kind === "git") {
    return formatSha(revision.commitSha);
  }

  return revision.snapshotId;
}

function formatRequirement(language: "en-US" | "zh-CN", requirement: string) {
  return translateDashboardRequirement(language, requirement);
}

function formatModeLabel(language: "en-US" | "zh-CN", mode: StatusSummary["vcs"]["mode"]) {
  return translateDashboardMode(language, mode);
}

function formatRunStatus(language: "en-US" | "zh-CN", status: TestRun["status"]) {
  if (status === "passed") {
    return { label: translateDashboardRunStatus(language, status), tone: "green" as const };
  }

  if (status === "failed") {
    return { label: translateDashboardRunStatus(language, status), tone: "red" as const };
  }

  if (status === "partial") {
    return { label: translateDashboardRunStatus(language, status), tone: "gold" as const };
  }

  return { label: translateDashboardRunStatus(language, status), tone: "default" as const };
}

function getGateTone(decision: ReleaseCheckResult["decision"] | undefined) {
  if (decision === "pass") {
    return "gate-card--pass";
  }

  if (decision === "warn") {
    return "gate-card--warn";
  }

  return "gate-card--block";
}

function getGateTagColor(decision: ReleaseCheckResult["decision"]) {
  if (decision === "pass") {
    return "green";
  }

  if (decision === "warn") {
    return "gold";
  }

  return "red";
}

export default function App() {
  const { language, setLanguage } = useLanguage();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadDashboard() {
      setError(null);

      try {
        const isFirstLoad = requestVersion === 0;
        const { status, queue, runs, release, iterations } = await getDashboardData(
          isFirstLoad
            ? { dedupeKey: "initial-dashboard-load" }
            : { signal: controller.signal }
        );

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSnapshot({
            status,
            queue,
            runs,
            release,
            iterations,
            fetchedAt: new Date().toISOString()
          });
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestVersion]);

  const totalFeatures = snapshot
    ? STATUS_ORDER.reduce((total, statusKey) => total + snapshot.status.counts[statusKey], 0)
    : 0;

  const attentionCount = snapshot
    ? snapshot.status.highRiskFeatures.length +
      snapshot.release.unmetRequirements.length +
      snapshot.queue.length +
      snapshot.iterations.length
    : 0;

  const gateTone = getGateTone(snapshot?.release.decision);
  const columns: ColumnsType<ImpactRecord> = [
    {
      title: t(language, "dashboard.table.feature"),
      dataIndex: "featureId",
      key: "featureId",
      render: (value: string) => <span className="table-feature">{value}</span>
    },
    {
      title: t(language, "dashboard.table.confidence"),
      dataIndex: "confidence",
      key: "confidence",
      render: (value: ImpactRecord["confidence"]) => (
        <Tag color={CONFIDENCE_COLOR[value]} className="table-tag">
          {translateDashboardConfidence(language, value)}
        </Tag>
      )
    },
    {
      title: t(language, "dashboard.table.scope"),
      dataIndex: "recommendedScope",
      key: "recommendedScope",
      render: (value: ImpactRecord["recommendedScope"]) => (
        <Tag className="table-tag table-tag--scope">{translateDashboardScope(language, value)}</Tag>
      )
    },
    {
      title: t(language, "dashboard.table.signals"),
      dataIndex: "reasons",
      key: "reasons",
      render: (reasons: string[]) =>
        reasons.length > 0 ? (
          <div className="reason-list">
            {reasons.map((reason) => (
              <span key={reason} className="reason-chip">
                {reason}
              </span>
            ))}
          </div>
        ) : (
          <span className="muted">{t(language, "dashboard.table.noSignals")}</span>
        )
    },
    {
      title: t(language, "dashboard.table.observed"),
      dataIndex: "detectedAt",
      key: "detectedAt",
      render: (value: string) => <span className="muted">{formatRelativeStamp(language, value)}</span>
    },
    {
      title: t(language, "dashboard.table.revision"),
      dataIndex: "sourceRevision",
      key: "sourceRevision",
      render: (value: Revision) => <code className="sha-chip">{formatRevision(value)}</code>
    }
  ];

  return (
    <ConfigProvider locale={language === "zh-CN" ? zhCN : enUS} theme={DASHBOARD_THEME}>
      {isLoading && snapshot === null ? (
        <main className="shell shell--loading">
          <div className="loading-panel">
            <Spin size="large" />
            <p>{t(language, "dashboard.loading")}</p>
          </div>
        </main>
      ) : snapshot === null ? (
        <main className="shell shell--loading">
          <div className="loading-panel loading-panel--error">
            <h1>{t(language, "dashboard.unavailableTitle")}</h1>
            <p>{error ?? t(language, "dashboard.unavailableBody")}</p>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                setIsLoading(true);
                setRequestVersion((value) => value + 1);
              }}
            >
              {t(language, "dashboard.retryInitial")}
            </Button>
          </div>
        </main>
      ) : (
        <main className="shell">
          <div className="shell__backdrop" aria-hidden="true" />
          <section className="masthead">
            <div className="masthead__eyebrow">{t(language, "dashboard.masthead.eyebrow")}</div>
            <div className="masthead__row">
              <div>
                <h1>{t(language, "dashboard.masthead.title")}</h1>
                <p className="masthead__copy">{t(language, "dashboard.masthead.copy")}</p>
              </div>
              <div className="masthead__actions">
                <Button
                  className="language-toggle"
                  onClick={() => setLanguage(language === "zh-CN" ? "en-US" : "zh-CN")}
                >
                  {getLanguageToggleLabel(language)}
                </Button>
                <div className="masthead__stamp">
                  <span>{t(language, "dashboard.masthead.mode")}</span>
                  <strong>{formatModeLabel(language, snapshot.status.vcs.mode)}</strong>
                </div>
                <div className="masthead__stamp">
                  <span>{t(language, "dashboard.masthead.lastRefresh")}</span>
                  <strong>
                    {snapshot ? formatRelativeStamp(language, snapshot.fetchedAt) : t(language, "dashboard.masthead.pending")}
                  </strong>
                </div>
                <Button
                  type="primary"
                  size="large"
                  loading={isRefreshing}
                  onClick={() => {
                    setIsRefreshing(true);
                    setRequestVersion((value) => value + 1);
                  }}
                >
                  {t(language, "dashboard.refresh")}
                </Button>
              </div>
            </div>
          </section>

          {error ? (
            <Alert
              className="banner"
              message={t(language, "dashboard.banner.title")}
              description={error}
              type="error"
              showIcon
            />
          ) : null}

          <section className="hero-grid">
            <article className={`gate-card ${gateTone}`}>
              <div className="gate-card__header">
                <span className="panel-label">{t(language, "dashboard.gate.eyebrow")}</span>
                <Tag color={getGateTagColor(snapshot.release.decision)}>
                  {snapshot.release.decision === "pass"
                    ? t(language, "dashboard.gate.passTag")
                    : snapshot.release.decision === "warn"
                      ? t(language, "dashboard.gate.warnTag")
                      : t(language, "dashboard.gate.blockTag")}
                </Tag>
              </div>
              <div className="gate-card__value">
                {snapshot.release.decision === "pass"
                  ? t(language, "dashboard.gate.passValue")
                  : snapshot.release.decision === "warn"
                    ? t(language, "dashboard.gate.warnValue")
                    : t(language, "dashboard.gate.blockValue")}
              </div>
              <p className="gate-card__summary">
                {snapshot.release.unmetRequirements.length
                  ? `${snapshot.release.unmetRequirements.length} ${t(language, "dashboard.gate.unmetSuffix")}`
                  : t(language, "dashboard.gate.unmetNone")}
              </p>
              <div className="gate-card__detail-list">
                {snapshot.release.unmetRequirements.length ? (
                  snapshot.release.unmetRequirements.map((requirement) => (
                    <span key={requirement} className="detail-pill detail-pill--critical">
                      {formatRequirement(language, requirement)}
                    </span>
                  ))
                ) : (
                  <span className="detail-pill detail-pill--calm">
                    {t(language, "dashboard.gate.covered")}
                  </span>
                )}
              </div>
              {snapshot.release.notes.length ? (
                <p className="gate-card__summary">{snapshot.release.notes.join(" ")}</p>
              ) : null}
            </article>

            <article className="overview-panel">
              <div className="overview-panel__grid">
                <div className="metric-tile">
                  <span className="panel-label">{t(language, "dashboard.metric.featureMap")}</span>
                  <strong>{totalFeatures}</strong>
                  <p>{t(language, "dashboard.metric.featureMapBody")}</p>
                </div>
                <div className="metric-tile">
                  <span className="panel-label">{t(language, "dashboard.metric.p0Attention")}</span>
                  <strong>{snapshot.status.highRiskFeatures.length}</strong>
                  <p>{t(language, "dashboard.metric.p0AttentionBody")}</p>
                </div>
                <div className="metric-tile">
                  <span className="panel-label">{t(language, "dashboard.metric.impactQueue")}</span>
                  <strong>{snapshot.queue.length}</strong>
                  <p>{t(language, "dashboard.metric.impactQueueBody")}</p>
                </div>
                <div className="metric-tile">
                  <span className="panel-label">{t(language, "dashboard.metric.pressure")}</span>
                  <strong>{attentionCount}</strong>
                  <p>{t(language, "dashboard.metric.pressureBody")}</p>
                </div>
              </div>
              <div className="sync-strip">
                <span className="panel-label">{t(language, "dashboard.sync.label")}</span>
                <strong>{formatRelativeStamp(language, snapshot.status.lastSyncAt)}</strong>
              </div>
              {snapshot.status.vcs.upgradedFromSnapshotAt ? (
                <div className="sync-strip">
                  <span className="panel-label">{t(language, "dashboard.sync.upgradeBridge")}</span>
                  <strong>
                    {formatRelativeStamp(language, snapshot.status.vcs.upgradedFromSnapshotAt)}
                  </strong>
                </div>
              ) : null}
            </article>
          </section>

          <section className="content-grid">
            <article className="panel">
              <div className="panel__header">
                <div>
                  <span className="panel-label">{t(language, "dashboard.panel.ledgerEyebrow")}</span>
                  <h2>{t(language, "dashboard.panel.ledgerTitle")}</h2>
                </div>
              </div>
              <div className="ledger-grid">
                {STATUS_ORDER.map((statusKey) => (
                  <div key={statusKey} className={`ledger-card ledger-card--${statusKey}`}>
                    <span>{translateDashboardFeatureStatus(language, statusKey)}</span>
                    <strong>{snapshot.status.counts[statusKey]}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel__header">
                <div>
                  <span className="panel-label">{t(language, "dashboard.panel.watchEyebrow")}</span>
                  <h2>{t(language, "dashboard.panel.watchTitle")}</h2>
                </div>
              </div>
              {snapshot.status.highRiskFeatures.length ? (
                <div className="watchlist">
                  {snapshot.status.highRiskFeatures.map((feature) => (
                    <div key={feature.featureId} className="watchlist__item">
                      <div>
                        <strong>{feature.featureId}</strong>
                        <p>{t(language, "dashboard.panel.watchBody")}</p>
                      </div>
                      <Tag color={STATUS_TONE[feature.status]}>
                        {translateDashboardFeatureStatus(language, feature.status)}
                      </Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t(language, "dashboard.panel.watchEmpty")}
                />
              )}
            </article>

            <article className="panel">
              <div className="panel__header">
                <div>
                  <span className="panel-label">{t(language, "dashboard.panel.iterationsEyebrow")}</span>
                  <h2>{t(language, "dashboard.panel.iterationsTitle")}</h2>
                </div>
              </div>
              {snapshot.iterations.length ? (
                <div className="watchlist">
                  {snapshot.iterations.map((iteration: IterationOverview) => (
                    <div key={iteration.id} className="watchlist__item">
                      <div>
                        <strong>{iteration.title}</strong>
                        <p>
                          <span>
                            {t(language, "dashboard.iteration.acceptancePending").replace(
                              "{count}",
                              String(iteration.acceptancePending)
                            )}
                          </span>{" "}
                          ·{" "}
                          <span>
                            {t(language, "dashboard.iteration.regressionPending").replace(
                              "{count}",
                              String(iteration.regressionPending)
                            )}
                          </span>
                        </p>
                      </div>
                      <Tag className="table-tag table-tag--scope">
                        {translateConsoleIterationStatus(language, iteration.status)}
                      </Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t(language, "dashboard.panel.iterationsEmpty")}
                />
              )}
            </article>

            <article className="panel">
              <div className="panel__header">
                <div>
                  <span className="panel-label">{t(language, "dashboard.panel.runsEyebrow")}</span>
                  <h2>{t(language, "dashboard.panel.runsTitle")}</h2>
                </div>
              </div>
              {snapshot.runs.length ? (
                <div className="watchlist">
                  {snapshot.runs.map((run) => {
                    const runStatus = formatRunStatus(language, run.status);

                    return (
                      <div key={run.run_id} className="watchlist__item">
                        <div>
                          <strong>{run.run_id}</strong>
                          <p>
                            {translateDashboardScope(language, run.scope)} · {run.scenario_ids.join(", ")} ·{" "}
                            {run.executed_at
                              ? formatRelativeStamp(language, run.executed_at)
                              : formatRevision(run.revision)}
                          </p>
                        </div>
                        <Tag color={runStatus.tone}>{runStatus.label}</Tag>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t(language, "dashboard.panel.runsEmpty")}
                />
              )}
            </article>
          </section>

          <section className="panel panel--table">
            <div className="panel__header">
              <div>
                <span className="panel-label">{t(language, "dashboard.panel.queueEyebrow")}</span>
                <h2>{t(language, "dashboard.panel.queueTitle")}</h2>
              </div>
              <p className="panel__hint">{t(language, "dashboard.panel.queueHint")}</p>
            </div>
            <Table
              className="impact-table"
              columns={columns}
              dataSource={snapshot.queue}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t(language, "dashboard.table.empty")}
                  />
                )
              }}
              pagination={false}
              rowKey={(record) =>
                `${record.featureId}-${record.detectedAt}-${formatRevision(record.sourceRevision)}`
              }
            />
          </section>
        </main>
      )}
    </ConfigProvider>
  );
}
