"use client";

import { useActionState, useEffect, useState } from "react";
import { assignMentorAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

type Option = { id: string; name: string };

/** Admin form to pair a mentor with an intern. If the intern already has a
 * mentor, clicking 배정 asks whether to add another or replace; and re-assigning
 * an existing pair shows a "이미 배정" notice instead of silently re-emailing. */
export function AssignForm({
  mentors,
  interns,
  assignments,
}: {
  mentors: Option[];
  interns: Option[];
  assignments: Record<string, string[]>; // internId → current mentor names
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    assignMentorAction,
    undefined
  );
  const [mentorId, setMentorId] = useState("");
  const [internId, setInternId] = useState("");
  const [confirmExisting, setConfirmExisting] = useState<string[] | null>(null);
  const [dup, setDup] = useState(false);

  const mentorName = mentors.find((m) => m.id === mentorId)?.name ?? "";
  const lc = (s: string) => s.trim().toLowerCase();

  // Clear the form once an assignment goes through.
  useEffect(() => {
    if (state?.ok) {
      setMentorId("");
      setInternId("");
      setConfirmExisting(null);
      setDup(false);
    }
  }, [state]);

  const reset = () => {
    setMentorId("");
    setInternId("");
    setConfirmExisting(null);
    setDup(false);
  };

  const run = (mode: "add" | "override") => {
    const fd = new FormData();
    fd.set("mentorId", mentorId);
    fd.set("internId", internId);
    fd.set("mode", mode);
    setConfirmExisting(null);
    setDup(false);
    formAction(fd);
  };

  const onAssign = () => {
    setDup(false);
    if (!mentorId || !internId) return;
    const current = assignments[internId] ?? [];
    if (current.some((n) => lc(n) === lc(mentorName))) {
      setDup(true); // this exact pair already exists
      return;
    }
    if (current.length > 0) {
      setConfirmExisting(current); // intern already has other mentor(s)
      return;
    }
    run("add");
  };

  const onChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.currentTarget.value);
    setDup(false);
    setConfirmExisting(null);
  };

  return (
    <div>
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          {t("배정되었습니다. 두 사람에게 이메일로 알렸어요.")}
        </div>
      )}
      {dup && (
        <div
          className="alert"
          style={{ background: "#fef9c3", color: "#a16207", borderColor: "#fde68a" }}
        >
          {t("이미 배정되어 있는 멘토·인턴입니다.")}
        </div>
      )}
      <div className="inline" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>{t("멘토")}</label>
          <select value={mentorId} onChange={onChange(setMentorId)}>
            <option value="">{t("선택")}</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>{t("인턴")}</label>
          <select value={internId} onChange={onChange(setInternId)}>
            <option value="">{t("선택")}</option>
            {interns.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label aria-hidden="true" style={{ visibility: "hidden" }}>&nbsp;</label>
          <span className="cohort-btn-cell" style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={pending || !mentorId || !internId}
              onClick={onAssign}
            >
              {pending ? t("배정 중…") : t("배정")}
            </button>
            <button type="button" className="btn btn-sm" onClick={reset}>
              {t("초기화")}
            </button>
          </span>
        </div>
      </div>

      {confirmExisting && (
        <div className="assign-confirm">
          <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
            {t("이 인턴에게는 이미 멘토가 배정되어 있어요.")}
          </p>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            {t("현재 멘토: {names}", { names: confirmExisting.join(", ") })}
          </p>
          <div className="inline" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => run("add")}>
              {t("새 멘토 추가")}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => run("override")}>
              {t("멘토 변경 (기존 멘토 대체)")}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setConfirmExisting(null)}>
              {t("취소")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
