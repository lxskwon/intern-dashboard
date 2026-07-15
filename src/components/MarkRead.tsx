"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markCardSeenAction, markConversationSeenAction } from "@/lib/actions";

/**
 * Clears notifications as soon as content is opened, then refreshes so the nav
 * badges update immediately. With partnerId → marks a conversation read; without
 * → marks an intern card's comments seen.
 */
export function MarkRead({ internId, partnerId }: { internId: string; partnerId?: string }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      if (partnerId) await markConversationSeenAction(internId, partnerId);
      else await markCardSeenAction(internId);
      router.refresh();
    })();
  }, [internId, partnerId, router]);

  return null;
}
