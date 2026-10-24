import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/server";
import { CommentForm } from "@/components/nc/comment-form";
import { cn } from "@/lib/utils";

export async function CommentsTab({ ncId, internal }: { ncId: string; internal: boolean }) {
  const t = await getTranslations("comments");
  const format = await getFormatter();
  const supabase = await createClient();
  const { data } = await supabase.from("nc_comments").select("id, body, internal, created_at, created_by")
    .eq("nc_id", ncId).is("cancelled_at", null).order("created_at");
  const comments = data ?? [];
  const ids = [...new Set(comments.map((c) => c.created_by).filter(Boolean))] as string[];
  const { data: users } = ids.length
    ? await supabase.from("users").select("id, full_name, role").in("id", ids)
    : { data: [] as { id: string; full_name: string; role: string }[] };
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {comments.length === 0 ? <EmptyState>{t("empty")}</EmptyState> : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const author = c.created_by ? userById.get(c.created_by) : undefined;
            return (
              <li key={c.id} className={cn("rounded-lg border p-3", c.internal && "border-dashed bg-muted/40",
                author?.role === "supplier" && "ml-6")}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{author?.full_name ?? "—"}</span>
                  <span>{format.dateTime(new Date(c.created_at), { dateStyle: "short", timeStyle: "short" })}</span>
                  {c.internal && <Badge variant="secondary">{t("internalBadge")}</Badge>}
                </div>
                <p className="text-sm whitespace-pre-line">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}
      <CommentForm ncId={ncId} internal={internal} />
    </div>
  );
}
