'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export const Sheet = Dialog.Root;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
export const SheetClose = Dialog.Close;

export function SheetContent({ className, children, ...props }: React.ComponentProps<typeof Dialog.Content>) {
  return <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-40 animate-overlay bg-foreground/15" />
    <Dialog.Content className={cn('fixed right-0 top-[var(--editor-top,0px)] z-50 flex h-[var(--editor-height,100dvh)] w-full animate-panel flex-col border-l-[3px] border-primary bg-card shadow-2xl outline-none sm:max-w-[480px]', className)} {...props}>{children}</Dialog.Content>
  </Dialog.Portal>;
}
