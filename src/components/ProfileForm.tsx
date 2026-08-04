"use client";

import { useActionState, useState } from "react";
import { updateProfileAction, type FormState } from "@/lib/actions";
import { TeamsPicker } from "@/components/TeamsPicker";
import { CloseDetails } from "@/components/CloseDetails";

export type ProfileInitial = {
  userId: string;
  name: string;
  email: string;
  teams: string[];
  mentorNames: string; // comma-separated
  phone: string;
  githubUrl: string;
  resumeName: string; // "" if none
};

/**
 * Card editor. Both the owner AND an admin (관리자/대표님) can edit every field —
 * 이름·본부·멘토·이메일·전화·GitHub·이력서. `adminEdit` only surfaces a small note
 * that an admin is editing someone else's card. Changing an already-set mentor
 * warns before overriding.
 */
export function ProfileForm({
  initial,
  adminEdit = false,
}: {
  initial: ProfileInitial;
  adminEdit?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateProfileAction,
    undefined
  );
  const [removeResume, setRemoveResume] = useState(false);
  const hasResume = initial.resumeName !== "" && !removeResume;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Warn before overriding an intern who already has a mentor assigned.
    if (initial.mentorNames.trim()) {
      const el = e.currentTarget.elements.namedItem("mentorNames") as HTMLInputElement | null;
      const next = (el?.value ?? "").trim();
      if (next !== initial.mentorNames.trim() && !confirm("이미 멘토가 배정되어 있습니다. 변경하시겠습니까?")) {
        e.preventDefault();
      }
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} style={{ maxWidth: 560 }}>
      <input type="hidden" name="userId" value={initial.userId} />
      <input type="hidden" name="removeResume" value={removeResume ? "1" : "0"} />
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          저장되었습니다.
        </div>
      )}
      {adminEdit && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          관리자 편집 — 인턴 정보의 모든 항목을 수정할 수 있어요.
        </p>
      )}

      <div className="row">
        <div className="field">
          <label>이름 *</label>
          <input name="name" defaultValue={initial.name} required />
        </div>
        <div className="field">
          <label>이메일 *</label>
          <input name="email" type="email" defaultValue={initial.email} required />
        </div>
      </div>
      <div className="field">
        <label>본부 (여러 개 선택 가능)</label>
        <TeamsPicker initial={initial.teams} />
      </div>
      <div className="field">
        <label>멘토 이름</label>
        <input
          name="mentorNames"
          defaultValue={initial.mentorNames}
          placeholder="멘토 이름 (여러 명은 쉼표로 구분)"
        />
        <span className="muted" style={{ fontSize: 11.5, marginTop: 4, display: "block" }}>
          멘토가 여러 명이면 쉼표(,)로 구분해 입력하세요. 예: 홍길동, 김철수
        </span>
      </div>
      <div className="row">
            <div className="field">
              <label>전화번호</label>
              <input name="phone" type="tel" defaultValue={initial.phone} placeholder="010-0000-0000" />
            </div>
            <div className="field">
              <label>GitHub</label>
              <input
                name="githubUrl"
                type="url"
                defaultValue={initial.githubUrl}
                placeholder="https://github.com/…"
              />
            </div>
          </div>

          <div className="field">
            <label>이력서 (PDF · 본인과 관리자만 열람 가능)</label>
            {hasResume ? (
              <div className="inline" style={{ gap: 10, flexWrap: "wrap" }}>
                <span className="task-pill">📄 {initial.resumeName}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => setRemoveResume(true)}
                >
                  이력서 삭제
                </button>
                <span className="muted" style={{ fontSize: 12 }}>새 파일을 올리면 교체됩니다.</span>
              </div>
            ) : removeResume ? (
              <div className="inline" style={{ gap: 10 }}>
                <span className="muted" style={{ fontSize: 12.5 }}>저장 시 삭제됩니다.</span>
                <button type="button" className="btn btn-sm" onClick={() => setRemoveResume(false)}>
                  취소
                </button>
              </div>
            ) : null}
            {!removeResume && (
              <input name="resume" type="file" accept=".pdf,.doc,.docx" style={{ marginTop: 8 }} />
            )}
          </div>

      <div className="inline" style={{ gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </button>
        <CloseDetails className="btn" />
      </div>
    </form>
  );
}
