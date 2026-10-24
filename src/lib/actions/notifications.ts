"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("recipient_id", data.claims.sub).is("read_at", null);
  revalidatePath("/", "layout");
}

// Preferência do próprio usuário: receber as notificações também por e-mail.
export async function setEmailNotifications(enabled: boolean) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "errors.forbidden" };
  const { error } = await supabase.from("users").update({ email_notifications: enabled }).eq("id", data.claims.sub);
  if (error) return { error: "common.genericError" };
  revalidatePath("/notifications");
  return { success: enabled ? "notifications.emailOn" : "notifications.emailOff" };
}
