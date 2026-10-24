import type { Database } from "@/lib/database.types";

export type NcRow = Database["public"]["Tables"]["ncs"]["Row"] & {
  suppliers: { id: string; legal_name: string } | null;
  components: { id: string; gw_code: string; description: string } | null;
};
