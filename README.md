# Imperial Terminal

**A Linux-first Git client that doesn't hide Git.**

Imperial Terminal is a local-first desktop Git client with a tactical, terminal-inspired interface. It is a graphical front end for the `git` already installed on your machine, and every action shows the real command behind it, so the app teaches Git while staying useful for people who already know it.

![Overview](docs/screenshots/overview.png)

## Highlights

- **Commit graph** – virtualized, lane-based graph that stays fluid on repositories with tens of thousands of commits
- **Changes** – staged / unstaged / untracked groups with split and unified diffs
- **Hunk staging** – stage, unstage or discard individual hunks through `git apply`
- **Branches** – checkout, create, rename, delete, merge and rebase with ahead/behind counters
- **Worktrees** – first-class worktree manager (`git worktree add/list/remove/prune`)
- **Interactive rebase** – reorder by drag and drop, pick / reword / edit / squash / fixup / drop, with an exact summary before anything runs
- **Conflict resolution** – OURS / RESULT / THEIRS editor, `git add` when resolved, continue or abort the operation
- **Reflog** – visual timeline of where HEAD has been
- **Repository health** – size, loose objects, stale branches, large files and dangling objects; suggests commands but never runs them
- **Git command previews** – a global panel shows the command before and after every operation
- **Safety layer** – destructive operations show the command and the impact, and need explicit confirmation
- **Keyboard first** – command palette, branch quick switcher, `J`/`K` history navigation
- **Linux-first, local-first** – no account, no telemetry, no backend, works offline

| History | Worktrees |
| --- | --- |
| ![History](docs/screenshots/history.png) | ![Worktrees](docs/screenshots/worktrees.png) |

## Architecture

```
React UI
   ↓  Tauri commands (typed)
Rust Git service
   ↓  argv, never a shell
Git CLI
   ↓
Repository .git
```

```
src/                    React + TypeScript (strict) + Tailwind
  app/ components/ features/ hooks/ lib/ stores/ styles/ types/
src-tauri/src/
  commands/             thin Tauri command layer, repository allowlist
  git/                  one module per concern: status, log, branch, diff, stash, tag,
                        remote, worktree, reflog, rebase, conflict, config, health
  process/              shell-free process runner with timeouts, terminal/editor launchers
  filesystem/           local state store, SSH diagnostics, debounced repository watcher
  security/             path and ref validation, output sanitising
```

Design rules:

- Git is executed with **separate arguments**, never through `sh -c`.
- The UI can only act on repositories that were explicitly opened.
- Paths are validated (no traversal, no symlink escapes); ref names go through `git check-ref-format`.
- Git output is treated as untrusted: ANSI sequences are stripped and nothing is rendered as HTML.
- Repository config is untrusted too: `core.fsmonitor`, external diff drivers and textconv are disabled for the commands the app runs.
- Read-only commands run with `GIT_OPTIONAL_LOCKS=0` so they never touch the index and cannot trigger the file watcher.
- The app never stores credentials. Authentication stays with your credential helper or SSH agent.

## Install and run

Imperial Terminal needs `git` in `PATH` and, on Linux, WebKitGTK 4.1. There are no prebuilt releases yet, so you build it once from source; every route below ends with a normal desktop app.

> Tested here: **Arch Linux / Omarchy**. The other distros use the packages Tauri 2 documents for them, but have not been run by me.

### Omarchy / Arch Linux (one command)

```bash
sudo pacman -S --needed git nodejs npm webkit2gtk-4.1 base-devel openssl librsvg xdotool rustup
rustup default stable

git clone https://github.com/pedrobuture-ship-it/ImperialTree.git
cd ImperialTree
scripts/install-linux.sh
```

The script builds the release binary and installs it for your user: `~/.local/bin/imperial-terminal`, an icon and a desktop entry. After that it appears in the Omarchy launcher (`Super + Space`, type "Imperial") like any other app. Open a repository from the shell with `imperial-terminal /path/to/repo`.

### Debian / Ubuntu / Linux Mint / Pop!_OS

```bash
sudo apt update
sudo apt install -y git curl wget file build-essential nodejs npm \
  libwebkit2gtk-4.1-dev libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # then restart the shell

git clone https://github.com/pedrobuture-ship-it/ImperialTree.git && cd ImperialTree
npm install && npm run tauri build
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

### Fedora / RHEL-family

```bash
sudo dnf install -y git curl wget file nodejs npm gcc gcc-c++ make \
  webkit2gtk4.1-devel openssl-devel libxdo-devel libappindicator-gtk3-devel librsvg2-devel
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

git clone https://github.com/pedrobuture-ship-it/ImperialTree.git && cd ImperialTree
npm install && npm run tauri build
sudo dnf install ./src-tauri/target/release/bundle/rpm/*.rpm
```

### openSUSE

```bash
sudo zypper install -y git curl wget file nodejs npm libopenssl-devel \
  webkit2gtk3-devel libxdo-devel libappindicator3-devel librsvg-devel
sudo zypper install -y -t pattern devel_basis
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

git clone https://github.com/pedrobuture-ship-it/ImperialTree.git && cd ImperialTree
npm install && npm run tauri build
sudo zypper install ./src-tauri/target/release/bundle/rpm/*.rpm
```

### NixOS / Nix

```bash
nix-shell -p git nodejs rustc cargo pkg-config openssl webkitgtk_4_1 gtk3 libsoup_3 librsvg xdotool

git clone https://github.com/pedrobuture-ship-it/ImperialTree.git && cd ImperialTree
npm install && npm run tauri build -- --no-bundle
./src-tauri/target/release/imperial-terminal /path/to/repo
```

### Any other Linux (AppImage)

```bash
npm install && npm run tauri build -- --bundles appimage
chmod +x src-tauri/target/release/bundle/appimage/*.AppImage
./src-tauri/target/release/bundle/appimage/*.AppImage
```

On Debian/Ubuntu/Fedora/openSUSE you can also run `scripts/install-linux.sh` instead of installing the `.deb`/`.rpm`; it does a per-user install without `sudo` for the app itself.

### Windows

**Native Windows is not supported yet.** The Tauri shell itself builds on Windows, but the backend still relies on Linux-only pieces: `sh` helper scripts and Unix file permissions for interactive rebase, `xdg-open` for "reveal in file manager", and Linux terminal/editor launchers. I have not built or run it on Windows, so I won't claim it works.

What does work today:

- **WSL 2 + WSLg (Windows 11 / recent Windows 10):** install a Linux distro from the Store, follow the Debian/Ubuntu steps above inside it, and run `imperial-terminal` — the window shows up on the Windows desktop. Open repositories that live inside the WSL filesystem (`~/projects/...`) for good performance.

A native port needs those platform pieces abstracted first; it is on the list.

### Development

```bash
npm install
npm run tauri dev             # run with hot reload
npm run check                 # typecheck + lint + frontend tests
(cd src-tauri && cargo test)  # backend tests
```

Open a repository directly from the shell:

```bash
imperial-terminal /path/to/repo
```

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl K` | Command palette |
| `Ctrl Shift P` | Branch quick switcher |
| `Ctrl O` | Open repository |
| `Ctrl Enter` | Commit (composer focused) |
| `Ctrl F` | Search commits (History) |
| `J` / `K` | Next / previous commit |
| `Esc` | Close dialog or panel |
| `?` | Show shortcuts |

## UI smoke tests

Debug builds include an optional hook for scripted UI checks: when `IT_AUTOMATION` points to a JavaScript file it is evaluated in the main window after startup, and `IT_REPORT_DIR` receives the report. Release builds contain none of this.

---

*Git without the abstraction wall.* No analytics. No tracking. No cloud required.
