//! Auth so'rovlari (login / refresh / logout). Refresh token httpOnly cookie sifatida faqat shu
//! modulning cookie jarida saqlanadi: `Set-Cookie` javobdan olib tashlanadi, JS uni hech qachon
//! ko'rmaydi (brauzerdagi httpOnly bilan bir xil kafolat). Access token — JS xotirasida.
//!
//! Jar ilova ma'lumotlari papkasida (`session.json`, faqat egasi o'qiy oladi) — brauzer cookie
//! fayli kabi: ilova qayta ochilganda sessiya tiklanadi, "Chiqish" uni o'chiradi.

use std::fs;
use std::io::{BufReader, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use cookie_store::{CookieStore, RawCookie};
use reqwest::{Client, Method, Url, header};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

/// Refresh cookie bilan ishlaydigan yagona endpointlar (backend: apps/accounts/views.py).
const AUTH_PATHS: [&str; 3] = [
    "/api/v1/auth/login/",
    "/api/v1/auth/refresh/",
    "/api/v1/auth/logout/",
];

/// JS dan qabul qilinadigan sarlavhalar (qolgani, jumladan Cookie, e'tiborsiz).
const FORWARDED_HEADERS: [&str; 5] = [
    "accept",
    "accept-language",
    "authorization",
    "content-type",
    "idempotency-key",
];

/// Server manzili build paytida beriladi (`scripts/tauri.mjs` → SEVENTO_API_URL).
fn api_url() -> &'static str {
    option_env!("SEVENTO_API_URL").unwrap_or("http://localhost:8000")
}

pub struct AuthClient {
    http: Client,
    api: Url,
    jar: Mutex<CookieStore>,
    path: PathBuf,
}

impl AuthClient {
    pub fn load(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let dir = app.path().app_local_data_dir()?;
        fs::create_dir_all(&dir)?;
        let path = dir.join("session.json");
        let jar = fs::File::open(&path)
            .ok()
            .and_then(|file| cookie_store::serde::json::load(BufReader::new(file)).ok())
            .unwrap_or_default();
        let http = Client::builder()
            .user_agent(concat!("Sevento-Desktop/", env!("CARGO_PKG_VERSION")))
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .build()?;
        Ok(Self {
            http,
            api: Url::parse(api_url())?,
            jar: Mutex::new(jar),
            path,
        })
    }

    fn allowed(&self, url: &Url) -> bool {
        is_auth_url(&self.api, url)
    }

    fn cookie_header(&self, url: &Url) -> Option<String> {
        let jar = self.jar.lock().ok()?;
        let value = jar
            .get_request_values(url)
            .map(|(name, value)| format!("{name}={value}"))
            .collect::<Vec<_>>()
            .join("; ");
        (!value.is_empty()).then_some(value)
    }

    fn store(&self, cookies: Vec<RawCookie<'static>>, url: &Url) {
        let Ok(mut jar) = self.jar.lock() else { return };
        jar.store_response_cookies(cookies.into_iter(), url);
        let mut buffer = Vec::new();
        if cookie_store::serde::json::save(&jar, &mut buffer).is_ok() {
            let _ = write_private(&self.path, &buffer);
        }
    }
}

/// Faqat build da berilgan server (sxema, host, port bir xil) va auth endpointlari.
fn is_auth_url(api: &Url, url: &Url) -> bool {
    url.origin() == api.origin() && AUTH_PATHS.contains(&url.path())
}

/// Faylni vaqtinchalik nom bilan yozib, keyin almashtiradi; unix da huquq 0600.
fn write_private(path: &PathBuf, data: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    {
        let mut options = fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&tmp)?;
        file.write_all(data)?;
        file.sync_all()?;
    }
    fs::rename(tmp, path)
}

#[derive(Serialize)]
pub struct AuthResponse {
    status: u16,
    headers: Vec<(String, String)>,
    body: String,
}

#[tauri::command]
pub async fn auth_request(
    state: State<'_, AuthClient>,
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
) -> Result<AuthResponse, String> {
    let url = Url::parse(&url).map_err(|_| "invalid_url".to_string())?;
    if !state.allowed(&url) || !method.eq_ignore_ascii_case("POST") {
        return Err("forbidden_request".into());
    }
    let mut request = state.http.request(Method::POST, url.clone());
    for (name, value) in headers {
        if FORWARDED_HEADERS.contains(&name.to_ascii_lowercase().as_str()) {
            request = request.header(name, value);
        }
    }
    if let Some(cookie) = state.cookie_header(&url) {
        request = request.header(header::COOKIE, cookie);
    }
    if let Some(body) = body {
        request = request.body(body);
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("network_error: {e}"))?;

    let status = response.status().as_u16();
    let mut cookies = Vec::new();
    let mut out = Vec::new();
    for (name, value) in response.headers() {
        let Ok(text) = value.to_str() else { continue };
        if name == header::SET_COOKIE {
            if let Ok(cookie) = RawCookie::parse(text.to_owned()) {
                cookies.push(cookie);
            }
        } else {
            out.push((name.as_str().to_owned(), text.to_owned()));
        }
    }
    if !cookies.is_empty() {
        state.store(cookies, &url);
    }
    let body = response
        .text()
        .await
        .map_err(|e| format!("network_error: {e}"))?;
    Ok(AuthResponse {
        status,
        headers: out,
        body,
    })
}

#[cfg(test)]
mod tests {
    use super::{Url, is_auth_url};

    fn check(url: &str) -> bool {
        let api = Url::parse("https://sevento.example.uz").unwrap();
        is_auth_url(&api, &Url::parse(url).unwrap())
    }

    #[test]
    fn only_auth_endpoints_of_configured_server() {
        assert!(check("https://sevento.example.uz/api/v1/auth/refresh/"));
        assert!(check("https://sevento.example.uz/api/v1/auth/login/"));
        assert!(!check("https://sevento.example.uz/api/v1/users/"));
        assert!(!check("http://sevento.example.uz/api/v1/auth/refresh/"));
        assert!(!check(
            "https://sevento.example.uz:8443/api/v1/auth/refresh/"
        ));
        assert!(!check("https://evil.example/api/v1/auth/refresh/"));
        assert!(!check(
            "https://sevento.example.uz.evil.example/api/v1/auth/login/"
        ));
    }
}
