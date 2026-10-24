fn main() {
    // API manzili kompilyatsiya paytida (scripts/tauri.mjs) — auth so'rovlari faqat shu serverga
    println!("cargo:rerun-if-env-changed=SEVENTO_API_URL");
    // Ilova buyruqlari faqat capability da ruxsat berilsa chaqiriladi (capabilities/default.json)
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "auth_request",
            "save_document",
            "open_document",
        ]),
    ))
    .expect("tauri build skripti ishlamadi");
}
