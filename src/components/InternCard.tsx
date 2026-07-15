import Link from "next/link";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import { fmtShort } from "@/lib/format";
import type { Schedule } from "@/lib/constants";

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
  team: string | null;
  photoUrl: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  schedules: Schedule[];
  mentorName: string | null;
  ended: boolean;
  away: boolean;
  tasks: TaskSummary[];
};

const MAX_CHIPS = 2;

function TaskChips({ tasks, internId }: { tasks: TaskSummary[]; internId: string }) {
  if (tasks.length === 0) {
    return <span className="muted no-tasks" style={{ fontSize: 13 }}>진행중인 업무 없음</span>;
  }
  const shown = tasks.slice(0, MAX_CHIPS);
  const extra = tasks.length - shown.length;
  return (
    <div className="task-chip-list">
      {shown.map((t) => (
        <Link key={t.id} href={`/tasks/${t.id}`} className="task-chip">
          <span className="task-chip-left">
            {t.dday && (
              <span
                className={`dday${t.dday.overdue ? " overdue" : t.dday.soon ? " soon" : ""}`}
              >
                {t.dday.label}
              </span>
            )}
            <span className="task-chip-title">{t.title}</span>
          </span>
          <span className={`task-chip-meta${t.stale ? " stale" : ""}`}>
            {t.stale ? "⚠️ " : ""}
            {t.entryCount > 0 ? `기록 ${t.entryCount}` : "기록 없음"}
            {t.lastEntry ? ` · 최근 ${fmtShort(t.lastEntry)}` : ""}
          </span>
        </Link>
      ))}
      {extra > 0 && (
        <Link href={`/interns/${internId}`} className="task-more">
          그외 {extra}건 · 상세보기 →
        </Link>
      )}
    </div>
  );
}

function Status({ intern }: { intern: CardIntern }) {
  return <StatusBadge ended={intern.ended} away={intern.away} schedules={intern.schedules} />;
}

export function InternCard({
  intern,
  variant = "grid",
}: {
  intern: CardIntern;
  variant?: "grid" | "list";
}) {
  const duration =
    intern.startDate || intern.endDate
      ? `${fmtShort(intern.startDate)} – ${fmtShort(intern.endDate)}`
      : "미설정";

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
              <Status intern={intern} />
            </div>
            <span className="meta-line">
              {intern.team ?? "팀 없음"} · 멘토: {intern.mentorName ?? "미지정"} · {duration}
            </span>
          </div>
        </div>
        <div className="intern-row-tasks">
          <TaskChips tasks={intern.tasks} internId={intern.id} />
        </div>
      </div>
    );
  }

  return (
    <div className={`intern-card${intern.ended ? " is-ended" : ""}`}>
      <div className="intern-card-top">
        <Avatar name={intern.name} photoUrl={intern.photoUrl} size={52} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link href={`/interns/${intern.id}`} className="intern-name">
            {intern.name}
          </Link>
          <div className="meta-line">{intern.team ?? "팀 없음"}</div>
        </div>
        <Status intern={intern} />
      </div>

      <dl className="card-meta">
        <div>
          <dt>멘토</dt>
          <dd>{intern.mentorName ?? <span className="muted">미지정</span>}</dd>
        </div>
        <div>
          <dt>인턴 기간</dt>
          <dd>{duration}</dd>
        </div>
      </dl>

      <div className="card-tasks">
        <div className="card-tasks-label">업무 진행현황</div>
        <TaskChips tasks={intern.tasks} internId={intern.id} />
      </div>
    </div>
  );
}
