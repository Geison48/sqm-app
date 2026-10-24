import { forwardRef } from "react";
import { LinkIcon, PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Botões usados como gatilho de diálogos (repassam ref/props do DialogTrigger).
export const EditButton = forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button> & { label: string }>(
  function EditButton({ label, ...props }, ref) {
    return (
      <Button ref={ref} variant="ghost" size="icon" className="size-8" title={label} aria-label={label} {...props}>
        <PencilIcon />
      </Button>
    );
  },
);

export const AddButton = forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button> & { label: string; link?: boolean }>(
  function AddButton({ label, link, ...props }, ref) {
    return (
      <Button ref={ref} variant="outline" size="sm" {...props}>
        {link ? <LinkIcon /> : <PlusIcon />}
        {label}
      </Button>
    );
  },
);
