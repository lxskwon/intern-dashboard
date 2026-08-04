import Link from "next/link";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import { AdminNoteBadge } from "./AdminNoteBadge";
import { fmtShort } from "@/lib/format";
import { getT, getLocale } from "@/lib/i18n-server";
import type { Translator } from "@/lib/i18n";
import type { Schedule, WorkBounds, CheckState } from "@/lib/constants";

export type TaskSummary = {
  id: string;
  title: string;
  entryCount: number;
  lastEntry: Date | string | null;
  stale: boolean;
  dday: { label: string; overdue: boolean; soon: boolean } | null;
};

export type CardIntern = {
  id: string;
  name: string;
  teams: string[];
  photoUrl: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  schedules: Schedule[];
  bounds?: WorkBounds;
  check?: CheckState;
  mentorName: string | null;
  ended: boolean;
  away: boolean;
  withdrawn?: boolean;
  internLead?: boolean;
  tasks: TaskSummary[];
  // Present only for admins; drives the sticky-note badge next to the name.
  adminNote?: string | null;
  // Set only when viewing all cohorts; shows a small cohort chip on the card.
  cohortLabel?: string | null;
};

const MAX_CHIPS = 2;

function TaskChips({
  tasks,
  internId,
  t,
  locale,
}: {
  tasks: TaskSummary[];
  internId: string;
  t: Translator;
  locale: "ko" | "en";
}) {
  if (tasks.length === 0) {
    return <span className="muted no-tasks" style={{ fontSize: 13 }}>{t("진행중인 업무 없음")}</span>;
  }
  const shown = tasks.slice(0, MAX_CHIPS);
  const extra = tasks.length - shown.length;
  return (
    <div className="task-chip-list">
      {shown.map((task) => (
        <Link key={task.id} href={`/tasks/${task.id}`} className="task-chip">
          <span className="task-chip-left">
            {task.dday && (
              <span
                className={`dday${task.dday.overdue ? " overdue" : task.dday.soon ? " soon" : ""}`}
              >
                {task.dday.label}
              </span>
            )}
            <span className="task-chip-title">{task.title}</span>
          </span>
          <span className={`task-chip-meta${task.stale ? " stale" : ""}`}>
            {task.stale ? "⚠️ " : ""}
            {task.entryCount > 0 ? t("기록 {n}", { n: task.entryCount }) : t("기록 없음")}
            {task.lastEntry ? ` · ${t("최근")} ${fmtShort(task.lastEntry, locale)}` : ""}
          </span>
        </Link>
      ))}
      {extra > 0 && (
        <Link href={`/interns/${internId}`} className="task-more">
          {t("그외 {n}건 · 상세보기 →", { n: extra })}
        </Link>
      )}
    </div>
  );
}

function Status({ intern }: { intern: CardIntern }) {
  return (
    <StatusBadge
      ended={intern.ended}
      away={intern.away}
      schedules={intern.schedules}
      bounds={intern.bounds}
      check={intern.check}
    />
  );
}

export async function InternCard({
  intern,
  variant = "grid",
}: {
  intern: CardIntern;
  variant?: "grid" | "list";
}) {
  const t = await getT();
  const locale = await getLocale();
  const duration =
    intern.startDate || intern.endDate
      ? `${fmtShort(intern.startDate, locale)} – ${fmtShort(intern.endDate, locale)}`
      : t("미설정");

  if (variant === "list") {
    return (
      <div className={`intern-row${intern.ended ? " is-ended" : ""}`}>
        <div className="intern-row-main">
          <Avatar name={intern.name} photoUrl={intern.photoUrl} size={40} />
          <div className="intern-row-id">
            <div className="intern-row-nameline">
              <Link href={`/interns/${intern.id}`} className="intern-name">
                {intern.name}
              </Link>
              {intern.withdrawn && <span className="withdrawn-tag">{t("탈퇴")}</span>}
              {intern.internLead && <span className="lead-tag">{t("인턴 대표")}</span>}
              {intern.adminNote && <AdminNoteBadge note={intern.adminNote} />}
              <Status intern={intern} />
            </div>
            <span className="meta-line">
              {intern.teams.length ? intern.teams.join(" · ") : t("팀 없음")} · {t("멘토")}: {intern.mentorName ?? t("미지정")} · {duration}
              {intern.cohortLabel && <span className="cohort-tag">{intern.cohortLabel}</span>}
            </span>
          </div>
        </div>
        <div className="intern-row-tasks">
          <TaskChips tasks={intern.tasks} internId={intern.id} t={t} locale={locale} />
        </div>
      </div>
    );
  }

  return (
    <div className={`intern-card${intern.ended ? " is-ended" : ""}`}>
      <div className="intern-card-top">
        <Avatar name={intern.name} photoUrl={intern.photoUrl} size={52} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="intern-card-nameline">
            <Link href={`/interns/${intern.id}`} className="intern-name">
              {intern.name}
            </Link>
            {intern.withdrawn && <span className="withdrawn-tag">{t("탈퇴")}</span>}
            {intern.internLead && <span className="lead-tag">{t("인턴 대표")}</span>}
            {intern.adminNote && <AdminNoteBadge note={intern.adminNote} />}
          </div>
          <div className="meta-line">
            {intern.teams.length ? intern.teams.join(" · ") : t("팀 없음")}
            {intern.cohortLabel && <span className="cohort-tag">{intern.cohortLabel}</span>}
          </div>
        </div>
        <Status intern={intern} />
      </div>

      <dl className="card-meta">
        <div>
          <dt>{t("멘토")}</dt>
          <dd>{intern.mentorName ?? <span className="muted">{t("미지정")}</span>}</dd>
        </div>
        <div>
          <dt>{t("인턴 기간")}</dt>
          <dd>{duration}</dd>
        </div>
      </dl>

      <div className="card-tasks">
        <div className="card-tasks-label">{t("업무 진행현황")}</div>
        <TaskChips tasks={intern.tasks} internId={intern.id} t={t} locale={locale} />
      </div>
    </div>
  );
}
