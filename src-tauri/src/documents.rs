//! Fayllar: hisobotni saqlash (tizimning saqlash oynasi) va chek/PDF ni tizim dasturida ochish.
//! JS ga fayl tizimi ruxsati berilmaydi — faqat shu ikki buyruq: biri foydalanuvchi tanlagan
//! joyga yozadi, ikkinchisi ilovaning kesh papkasiga.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use percent_encoding::percent_decode_str;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const CACHE_DIR: &str = "documents";
const CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60);

/// Xavfsiz fayl nomi: papka qismlari, maxsus belgilar va yashirin (`.`) nomlarsiz.
fn sanitize_file_name(encoded: &str) -> String {
    let decoded = percent_decode_str(encoded)
        .decode_utf8_lossy()
        .replace('\\', "/");
    let base = Path::new(&decoded)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let clean: String = base
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '-' | '_' | '.') {
                c
            } else {
                '_'
            }
        })
        .take(120)
        .collect();
    let clean = clean.trim_start_matches('.');
    if clean.is_empty() {
        "hujjat".into()
    } else {
        clean.into()
    }
}

/// `x-file-name` sarlavhasi (JS da `encodeURIComponent`).
fn file_name(request: &Request<'_>) -> Result<String, String> {
    let raw = request
        .headers()
        .get("x-file-name")
        .and_then(|value| value.to_str().ok())
        .ok_or("file_name_missing")?;
    Ok(sanitize_file_name(raw))
}

fn body<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes),
        _ => Err("binary_body_required".into()),
    }
}

fn extension_filter(name: &str) -> Option<(&'static str, &'static str)> {
    match Path::new(name)
        .extension()?
        .to_str()?
        .to_ascii_lowercase()
        .as_str()
    {
        "pdf" => Some(("PDF", "pdf")),
        "xlsx" => Some(("Excel", "xlsx")),
        _ => None,
    }
}

/// Saqlash oynasini ochadi va faylni tanlangan joyga yozadi. Bekor qilinsa — `None`.
#[tauri::command]
pub async fn save_document(app: AppHandle, request: Request<'_>) -> Result<Option<String>, String> {
    let name = file_name(&request)?;
    let data = body(&request)?.to_vec();
    let mut dialog = app.dialog().file().set_file_name(&name);
    if let Some((label, ext)) = extension_filter(&name) {
        dialog = dialog.add_filter(label, &[ext]);
    }
    let Some(target) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path: PathBuf = target.into_path().map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(Some(path.display().to_string()))
}

/// Faylni kesh papkasiga yozib, tizimdagi standart dasturda ochadi (PDF — chop etish uchun).
#[tauri::command]
pub async fn open_document(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let name = file_name(&request)?;
    let data = body(&request)?;
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join(CACHE_DIR);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    fs::write(&path, data).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(path.display().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Ilova ochilganda kechagi va undan eski vaqtinchalik fayllarni o'chiradi.
pub fn cleanup_cache(app: &AppHandle) {
    let Ok(dir) = app.path().app_cache_dir().map(|d| d.join(CACHE_DIR)) else {
        return;
    };
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let old = entry
            .metadata()
            .and_then(|m| m.modified())
            .map(|modified| now.duration_since(modified).unwrap_or_default() > CACHE_TTL)
            .unwrap_or(false);
        if old {
            let _ = fs::remove_file(entry.path());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_file_name;

    #[test]
    fn keeps_plain_names() {
        assert_eq!(sanitize_file_name("chek-12.pdf"), "chek-12.pdf");
        assert_eq!(
            sanitize_file_name("sotuv%20hisoboti.xlsx"),
            "sotuv_hisoboti.xlsx"
        );
        // oʻzbekcha harf (U+02BB) — harf, saqlanadi
        assert_eq!(sanitize_file_name("o%CA%BBzbek.pdf"), "o\u{2bb}zbek.pdf");
    }

    #[test]
    fn strips_directories_and_hidden_names() {
        assert_eq!(sanitize_file_name("..%2F..%2Fetc%2Fpasswd"), "passwd");
        assert_eq!(sanitize_file_name("C%3A%5CWindows%5Cx.pdf"), "x.pdf");
        assert_eq!(sanitize_file_name(".bashrc"), "bashrc");
        assert_eq!(sanitize_file_name(".."), "hujjat");
        assert_eq!(sanitize_file_name(""), "hujjat");
    }
}
