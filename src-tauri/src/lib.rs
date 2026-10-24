//! Sevento desktop: veb ilovaning o'zi (dist/) + uchta Rust buyrug'i.
//!
//! - `auth_request` — login/refresh/logout; refresh token (httpOnly cookie) faqat Rust da.
//! - `save_document` — hisobot/faylni saqlash oynasi orqali.
//! - `open_document` — chek/PDF ni tizim dasturida ochish (u yerdan chop etiladi).
//!
//! Qolgan API so'rovlari — `tauri-plugin-http` (ruxsat faqat build da berilgan server manziliga).

mod auth;
mod documents;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let client = auth::AuthClient::load(app.handle())?;
            app.manage(client);
            documents::cleanup_cache(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::auth_request,
            documents::save_document,
            documents::open_document,
        ])
        .run(tauri::generate_context!())
        .expect("Sevento ilovasi ishga tushmadi");
}
