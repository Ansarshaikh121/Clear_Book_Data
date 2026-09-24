import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  placement?: "center" | "sheet";
};

export function Modal({ title, description, onClose, children, placement = "center" }: ModalProps) {
  const position =
    placement === "sheet"
      ? "dialog-panel-card panel pb-safe fixed inset-0 z-50 overflow-y-auto rounded-none p-4 focus:outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[28rem] sm:max-w-none sm:rounded-none"
      : "dialog-panel-card panel pb-safe fixed inset-x-0 bottom-0 z-50 overflow-y-auto rounded-t-card p-4 focus:outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card";
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40" />
        <Dialog.Content className={position}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-2xl font-medium leading-tight text-foreground">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-pretty text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="press -mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
