pub mod branch;
pub mod commit;
pub mod diff;
pub mod error;
pub mod index;
pub mod log;
pub mod reflog;
pub mod remote;
pub mod runner;
pub mod stash;
pub mod status;
pub mod tag;
pub mod worktree;

pub use error::GitError;
pub use runner::{Executed, Git};
