use std::path::{Component, Path, PathBuf};

/// Validates a repository-relative path coming from the UI. Rejects absolute
/// paths, `..` traversal, NUL bytes and empty values.
pub fn validate_relative(rel: &str) -> Result<&str, String> {
    if rel.is_empty() || rel.contains('\0') {
        return Err("empty or invalid path".into());
    }
    let p = Path::new(rel);
    if p.is_absolute() {
        return Err(format!("absolute paths are not allowed: {rel}"));
    }
    for c in p.components() {
        match c {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(format!("path escapes the repository: {rel}")),
        }
    }
    Ok(rel)
}

/// Joins a validated relative path to the repository root and makes sure the
/// result, after resolving symlinks of existing ancestors, stays inside it.
pub fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
    validate_relative(rel)?;
    let joined = root.join(rel);
    let canon_root = root.canonicalize().map_err(|e| e.to_string())?;
    let mut probe = joined.as_path();
    loop {
        if let Ok(real) = probe.canonicalize() {
            if !real.starts_with(&canon_root) {
                return Err(format!("path resolves outside the repository: {rel}"));
            }
            break;
        }
        match probe.parent() {
            Some(parent) => probe = parent,
            None => return Err("path has no existing ancestor".into()),
        }
    }
    Ok(joined)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_traversal_and_absolute() {
        assert!(validate_relative("../etc/passwd").is_err());
        assert!(validate_relative("a/../../b").is_err());
        assert!(validate_relative("/etc/passwd").is_err());
        assert!(validate_relative("").is_err());
        assert!(validate_relative("src/main.rs").is_ok());
        assert!(validate_relative("-weird-name").is_ok());
    }

    #[test]
    fn symlink_escape_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("link")).unwrap();
        assert!(safe_join(dir.path(), "link/secret").is_err());
        assert!(safe_join(dir.path(), "plain/new.txt").is_ok());
    }
}
