/// Entry point shared by the desktop binary and the mobile harnesses.
///
/// The game itself is entirely in the web layer; this shell exists to give it a
/// native window, an installer, and a place on a home screen. The only plugin
/// registered is `opener`, so an invite link tapped inside the app opens in the
/// system browser rather than navigating the game away.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running dooz");
}
