import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export default async function MySupplierPage() {
  const profile = await requireProfile(["supplier"]);
  redirect(`/suppliers/${profile.supplierId}`);
}
