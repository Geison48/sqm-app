"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { CameraIcon, CloudUploadIcon } from "lucide-react";
import { offlineDb } from "@/lib/offline/db";

// Fotos do item: as já enviadas (baixadas com o pacote) e as tiradas no aparelho, aguardando envio.
export function OfflinePhotos({ pack, itemId, size = "size-20" }: { pack: string; itemId: string; size?: string }) {
  const t = useTranslations();
  const ref = useRef<HTMLInputElement>(null);
  const photos = useLiveQuery(() => offlineDb().photos.where("pack").equals(pack).and((p) => p.itemId === itemId).toArray(), [pack, itemId], []);
  const urls = useMemo(() => photos.map((p) => ({ id: p.id!, url: URL.createObjectURL(p.blob), name: p.name, status: p.status })), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u.url)), [urls]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const now = new Date().toISOString();
    await offlineDb().photos.bulkAdd(Array.from(files).map((f) => ({
      pack, itemId, name: f.name || `foto-${Date.now()}.jpg`, type: f.type || "image/jpeg", blob: f, status: "pending" as const, error: null, createdAt: now,
    })));
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((p) => (
        <div key={p.id} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={p.name} className={`${size} rounded-md border object-cover`} />
          {p.status !== "server" && (
            <span title={t("offline.photoPending")} className="absolute right-1 bottom-1 rounded bg-amber-500 p-0.5 text-white">
              <CloudUploadIcon className="size-3" />
            </span>
          )}
        </div>
      ))}
      <label className={`flex ${size} cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-center text-xs text-muted-foreground hover:bg-muted`}>
        <CameraIcon className="size-5" />
        {t("execute.takePhoto")}
        <input ref={ref} type="file" accept="image/*" capture="environment" multiple className="sr-only"
          aria-label={t("execute.takePhoto")} onChange={(e) => add(e.target.files)} />
      </label>
    </div>
  );
}
