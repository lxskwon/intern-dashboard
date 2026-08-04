"use client";

import { useActionState, useState } from "react";
import { checkInAction, checkOutAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

/**
 * Topbar 출근 / 퇴근 toggle for the intern's own session. The active side shows
 * their current state; clicking the other side transitions. 퇴근 is gated on
 * having a 기록 (journal entry) today — otherwise a hint appears.
 */
export function CheckInToggle({
  userId,
  working,
  hasJournalToday,
}: {
  userId: string;
  working: boolean;
  hasJournalToday: boolean;
}) {
  const t = useT();
  const [, inAction, inPending] = useActionState<FormState, FormData>(checkInAction, undefined);
  const [, outAction, outPending] = useActionState<FormState, FormData>(checkOutAction, undefined);
  const [needJournal, setNeedJournal] = useState(false);

  return (
    <div className="check-toggle-wrap">
      <div className="check-toggle" role="group" aria-label={t("출근 / 퇴근")}>
        <form action={inAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className={`check-in${working ? " active" : ""}`}
            disabled={inPending || working}
            aria-pressed={working}
          >
            {t("출근")}
          </button>
        </form>
        <form
          action={outAction}
          onSubmit={(e) => {
            if (!hasJournalToday) {
              e.preventDefault();
              setNeedJournal(true);
              setTimeout(() => setNeedJournal(false), 4000);
            }
          }}
        >
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className={`check-out${!working ? " active" : ""}`}
            disabled={outPending || !working}
            aria-pressed={!working}
          >
            {t("퇴근")}
          </button>
        </form>
      </div>
      {needJournal && (
        <div className="check-toggle-hint">{t("기록 추가하셔야 퇴근 버튼이 활성화 됩니다.")}</div>
      )}
    </div>
  );
}
