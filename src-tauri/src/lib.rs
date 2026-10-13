/// Entry point shared by the desktop binary and the mobile harnesses.
///
/// The game itself is entirely in the web layer; this shell exists to give it a
/// native window, an installer, a place on a home screen, and the handful of
/// things a web page cannot do on its own: open from a `dooz://` link, buzz a
/// phone through the platform's own feedback styles, post a notification, and
/// on the desktop remember its window and update itself.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Must be the first plugin: a second launch has to be caught before any
    // other plugin does work for a process that is about to exit. With the
    // `deep-link` feature, the URL that launched the second copy is forwarded
    // to the running one and arrives through the deep-link plugin's
    // `onOpenUrl`, so an invite clicked while the game is open joins the room
    // in the window the player already has.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        focus_main_window(app);
    }));

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_process::init());

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_haptics::init());

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            #[cfg(desktop)]
            setup_desktop(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running dooz");
}

#[cfg(desktop)]
fn setup_desktop(app: &mut tauri::App) {
    // The updater refuses to start without an endpoint and a public key, and a
    // build made without release signing has neither. Registering it only when
    // `plugins.updater` is configured keeps such a build working; the web layer
    // treats the missing plugin as "updates are off" and shows nothing.
    if app.config().plugins.0.contains_key("updater") {
        if let Err(error) = app
            .handle()
            .plugin(tauri_plugin_updater::Builder::new().build())
        {
            eprintln!("updater disabled: {error}");
        }
    }

    // Installers register `dooz://` with the OS. A Windows development build
    // and a Linux AppImage are never installed, so they register it at runtime
    // instead (macOS reads it from the app bundle and cannot register at
    // runtime). Failing to is not worth refusing to start over: the game still
    // works, only links from outside will not reach it.
    #[cfg(any(target_os = "linux", all(windows, debug_assertions)))]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        if let Err(error) = app.deep_link().register_all() {
            eprintln!("could not register the dooz:// scheme: {error}");
        }
    }
}

/// Bring the existing window forward when a second copy is launched.
#[cfg(desktop)]
fn focus_main_window(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
