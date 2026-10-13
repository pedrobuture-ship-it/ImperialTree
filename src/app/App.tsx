import { useEffect } from "react";
import { Titlebar } from "@/components/shell/Titlebar";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { StatusBar } from "@/components/shell/StatusBar";
import { Toasts } from "@/components/ui/Toasts";
import { DialogHost } from "@/features/dialogs/DialogHost";
import { Palette } from "@/features/palette/Palette";
import { Home } from "@/features/home/Home";
import { Overview } from "@/features/overview/Overview";
import { ChangesList } from "@/features/changes/ChangesList";
import { FileDiffPanel } from "@/features/diff/FileDiffPanel";
import { HistoryView } from "@/features/history/HistoryView";
import { BranchesView } from "@/features/branches/BranchesView";
import { RemotesView } from "@/features/remotes/RemotesView";
import { StashesView } from "@/features/stashes/StashesView";
import { TagsView } from "@/features/tags/TagsView";
import { WorktreesView } from "@/features/worktrees/WorktreesView";
import { TerminalView } from "@/features/terminal/TerminalView";
import { ReflogView } from "@/features/reflog/ReflogView";
import { HealthView } from "@/features/health/HealthView";
import { SettingsView } from "@/features/settings/SettingsView";
import { AboutView } from "@/features/about/AboutView";
import { ConflictsView } from "@/features/conflicts/ConflictsView";
import { useUi, type View } from "@/stores/ui";
import { useRepo } from "@/stores/repo";
import { useSettings } from "@/stores/settings";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useRepoWatcher } from "@/hooks/useRepoWatcher";

function ChangesPage() {
  const setView = useUi((s) => s.setView);
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(380px,0.8fr)_minmax(0,1.2fr)] gap-3 p-3">
      <ChangesList onOpenConflicts={() => setView("conflicts")} />
      <FileDiffPanel />
    </div>
  );
}

const REPO_VIEWS: Record<Exclude<View, "home" | "settings" | "about">, () => React.JSX.Element> = {
  overview: Overview,
  changes: ChangesPage,
  history: HistoryView,
  branches: BranchesView,
  remotes: RemotesView,
  stashes: StashesView,
  tags: TagsView,
  worktrees: WorktreesView,
  terminal: TerminalView,
  reflog: ReflogView,
  health: HealthView,
  conflicts: ConflictsView,
};

export function App() {
  const view = useUi((s) => s.view);
  const repo = useRepo((s) => s.repo);
  const load = useSettings((s) => s.load);
  useGlobalShortcuts();
  useRepoWatcher();

  useEffect(() => {
    void load();
  }, [load]);

  let body: React.ReactNode;
  if (view === "settings") body = <SettingsView />;
  else if (view === "about") body = <AboutView />;
  else if (!repo || view === "home") body = <Home />;
  else {
    const View = REPO_VIEWS[view];
    body = <View />;
  }

  return (
    <div className="flex h-full flex-col bg-void">
      <Titlebar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <Header />
          <div key={view} className="anim-in min-h-0 flex-1 overflow-hidden">
            {body}
          </div>
        </main>
      </div>
      <StatusBar />
      <DialogHost />
      <Palette />
      <Toasts />
    </div>
  );
}
