"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

// Aviso único após abrir a NC (remove ?created=1 da URL).
export function CreatedToast({ show, message }: { show: boolean; message: string }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!show) return;
    toast.success(message);
    router.replace(`${pathname}?tab=attachments`, { scroll: false });
  }, [show, message, router, pathname]);
  return null;
}
