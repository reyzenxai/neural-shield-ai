"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuth } from "@/hooks/useAuth";
import { updateName, uploadAvatar } from "@/lib/profile";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function PersonalInfo() {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = profile?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const dirty = name.trim() !== (profile?.name ?? "") && name.trim().length >= 2;

  const onSaveName = async () => {
    setError(null);
    setSavingName(true);
    try {
      await updateName(name.trim());
      await refreshProfile();
      setSavedName(true);
      window.setTimeout(() => setSavedName(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your name.");
    } finally {
      setSavingName(false);
    }
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    if (file.size > MAX_AVATAR_BYTES) return setError("Image must be under 2 MB.");
    setUploading(true);
    try {
      await uploadAvatar(file);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card variant="glass" className="p-6">
      <h2 className="font-display text-base font-semibold">Personal info</h2>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-5 flex items-center gap-5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/15 font-display text-2xl font-semibold text-primary ring-1 ring-primary/30"
          aria-label="Change avatar"
        >
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
          <span className="absolute inset-0 grid place-items-center bg-background/60 opacity-0 transition group-hover:opacity-100">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          </span>
        </button>
        <div>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
            {!uploading && <Camera className="h-4 w-4" />} Change photo
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG or WebP. Max 2 MB.</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email ?? ""} disabled readOnly />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={onSaveName} disabled={!dirty} loading={savingName}>
          {!savingName && (savedName ? <Check className="h-4 w-4" /> : null)}
          {savedName ? "Saved" : "Save changes"}
        </Button>
      </div>
    </Card>
  );
}
