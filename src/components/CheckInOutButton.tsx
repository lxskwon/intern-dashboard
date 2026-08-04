"use client";

import { useActionState, useState } from "react";
import { checkInAction, checkOutAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

/**
 * The intern's manual 출근 / 퇴근 button (own card only). Pressing 출근 → 근무중;
 * 퇴근 → 퇴근. 퇴근 is only allowed once a 기록 has been added today — pressing it
 * without one surfaces a hint instead of checking out.
 */
export function CheckInOutButton({
  userId,
  working,
  hasJournalToday,
}: {
  userId: string;
  working: boolean;
  hasJournalToday: boolean;
}) {
  const t = useT();
  const [inState, inAction, inPending] = useActionState<FormState, FormData>(checkInAction, undefined);
  const [outState, outAction, outPending] = useActionState<FormState, FormData>(checkOutAction, undefined);
  const [needJournal, setNeedJournal] = useState(false);

  if (!working) {
    return (
      <div className="checkinout">
        <form action={inAction}>
          <input type="hidden" name="userId" value={userId} />
          <button type="submit" className="btn btn-sm checkin-btn" disabled={inPending}>
            🟢 {t("출근")}
          </button>
        </form>
        {inState?.error && <span className="checkin-hint err">{inState.error}</span>}
      </div>
    );
  }

  return (
    <div className="checkinout">
      <form
        action={outAction}
        onSubmit={(e) => {
          if (!hasJournalToday) {
            e.preventDefault();
            setNeedJournal(true);
          }
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <button type="submit" className="btn btn-sm checkout-btn" disabled={outPending}>
          ⚫ {t("퇴근")}
        </button>
      </form>
      {(needJournal || outState?.error) && (
        <span className="checkin-hint err">{t("기록 추가하셔야 퇴근 버튼이 활성화 됩니다.")}</span>
      )}
    </div>
  );
}
