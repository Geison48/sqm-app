"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CameraIcon, Loader2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerAttachment } from "@/lib/actions/attachments";
import type { UploadTarget } from "./attachment-buttons";

// Botão compacto de foto pela câmera (celular) ou arquivo; várias por vez.
export function PhotoUpload({ target, label }: { target: UploadTarget; label: string }) {
  const t = useTranslations();
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const path = `${target.supplierId ?? "internal"}/${crypto.randomUUID()}/${file.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type || undefined });
      if (error) { toast.error(t("errors.uploadFailed")); continue; }
      const r = await registerAttachment({ ...target, storagePath: path, fileName: file.name, mimeType: file.type || null,
        sizeBytes: file.size, internalOnly: false, supersedesId: null, description: null });
      if (r?.error) toast.error(t(r.error as never));
    }
    setBusy(false);
    if (ref.current) ref.current.value = "";
    router.refresh();
  }

  return (
    <label className="inline-flex size-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-[10px] text-muted-foreground hover:bg-muted">
      {busy ? <Loader2Icon className="size-4 animate-spin" /> : <CameraIcon className="size-4" />}
      <span className="px-1 text-center leading-tight">{label}</span>
      <input ref={ref} type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label={label}
        onChange={(e) => upload(e.target.files)} />
    </label>
  );
}
