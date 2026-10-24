"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DownloadIcon, FilePlus2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { createClient } from "@/lib/supabase/client";
import { getAttachmentUrl, registerAttachment } from "@/lib/actions/attachments";

export type UploadTarget = {
  entityTable: Parameters<typeof registerAttachment>[0]["entityTable"];
  entityId: string;
  supplierId: string | null;
  path: string;
  /** Categoria opcional (ex.: "before"/"after" nos reparos). */
  category?: string;
};

const MAX_BYTES = 50 * 1024 * 1024;

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120);
}

export function AttachmentUploadButton({
  target,
  allowInternal,
  forceInternal = false,
  supersedes,
}: {
  target: UploadTarget;
  allowInternal: boolean;
  forceInternal?: boolean;
  supersedes?: { id: string; internalOnly: boolean };
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [internalOnly, setInternalOnly] = useState(supersedes?.internalOnly ?? false);
  const [description, setDescription] = useState("");

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("errors.fileTooLarge");
    setError(undefined);
    startTransition(async () => {
      const folder = target.supplierId ?? "internal";
      const storagePath = `${folder}/${crypto.randomUUID()}/${safeFileName(file.name)}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(storagePath, file, { contentType: file.type || undefined });
      if (uploadError) return setError("errors.uploadFailed");

      const result = await registerAttachment({
        ...target,
        storagePath,
        fileName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
        internalOnly: forceInternal || internalOnly,
        supersedesId: supersedes?.id ?? null,
        description: description.trim() || null,
      });
      if (result?.error) return setError(result.error);
      toast.success(t("attachments.uploaded"));
      setOpen(false);
      setDescription("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {supersedes ? (
          <Button variant="ghost" size="icon" className="size-8" title={t("attachments.newVersion")} aria-label={t("attachments.newVersion")}>
            <FilePlus2Icon />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <UploadIcon />
            {t("attachments.upload")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supersedes ? t("attachments.newVersion") : t("attachments.upload")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="att-file">{t("attachments.file")}</Label>
            <Input id="att-file" ref={fileRef} type="file" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="att-desc">
              {t("attachments.description")}{" "}
              <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Input id="att-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {allowInternal && !forceInternal && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={internalOnly}
                onChange={(e) => setInternalOnly(e.target.checked)}
                className="size-4 accent-primary"
              />
              {t("attachments.internalOnly")}
            </label>
          )}
          <FormMessage messageKey={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={upload} disabled={pending}>
            {pending ? t("attachments.uploading") : t("attachments.upload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttachmentDownloadButton({ id }: { id: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      disabled={pending}
      title={t("common.download")}
      aria-label={t("common.download")}
      onClick={() =>
        startTransition(async () => {
          const { url, error } = await getAttachmentUrl(id);
          if (error || !url) return void toast.error(t((error ?? "common.genericError") as never));
          window.location.href = url;
        })
      }
    >
      <DownloadIcon />
    </Button>
  );
}
