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
      router.push("/signup");
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
            Deleting your account permanently removes your profile, scans, history, and API keys.
            This cannot be undone.
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
              This permanently deletes everything. Type <span className="font-mono text-foreground">DELETE</span> to
              confirm.
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
              Delete forever
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </Card>
  );
}
