use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusEntry {
    /// 项目内相对路径，统一使用 `/` 分隔
    pub path: String,
    /// 原始 XY 状态（porcelain v1）
    pub xy: String,
    /// 是否冲突（unmerged）
    pub is_conflict: bool,
    /// 是否未跟踪（untracked）
    pub is_untracked: bool,
    /// 是否被忽略（ignored）
    pub is_ignored: bool,
    /// index 区是否有变更（staged）
    pub has_staged: bool,
    /// working tree 是否有变更（unstaged）
    pub has_unstaged: bool,
    /// 归一化后的类型：modified/added/deleted/renamed/copied/untracked/ignored/conflict/unknown
    pub kind: String,
}

fn normalize_repo_relative_path(path: &str) -> String {
    path.replace('\\', "/")
}

fn classify_xy(x: char, y: char) -> (String, bool, bool) {
    // 返回 (kind, has_staged, has_unstaged)
    let has_staged = x != ' ' && x != '?' && x != '!';
    let has_unstaged = y != ' ';

    let is_conflict = matches!(x, 'U' | 'A' | 'D') && matches!(y, 'U' | 'A' | 'D')
        || x == 'U'
        || y == 'U';
    if is_conflict {
        return ("conflict".to_string(), has_staged, has_unstaged);
    }

    let kind = if x == '?' && y == '?' {
        "untracked"
    } else if x == '!' && y == '!' {
        "ignored"
    } else if x == 'R' || y == 'R' {
        "renamed"
    } else if x == 'C' || y == 'C' {
        "copied"
    } else if x == 'A' || y == 'A' {
        "added"
    } else if x == 'D' || y == 'D' {
        "deleted"
    } else if x == 'M' || y == 'M' {
        "modified"
    } else {
        "unknown"
    };

    (kind.to_string(), has_staged, has_unstaged)
}

fn parse_porcelain_v1_z(output: &[u8]) -> Vec<GitStatusEntry> {
    let mut entries = Vec::new();
    let mut i = 0usize;

    // Format (with -z):
    // - Normal: XY SP PATH NUL
    // - Rename/Copy: XY SP OLD_PATH NUL NEW_PATH NUL
    // - Untracked: ?? SP PATH NUL
    // - Ignored: !! SP PATH NUL
    while i < output.len() {
        if i + 3 > output.len() {
            break;
        }

        let x = output[i] as char;
        let y = output[i + 1] as char;
        // third byte should be space
        i += 3;

        let start = i;
        while i < output.len() && output[i] != 0 {
            i += 1;
        }
        let path1 = String::from_utf8_lossy(&output[start..i]).to_string();
        // consume NUL
        if i < output.len() {
            i += 1;
        }

        let mut final_path = path1;
        if (x == 'R' || x == 'C' || y == 'R' || y == 'C') && i < output.len() {
            // rename/copy provides second path
            let start2 = i;
            while i < output.len() && output[i] != 0 {
                i += 1;
            }
            let path2 = String::from_utf8_lossy(&output[start2..i]).to_string();
            if i < output.len() {
                i += 1;
            }
            if !path2.is_empty() {
                final_path = path2;
            }
        }

        let xy = format!("{}{}", x, y);
        let is_untracked = xy == "??";
        let is_ignored = xy == "!!";
        let is_conflict = matches!(xy.as_str(), "UU" | "AA" | "DD" | "AU" | "UA" | "DU" | "UD");
        let (kind, has_staged, has_unstaged) = classify_xy(x, y);

        entries.push(GitStatusEntry {
            path: normalize_repo_relative_path(&final_path),
            xy,
            is_conflict,
            is_untracked,
            is_ignored,
            has_staged,
            has_unstaged,
            kind,
        });
    }

    entries
}

fn find_git_dir(project_path: &Path) -> Option<PathBuf> {
    // 允许在子目录打开项目：向上找 .git
    let mut cur = Some(project_path);
    while let Some(dir) = cur {
        if dir.join(".git").exists() {
            return Some(dir.to_path_buf());
        }
        cur = dir.parent();
    }
    None
}

#[tauri::command]
pub async fn get_git_status(project_path: String) -> Result<Vec<GitStatusEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let project_path = PathBuf::from(project_path);
        let repo_root = find_git_dir(&project_path)
            .ok_or_else(|| "Not a git repository (no .git found)".to_string())?;

        let out = Command::new("git")
            .current_dir(&repo_root)
            .args([
                "status",
                "--porcelain",
                "-z",
                "--untracked-files=all",
                "--ignored=matching",
            ])
            .output()
            .map_err(|e| format!("Failed to execute git: {}", e))?;

        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            return Err(if stderr.is_empty() {
                "git status failed".to_string()
            } else {
                format!("git status failed: {}", stderr)
            });
        }

        Ok(parse_porcelain_v1_z(&out.stdout))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffRange {
    /// modified/added/deleted
    pub kind: String,
    /// 1-based line number in working file for placement
    pub start_line: u32,
    /// inclusive
    pub end_line: u32,
}

fn parse_unified_zero_hunks(diff_text: &str) -> Vec<GitDiffRange> {
    // Parse hunk headers: @@ -a,b +c,d @@
    // With -U0, there is no context, so ranges map well to line highlights.
    let mut ranges = Vec::new();

    for line in diff_text.lines() {
        if !line.starts_with("@@ ") {
            continue;
        }
        // find "+<start>[,<len>]" inside the header
        // Example: "@@ -1,0 +1,12 @@"
        let plus_pos = match line.find(" +") {
            Some(p) => p + 2,
            None => continue,
        };
        let after_plus = &line[plus_pos..];
        let end_pos = after_plus.find(' ').unwrap_or(after_plus.len());
        let plus_part = &after_plus[..end_pos]; // e.g. "12,3" or "12"

        // also parse "-<start>[,<len>]" for classification
        let minus_pos = match line.find(" -") {
            Some(p) => p + 2,
            None => continue,
        };
        let after_minus = &line[minus_pos..];
        let minus_end = after_minus.find(' ').unwrap_or(after_minus.len());
        let minus_part = &after_minus[..minus_end];

        let (_old_start, old_len) = parse_range_part(minus_part);
        let (new_start, new_len) = parse_range_part(plus_part);

        let kind = if old_len == 0 && new_len > 0 {
            "added"
        } else if old_len > 0 && new_len == 0 {
            "deleted"
        } else {
            "modified"
        };

        // For deleted hunks, new_len == 0; place marker at new_start (or 1).
        let start_line = if new_start == 0 { 1 } else { new_start };
        let end_line = if new_len == 0 {
            start_line
        } else {
            start_line.saturating_add(new_len.saturating_sub(1))
        };

        if start_line > 0 && end_line >= start_line {
            ranges.push(GitDiffRange {
                kind: kind.to_string(),
                start_line,
                end_line,
            });
        }
    }

    ranges
}

fn parse_range_part(part: &str) -> (u32, u32) {
    // part: "a,b" or "a"
    let mut it = part.splitn(2, ',');
    let start = it
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    let len = it
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(1);
    (start, len)
}

#[tauri::command]
pub async fn get_git_diff_ranges(project_path: String, relative_path: String) -> Result<Vec<GitDiffRange>, String> {
    tokio::task::spawn_blocking(move || {
        let project_path = PathBuf::from(project_path);
        let repo_root = find_git_dir(&project_path)
            .ok_or_else(|| "Not a git repository (no .git found)".to_string())?;

        let rel = normalize_repo_relative_path(&relative_path);
        let out = Command::new("git")
            .current_dir(&repo_root)
            .args([
                "diff",
                "--unified=0",
                "--no-color",
                "HEAD",
                "--",
                &rel,
            ])
            .output()
            .map_err(|e| format!("Failed to execute git: {}", e))?;

        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            return Err(if stderr.is_empty() {
                "git diff failed".to_string()
            } else {
                format!("git diff failed: {}", stderr)
            });
        }

        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
        Ok(parse_unified_zero_hunks(&stdout))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

