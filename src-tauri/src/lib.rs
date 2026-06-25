mod browser;

use browser::screenshot_store::ScreenshotStore;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(ScreenshotStore::default()))
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                let window = _app.get_webview_window("main").unwrap();
                let _ = window_vibrancy::apply_vibrancy(
                    &window,
                    window_vibrancy::NSVisualEffectMaterial::HudWindow,
                    None,
                    Some(16.0),
                );
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ── Standalone browser windows ──
            browser::windows::open_browser_window,
            browser::windows::close_browser_window,
            browser::windows::navigate_browser_window,
            browser::windows::get_webview_url,
            // ── Inline webview management ──
            browser::inline::create_inline_webview,
            browser::inline::update_inline_webview_position,
            browser::inline::set_inline_webview_visibility,
            browser::inline::reposition_and_show_webview,
            browser::inline::close_inline_webview,
            browser::inline::hide_all_inline_webviews,
            browser::inline::close_all_inline_webviews,
            browser::inline::navigate_inline_webview,
            browser::inline::reload_inline_webview,
            // ── Logging / inspection ──
            browser::logging::get_webview_console_logs,
            browser::logging::get_webview_network_logs,
            browser::logging::get_selected_element_info,
            browser::logging::get_webview_dom_tree,
            browser::logging::toggle_webview_inspect_mode,
            browser::logging::enable_webview_inspect_mode,
            browser::logging::disable_webview_inspect_mode,
            browser::logging::clear_element_selection,
            browser::logging::set_element_style,
            browser::logging::get_element_computed_styles,
            browser::logging::get_element_path,
            browser::logging::highlight_element_by_xpath,
            browser::logging::select_element_by_xpath,
            browser::logging::clear_element_highlight,
            browser::logging::check_webview_dom_dirty,
            browser::logging::open_webview_devtools,
            browser::logging::close_webview_devtools,
            browser::logging::is_webview_devtools_open,
            // ── Cookie access ──
            browser::cookies::get_webview_cookies,
            // ── Screenshot capture ──
            browser::capture::browser_inline_capture,
            // ── DOM editor ──
            browser::dom_editor::insert_element,
            browser::dom_editor::insert_html,
            browser::dom_editor::delete_element,
            browser::dom_editor::update_element,
            browser::dom_editor::clone_element,
            browser::dom_editor::move_element,
            browser::dom_editor::undo_dom_operation,
            browser::dom_editor::redo_dom_operation,
            browser::dom_editor::get_dom_history_state,
            browser::dom_editor::serialize_dom_to_html,
            browser::dom_editor::multi_select_add,
            browser::dom_editor::multi_select_remove,
            browser::dom_editor::multi_select_toggle,
            browser::dom_editor::get_multi_selection,
            browser::dom_editor::clear_multi_selection,
            browser::dom_editor::get_element_bounds,
            browser::dom_editor::get_multiple_bounds,
            browser::dom_editor::resize_element,
            browser::dom_editor::set_element_position,
            browser::dom_editor::save_html_to_file,
            browser::dom_editor::get_full_html_document,
            // ── Internal browser commands (page agent) ──
            browser::internal_browser_commands::internal_browser_get_state,
            browser::internal_browser_commands::internal_browser_click,
            browser::internal_browser_commands::internal_browser_input,
            browser::internal_browser_commands::internal_browser_select,
            browser::internal_browser_commands::internal_browser_scroll,
            browser::internal_browser_commands::internal_browser_show_mask,
            browser::internal_browser_commands::internal_browser_hide_mask,
            browser::internal_browser_commands::internal_browser_clean_up,
            browser::internal_browser_commands::internal_browser_is_ready,
            // ── Z-order layering (macOS) ──
            browser::layering::browser_webview_send_to_back,
            browser::layering::browser_webview_bring_to_front,
            browser::layering::browser_webviews_set_layer_for_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running browser app");
}
