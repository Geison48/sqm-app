"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { activateTemplate, newTemplateVersion } from "@/lib/actions/audits";

export function TemplateActions({ templateId, status }: { templateId: string; status: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <>
      {status === "draft" && (
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await activateTemplate(templateId);
          if (r?.error) return void toast.error(t(r.error as never));
          toast.success(t("templates.activated"));
        })}>{t("templates.activate")}</Button>
      )}
      {status !== "draft" && (
        <Button variant="outline" disabled={pending} onClick={() => start(async () => {
          const r = await newTemplateVersion(templateId);
          if (r?.error) return void toast.error(t(r.error as never));
          toast.success(t("templates.versionCreated"));
          if (r?.id) router.push(`/audits/templates/${r.id}`);
        })}>{t("templates.newVersion")}</Button>
      )}
    </>
  );
}
