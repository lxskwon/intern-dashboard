"use client";

import { useActionState } from "react";
import { updateProfileAction, type FormState } from "@/lib/actions";
import { TEAMS } from "@/lib/constants";

export type ProfileInitial = {
  userId: string;
  name: string;
  email: string;
  team: string;
  mentorName: string;
};

/** Self-service card editor (identity, team, mentor name). */
export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateProfileAction,
    undefined
  );

  return (
    <form action={formAction} style={{ maxWidth: 560 }}>
      <input type="hidden" name="userId" value={initial.userId} />
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          저장되었습니다.
        </div>
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
      <div className="row">
        <div className="field">
          <label>팀</label>
          <select name="team" defaultValue={initial.team}>
            <option value="">미지정</option>
            {initial.team && !TEAMS.includes(initial.team) && (
              <option value={initial.team}>{initial.team}</option>
            )}
            {TEAMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>멘토 이름</label>
          <input name="mentorName" defaultValue={initial.mentorName} placeholder="멘토 이름을 입력" />
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
