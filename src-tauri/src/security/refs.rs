/// Rejects values that Git could mistake for an option or that carry control
/// characters. Authoritative validation of ref names still goes through
/// `git check-ref-format`; this is the cheap first line of defence.
pub fn validate_arg(value: &str, what: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{what} is empty"));
    }
    if value.starts_with('-') {
        return Err(format!("{what} must not start with '-'"));
    }
    if value.chars().any(|c| c.is_control()) {
        return Err(format!("{what} contains control characters"));
    }
    Ok(())
}

/// Strips ANSI escape sequences (CSI / OSC) and other control characters from
/// text produced by Git so they can never reach the UI as terminal controls.
pub fn sanitize_output(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            match chars.peek() {
                Some('[') => {
                    chars.next();
                    for n in chars.by_ref() {
                        if ('@'..='~').contains(&n) {
                            break;
                        }
                    }
                }
                Some(']') => {
                    chars.next();
                    while let Some(n) = chars.next() {
                        if n == '\u{7}' {
                            break;
                        }
                        if n == '\u{1b}' {
                            chars.next();
                            break;
                        }
                    }
                }
                _ => {
                    chars.next();
                }
            }
        } else if c.is_control() && !matches!(c, '\n' | '\t' | '\r') {
            continue;
        } else {
            out.push(c);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn option_lookalikes_are_rejected() {
        assert!(validate_arg("--upload-pack=evil", "branch").is_err());
        assert!(validate_arg("feature/x", "branch").is_ok());
        assert!(validate_arg("bad\nname", "branch").is_err());
    }

    #[test]
    fn ansi_is_stripped() {
        assert_eq!(sanitize_output("\u{1b}[31mred\u{1b}[0m text"), "red text");
        assert_eq!(sanitize_output("a\u{1b}]0;title\u{7}b"), "ab");
        assert_eq!(sanitize_output("line\u{0}x"), "linex");
    }
}
