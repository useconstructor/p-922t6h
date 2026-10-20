'use client';

import * as Alert from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/utils';

export const AlertDialog = Alert.Root;
export const AlertDialogTitle = Alert.Title;
export const AlertDialogDescription = Alert.Description;
export const AlertDialogCancel = Alert.Cancel;

export function AlertDialogContent({ className, children, ...props }: React.ComponentProps<typeof Alert.Content>) {
  return <Alert.Portal>
    <Alert.Overlay className="fixed inset-0 z-[60] animate-overlay bg-foreground/20" />
    <Alert.Content className={cn('fixed left-1/2 top-1/2 z-[70] max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 -translate-y-1/2 animate-dialog overflow-y-auto rounded-lg border border-l-[3px] border-l-primary bg-card p-6 shadow-xl outline-none sm:p-8', className)} {...props}>{children}</Alert.Content>
  </Alert.Portal>;
}
