"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CloudDownloadIcon, Loader2Icon, WifiOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { offlineDb, packKey, type PackKind } from "@/lib/offline/db";
import { downloadAudit, downloadInspection } from "@/lib/offline/download";

// "Levar offline": baixa a auditoria/inspeção para o aparelho (IndexedDB) e
// guarda a tela /offline no cache do service worker.
export function TakeOfflineButton({ kind, id, userId }: { kind: PackKind; id: string; userId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const [busy, setBusy] = useState(false);
  const pack = useLiveQuery(() => offlineDb().packs.get(packKey(kind, id)), [kind, id]);

  async function download() {
    setBusy(true);
    try {
      const fn = kind === "audit" ? downloadAudit : downloadInspection;
      const r = await fn(offlineDb(), createClient(), id, userId);
      if ("error" in r) toast.error(t(r.error as never));
      else toast.success(t("offline.downloaded"));
    } catch {
      toast.error(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={download}>
        {busy ? <Loader2Icon className="animate-spin" /> : <CloudDownloadIcon />}
        {busy ? t("offline.downloading") : pack ? t("offline.refresh") : t("offline.takeOffline")}
      </Button>
      {pack && (
        <>
          <Button variant="ghost" size="sm" asChild>
            <a href={`/offline?${kind}=${id}`}><WifiOffIcon />{t("offline.openOffline")}</a>
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("offline.available", { date: format.dateTime(new Date(pack.downloadedAt), { dateStyle: "short", timeStyle: "short" }) })}
          </span>
        </>
      )}
    </div>
  );
}
