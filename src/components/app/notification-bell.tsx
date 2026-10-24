import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function NotificationBell({ userId }: { userId: string }) {
  const t = await getTranslations("notifications");
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  const unread = count ?? 0;
  const label = `${t("title")} — ${t("unreadCount", { count: unread })}`;

  return (
    <Button variant="ghost" size="icon" asChild className="relative" title={label}>
      <Link href="/notifications" aria-label={label}>
        <BellIcon />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
