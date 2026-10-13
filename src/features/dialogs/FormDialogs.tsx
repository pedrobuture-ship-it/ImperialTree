import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Dialog } from "@/components/ui/Dialog";
import { Button, Field, Input, Select, TextArea } from "@/components/ui/Button";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { useSettings } from "@/stores/settings";
import { api, toGitError } from "@/lib/api";
import { preview } from "@/lib/commands";
import { runOp } from "@/lib/ops";
import { CommandLine } from "./CommandLine";

function useRepoRoot() {
  return useRepo((s) => s.repo?.root ?? "");
}

export function CreateBranchDialog({ start }: { start?: string }) {
  const root = useRepoRoot();
  const close = useUi((s) => s.closeDialog);
  const branches = useRepo((s) => s.branches);
  const current = useRepo((s) => s.status?.branch);
  const [name, setName] = useState("");
  const [from, setFrom] = useState(start ?? current ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return setError(null);
    const t = window.setTimeout(() => {
      api.validateBranchName(root, name).then(() => setError(null)).catch((e) => setError(toGitError(e).message));
    }, 200);
    return () => window.clearTimeout(t);
  }, [name, root]);

  const submit = async () => {
    if (!name || error) return;
    close();
    useSettings.getState().pushRecentBranch(name);
    await runOp(preview.createBranch(name, from), () => api.createBranch(root, name, from), { success: `Created and switched to ${name}` });
  };

  return (
    <Dialog title="Create branch" onClose={close} footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!name || !!error} onClick={() => void submit()}>Create branch</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Branch name" hint={error ? <span className="text-alert">{error}</span> : "Validated with git check-ref-format --branch"}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="feature/new-ui" className="mono" />
        </Field>
        <Field label="Start point">
          <Input list="start-points" value={from} onChange={(e) => setFrom(e.target.value)} className="mono" />
          <datalist id="start-points">{branches.map((b) => <option key={b.fullName} value={b.name} />)}</datalist>
        </Field>
        <CommandLine command={preview.createBranch(name, from)} />
      </form>
    </Dialog>
  );
}

export function RenameBranchDialog({ name: old }: { name: string }) {
  const root = useRepoRoot();
  const close = useUi((s) => s.closeDialog);
  const [name, setName] = useState(old);
  const submit = async () => {
    close();
    await runOp(preview.renameBranch(old, name), () => api.renameBranch(root, old, name), { success: `Renamed to ${name}` });
  };
  return (
    <Dialog title="Rename branch" onClose={close} footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!name || name === old} onClick={() => void submit()}>Rename</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="New name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="mono" /></Field>
        <CommandLine command={preview.renameBranch(old, name)} />
      </form>
    </Dialog>
  );
}

export function CreateTagDialog({ target }: { target?: string }) {
  const root = useRepoRoot();
  const close = useUi((s) => s.closeDialog);
  const [name, setName] = useState("");
  const [at, setAt] = useState(target ?? "HEAD");
  const [message, setMessage] = useState("");
  const [annotated, setAnnotated] = useState(false);
  const msg = annotated ? message || "Release" : "";
  const submit = async () => {
    close();
    await runOp(preview.tag(name, at, msg), () => api.createTag(root, name, at, msg || undefined), { success: `Tagged ${name}` });
  };
  return (
    <Dialog title="Create tag" onClose={close} footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!name} onClick={() => void submit()}>Create tag</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Tag name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="v1.0.0" className="mono" /></Field>
        <Field label="Target commit"><Input value={at} onChange={(e) => setAt(e.target.value)} className="mono" /></Field>
        <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" className="check" checked={annotated} onChange={(e) => setAnnotated(e.target.checked)} /> Annotated tag</label>
        {annotated && <Field label="Message"><TextArea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>}
        <CommandLine command={preview.tag(name, at, msg)} />
      </form>
    </Dialog>
  );
}

export function CreateStashDialog() {
  const root = useRepoRoot();
  const close = useUi((s) => s.closeDialog);
  const [message, setMessage] = useState("");
  const [untracked, setUntracked] = useState(false);
  const submit = async () => {
    close();
    await runOp(preview.stash(message, untracked), () => api.stashPush(root, message, untracked), { success: "Changes stashed" });
  };
  return (
    <Dialog title="Create stash" onClose={close} footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void submit()}>Stash changes</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Message (optional)"><Input autoFocus value={message} onChange={(e) => setMessage(e.target.value)} placeholder="WIP: note creation" /></Field>
        <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" className="check" checked={untracked} onChange={(e) => setUntracked(e.target.checked)} /> Include untracked files</label>
        <CommandLine command={preview.stash(message, untracked)} />
      </form>
    </Dialog>
  );
}

export function CreateWorktreeDialog({ branch: initial }: { branch?: string }) {
  const root = useRepoRoot();
  const close = useUi((s) => s.closeDialog);
  const branches = useRepo((s) => s.branches.filter((b) => !b.remote));
  const repoName = useRepo((s) => s.repo?.name ?? "repo");
  const [create, setCreate] = useState(!initial);
  const [branch, setBranch] = useState(initial ?? "");
  const [path, setPath] = useState("");

  const parent = root.split("/").slice(0, -1).join("/");
  const suggested = branch ? `${parent}/${repoName}-${branch.replace(/[^\w.-]+/g, "-")}` : "";
  const dest = path || suggested;

  const browse = async () => {
    const picked = await open({ directory: true, multiple: false, title: "Parent folder for the worktree" });
    if (typeof picked === "string" && branch) setPath(`${picked}/${repoName}-${branch.replace(/[^\w.-]+/g, "-")}`);
  };
  const submit = async () => {
    close();
    await runOp(preview.worktreeAdd(dest, branch, create), () => api.addWorktree(root, dest, branch, create), { success: `Worktree created at ${dest}` });
  };
  return (
    <Dialog title="Create worktree" onClose={close} footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!branch || !dest} onClick={() => void submit()}>Create worktree</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="flex gap-4 text-[12px]">
          <label className="flex items-center gap-2"><input type="radio" className="check" checked={create} onChange={() => setCreate(true)} /> New branch</label>
          <label className="flex items-center gap-2"><input type="radio" className="check" checked={!create} onChange={() => setCreate(false)} /> Existing branch</label>
        </div>
        <Field label="Branch">
          {create ? <Input autoFocus value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="feature/auth" className="mono" /> : (
            <Select value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">Select a branch…</option>{branches.map((b) => <option key={b.name}>{b.name}</option>)}</Select>
          )}
        </Field>
        <Field label="Destination">
          <div className="flex gap-2"><Input value={dest} onChange={(e) => setPath(e.target.value)} placeholder="../repo-feature" className="mono" /><Button onClick={() => void browse()}>Browse</Button></div>
        </Field>
        <CommandLine command={preview.worktreeAdd(dest, branch, create)} />
      </form>
    </Dialog>
  );
}

export function CloneDialog() {
  const close = useUi((s) => s.closeDialog);
  const openRepo = useRepo((s) => s.open);
  const [url, setUrl] = useState("");
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repoName = url.replace(/\/+$/, "").split(/[/:]/).pop()?.replace(/\.git$/, "") ?? "";
  const browse = async () => {
    const picked = await open({ directory: true, multiple: false, title: "Clone into folder" });
    if (typeof picked === "string") setDest(`${picked}/${repoName || "repository"}`);
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.cloneRepository(url.trim(), dest.trim());
      close();
      await openRepo(dest.trim());
    } catch (e) {
      setError(toGitError(e).stderr || toGitError(e).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Clone repository" onClose={busy ? () => undefined : close} footer={<><Button onClick={close} disabled={busy}>Cancel</Button><Button variant="primary" disabled={!url.trim() || !dest.trim() || busy} onClick={() => void submit()}>{busy ? "Cloning…" : "Clone"}</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Repository URL" hint="HTTPS or SSH. Credentials are handled by your Git credential helper or SSH agent; nothing is stored by this app.">
          <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/user/project.git" className="mono" />
        </Field>
        <Field label="Destination"><div className="flex gap-2"><Input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="/home/you/Projects/project" className="mono" /><Button onClick={() => void browse()}>Browse</Button></div></Field>
        <CommandLine command={preview.clone(url.trim(), dest.trim())} />
        {busy && <div className="relative h-1 overflow-hidden bg-line anim-sweep" />}
        {error && <pre className="mono selectable max-h-40 overflow-auto whitespace-pre-wrap border border-alert-dim bg-alert/5 p-3 text-[11px] text-alert">{error}</pre>}
      </form>
    </Dialog>
  );
}
