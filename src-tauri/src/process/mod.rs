//! Process execution without a shell. Arguments are always passed as separate
//! `argv` entries, so user input can never be interpreted as shell syntax.

pub mod launch;

use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;
use wait_timeout::ChildExt;

pub struct RawOutput {
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub code: i32,
}

#[derive(Debug)]
pub enum SpawnError {
    NotFound,
    Timeout,
    Io(String),
}

pub struct Spec<'a> {
    pub program: &'a str,
    pub args: &'a [String],
    pub cwd: &'a Path,
    pub env: &'a [(String, String)],
    pub stdin: Option<&'a [u8]>,
    pub timeout: Duration,
}

pub fn run(spec: &Spec) -> Result<RawOutput, SpawnError> {
    let mut cmd = Command::new(spec.program);
    cmd.args(spec.args)
        .current_dir(spec.cwd)
        .stdin(if spec.stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (k, v) in spec.env {
        cmd.env(k, v);
    }
    let mut child = cmd.spawn().map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => SpawnError::NotFound,
        _ => SpawnError::Io(e.to_string()),
    })?;

    if let (Some(data), Some(mut pipe)) = (spec.stdin, child.stdin.take()) {
        let data = data.to_vec();
        thread::spawn(move || {
            let _ = pipe.write_all(&data);
        });
    }
    let mut out = child.stdout.take().expect("piped stdout");
    let mut err = child.stderr.take().expect("piped stderr");
    let t_out = thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = out.read_to_end(&mut buf);
        buf
    });
    let t_err = thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = err.read_to_end(&mut buf);
        buf
    });

    let status = match child.wait_timeout(spec.timeout).map_err(|e| SpawnError::Io(e.to_string()))? {
        Some(s) => s,
        None => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(SpawnError::Timeout);
        }
    };
    Ok(RawOutput {
        stdout: t_out.join().unwrap_or_default(),
        stderr: t_err.join().unwrap_or_default(),
        code: status.code().unwrap_or(-1),
    })
}
