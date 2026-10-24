"use client";

import { useActionState, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/form-message";
import { addComment } from "@/lib/actions/ncs";
import type { ActionState } from "@/lib/action-state";

export function CommentForm({ ncId, internal }: { ncId: string; internal: boolean }) {
  const t = useTranslations("comments");
  const ref = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();
  const [state, dispatch, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await addComment(prev, fd);
    if (r?.success) ref.current?.reset();
    return r;
  }, undefined);

  return (
    <form ref={ref} className="space-y-2 rounded-lg border p-3"
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(() => dispatch(fd)); }}>
      <input type="hidden" name="nc_id" value={ncId} />
      <Textarea name="body" required rows={3} placeholder={t("placeholder")} aria-label={t("placeholder")} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {internal ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="internal" className="size-4 accent-primary" />
            {t("internal")}
          </label>
        ) : <span />}
        <Button type="submit" size="sm" disabled={pending}><SendIcon />{t("send")}</Button>
      </div>
      <FormMessage messageKey={state?.error} />
    </form>
  );
}
