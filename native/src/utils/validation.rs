use std::path::Path;

/// 路径验证错误
#[derive(Debug)]
pub enum ValidationError {
    /// 路径为空
    EmptyPath,
    /// 路径包含遍历序列（如 ..）
    PathTraversal,
    /// 路径包含非法字符
    InvalidCharacters(String),
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::EmptyPath => write!(f, "路径不能为空"),
            ValidationError::PathTraversal => write!(f, "不允许路径遍历（..）"),
            ValidationError::InvalidCharacters(c) => write!(f, "路径包含非法字符: {}", c),
        }
    }
}

impl std::error::Error for ValidationError {}

impl From<ValidationError> for String {
    fn from(err: ValidationError) -> Self {
        err.to_string()
    }
}

/// 验证路径是否安全
///
/// # 参数
/// - `path`: 要验证的路径字符串
///
/// # 返回
/// - `Ok(())`: 路径安全
/// - `Err(ValidationError)`: 路径不安全
pub fn validate_path(path: &str) -> Result<(), ValidationError> {
    // 检查空路径
    if path.is_empty() {
        return Err(ValidationError::EmptyPath);
    }

    // 防止路径遍历攻击
    let parts: Vec<&str> = path.split(&['/', '\\'][..]).collect();
    for part in parts {
        if part == ".." {
            return Err(ValidationError::PathTraversal);
        }
    }

    // 检查空字符（所有平台都不允许）
    if path.contains('\0') {
        return Err(ValidationError::InvalidCharacters("\\0".to_string()));
    }

    Ok(())
}

/// 验证项目路径是否有效
///
/// # 参数
/// - `path`: 项目路径字符串
///
/// # 返回
/// - `Ok(())`: 项目路径有效
/// - `Err(ValidationError)`: 项目路径无效
pub fn validate_project_path(path: &str) -> Result<(), ValidationError> {
    validate_path(path)?;

    // 确保路径不是根目录
    let path_obj = Path::new(path);
    if path_obj.parent().is_none() && path_obj.to_str().map_or(false, |p| p == "/") {
        return Err(ValidationError::InvalidCharacters("根目录".to_string()));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_path() {
        assert!(matches!(validate_path(""), Err(ValidationError::EmptyPath)));
    }

    #[test]
    fn test_path_traversal() {
        // 测试以 .. 开头的路径
        assert!(matches!(
            validate_path("../etc/passwd"),
            Err(ValidationError::PathTraversal)
        ));
        assert!(matches!(
            validate_path(".."),
            Err(ValidationError::PathTraversal)
        ));

        // 测试包含 .. 的路径
        assert!(matches!(
            validate_path("foo/../bar"),
            Err(ValidationError::PathTraversal)
        ));

        // 测试 Windows 风格的路径遍历
        assert!(matches!(
            validate_path("foo\\..\\bar"),
            Err(ValidationError::PathTraversal)
        ));
    }

    #[test]
    fn test_valid_path() {
        // Unix 路径
        assert!(validate_path("/home/user/project").is_ok());
        assert!(validate_path("./relative/path").is_ok());
        assert!(validate_path("C:/Users/project").is_ok());

        // Windows 路径
        assert!(validate_path("C:\\Users\\project").is_ok());
        assert!(validate_path("D:\\data\\files").is_ok());

        // 网络路径（UNC）
        assert!(validate_path("\\\\server\\share").is_ok());

        // 包含点但不是双点的路径（合法）
        assert!(validate_path("/home/user.project/file").is_ok());
        assert!(validate_path("./config.json").is_ok());
    }

    #[test]
    fn test_null_byte() {
        assert!(matches!(
            validate_path("/path\0with\0null"),
            Err(ValidationError::InvalidCharacters(_))
        ));
    }
}
