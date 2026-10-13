use super::{runner::Executed, Git, GitError};
use crate::security::refs::sanitize_output;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Scope {
    Global,
    Local,
}

impl Scope {
    fn flag(self) -> &'static str {
        match self {
            Scope::Global => "--global",
            Scope::Local => "--local",
        }
    }
}

/// Keys the UI is allowed to read and write.
const ALLOWED: &[&str] = &[
    "user.name",
    "user.email",
    "init.defaultBranch",
    "commit.gpgsign",
    "tag.gpgsign",
    "user.signingkey",
    "gpg.format",
    "gpg.program",
    "gpg.ssh.program",
];

fn check_key(key: &str) -> Result<(), GitError> {
    if ALLOWED.contains(&key) { Ok(()) } else { Err(GitError::invalid(format!("'{key}' cannot be edited here"))) }
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigValue {
    pub key: String,
    pub global: Option<String>,
    pub local: Option<String>,
    pub effective: Option<String>,
}

fn get_scoped(git: &Git, scope: Scope, key: &str) -> Result<Option<String>, GitError> {
    let out = git.probe(&["config", scope.flag(), "--get", key])?;
    Ok((out.code == 0).then(|| sanitize_output(out.text().trim())).filter(|s| !s.is_empty()))
}

pub fn get(git: &Git, keys: &[&str]) -> Result<Vec<ConfigValue>, GitError> {
    keys.iter()
        .map(|k| {
            check_key(k)?;
            let global = get_scoped(git, Scope::Global, k)?;
            let local = get_scoped(git, Scope::Local, k)?;
            let effective = local.clone().or_else(|| global.clone());
            Ok(ConfigValue { key: k.to_string(), global, local, effective })
        })
        .collect()
}

pub fn set(git: &Git, scope: Scope, key: &str, value: &str) -> Result<Executed, GitError> {
    check_key(key)?;
    if value.contains('\0') || value.contains('\n') {
        return Err(GitError::invalid("invalid value"));
    }
    if value.trim().is_empty() {
        let out = git.probe(&["config", scope.flag(), "--unset", key])?;
        return Ok(out.executed());
    }
    Ok(git.run(&["config", scope.flag(), key, value.trim()])?.executed())
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SigningStatus {
    pub enabled: bool,
    pub format: String,
    pub key: Option<String>,
    pub program: Option<String>,
}

pub fn signing(git: &Git) -> Result<SigningStatus, GitError> {
    let v = get(git, &["commit.gpgsign", "user.signingkey", "gpg.format", "gpg.program"])?;
    let eff = |k: &str| v.iter().find(|c| c.key == k).and_then(|c| c.effective.clone());
    Ok(SigningStatus {
        enabled: eff("commit.gpgsign").is_some_and(|s| s == "true"),
        format: eff("gpg.format").unwrap_or_else(|| "openpgp".into()),
        key: eff("user.signingkey"),
        program: eff("gpg.program"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn scoped_set_and_get() {
        let (_d, g) = init_repo();
        set(&g, Scope::Local, "user.name", "Local Name").unwrap();
        let v = get(&g, &["user.name"]).unwrap();
        assert_eq!(v[0].local.as_deref(), Some("Local Name"));
        assert_eq!(v[0].effective.as_deref(), Some("Local Name"));
        set(&g, Scope::Local, "user.name", "").unwrap();
        assert_eq!(get(&g, &["user.name"]).unwrap()[0].local, None);
    }

    #[test]
    fn only_allowlisted_keys() {
        let (_d, g) = init_repo();
        assert!(set(&g, Scope::Local, "core.editor", "evil").is_err());
        assert!(set(&g, Scope::Local, "alias.x", "!sh").is_err());
        assert!(get(&g, &["core.sshCommand"]).is_err());
    }

    #[test]
    fn signing_defaults_disabled() {
        let (_d, g) = init_repo();
        let s = signing(&g).unwrap();
        assert!(!s.enabled);
        assert_eq!(s.format, "openpgp");
    }
}
