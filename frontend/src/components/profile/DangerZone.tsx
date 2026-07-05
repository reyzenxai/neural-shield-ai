"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { deleteAccount } from "@/lib/profile";

export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      router.push("/login?deleted=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete your account.");
      setDeleting(false);
    }
  };

  return (
    <Card variant="solid" className="border-danger/30 bg-danger/5 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div className="flex-1">
          <h2 className="font-display text-base font-semibold text-danger">Danger zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deleting your account deactivates it and schedules permanent deletion in 30 days.
            You can restore everything — scans, plan, and history — by logging back in within 30 days.
            After 30 days it is deleted for good.
          </p>
          <Button variant="destructive" size="sm" className="mt-3" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </div>
      </div>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Delete your account?</ModalTitle>
            <ModalDescription>
              Your account will be deactivated and permanently deleted after 30 days. You can restore
              it anytime within 30 days by logging back in. Type{" "}
              <span className="font-mono text-foreground">DELETE</span> to confirm.
            </ModalDescription>
          </ModalHeader>

          {error && (
            <Alert tone="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            aria-label="Type DELETE to confirm"
          />

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={confirmText !== "DELETE"}
              loading={deleting}
            >
              Delete account
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </Card>
  );
}
