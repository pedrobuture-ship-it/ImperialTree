mod commands;
mod filesystem;
mod git;
mod process;
mod security;

use commands::*;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            open_repository,
            clone_repository,
            repo_status,
            history,
            commit_details,
            commit_diff,
            file_diff,
            apply_patch,
            stage_paths,
            unstage_paths,
            discard_paths,
            staged_summary,
            create_commit,
            cherry_pick,
            revert_commit,
            list_branches,
            create_branch,
            validate_branch_name,
            checkout_branch,
            checkout_commit,
            rename_branch,
            delete_branch,
            merge_branch,
            rebase_onto,
            list_remotes,
            fetch_remote,
            pull_remote,
            push_remote,
            list_stashes,
            stash_push,
            stash_apply,
            stash_pop,
            stash_drop,
            list_tags,
            create_tag,
            delete_tag,
            push_tag,
            list_worktrees,
            add_worktree,
            remove_worktree,
            prune_worktrees,
            reflog_entries,
            rebase_commits,
            rebase_start,
            operation_state,
            operation_continue,
            operation_abort,
            conflict_read,
            conflict_write,
            conflict_resolve,
            repository_health,
            config_get,
            config_set,
            signing_status,
            ssh_diagnostics,
            ssh_public_key,
            environment,
            list_terminals,
            list_editors,
            open_terminal,
            open_in_editor,
            reveal_in_file_manager,
            load_state,
            save_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Imperial Terminal");
}
