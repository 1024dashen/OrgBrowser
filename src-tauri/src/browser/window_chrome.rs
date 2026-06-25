//! Native window chrome helpers (inlined from app_window crate).
//!
//! Provides:
//! - macOS: Traffic light positioning
//! - Windows: DWM rounded corner preference
//! - Constants: TRAFFIC_LIGHT_X, TRAFFIC_LIGHT_Y

/// Default traffic light position for native macOS window chrome.
pub const TRAFFIC_LIGHT_X: f64 = 20.0;
pub const TRAFFIC_LIGHT_Y: f64 = 24.0;

/// Host-native window chrome so the OS frame matches frontend corner radii.
///
/// - **Windows 11+:** `DWMWCP_ROUND` via DWM.
/// - **macOS:** Vibrancy corner radius is applied separately.
/// - **Linux / others:** No-op.
pub fn apply_host_desktop_window_chrome(
    #[cfg_attr(not(windows), allow(unused_variables))] window: &tauri::WebviewWindow,
) {
    #[cfg(windows)]
    apply_dwm_rounded_corner_preference(window);
}

// ============================================
// Windows DWM Rounded Corners
// ============================================

#[cfg(windows)]
fn apply_dwm_rounded_corner_preference(window: &tauri::WebviewWindow) {
    use std::ffi::c_void;
    use tracing::warn;
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND,
    };

    let hwnd = match window.hwnd() {
        Ok(handle) => handle,
        Err(err) => {
            warn!(
                "WebviewWindow::hwnd failed (skipping DWM corner preference): {}",
                err
            );
            return;
        }
    };

    let preference = DWMWCP_ROUND;
    let set_result = unsafe {
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            std::ptr::from_ref(&preference).cast::<c_void>(),
            std::mem::size_of_val(&preference) as u32,
        )
    };

    if let Err(err) = set_result {
        warn!(
            "DwmSetWindowAttribute(DWMWA_WINDOW_CORNER_PREFERENCE) failed: {}",
            err
        );
    }
}

// ============================================
// macOS Traffic Light Positioning
// ============================================

/// Set the traffic light button positions on a macOS window.
///
/// Must be called AFTER window creation because Tauri's `traffic_light_position`
/// doesn't reliably work for dynamically created windows.
#[cfg(target_os = "macos")]
pub fn set_traffic_light_position(window: &tauri::WebviewWindow, x: f64, y: f64) {
    use objc2::msg_send;
    use objc2::runtime::{AnyClass, AnyObject};

    let ns_window_ptr = match window.ns_window() {
        Ok(ptr) => ptr,
        Err(_) => return,
    };

    let ns_window_addr = ns_window_ptr as usize;
    let run = move || {
        let ns_window = ns_window_addr as *mut AnyObject;

        unsafe {
            use objc2_app_kit::NSWindowButton;
            use objc2_foundation::NSRect;

            let close: *mut AnyObject =
                msg_send![ns_window, standardWindowButton: NSWindowButton::CloseButton];
            let miniaturize: *mut AnyObject =
                msg_send![ns_window, standardWindowButton: NSWindowButton::MiniaturizeButton];
            let zoom: *mut AnyObject =
                msg_send![ns_window, standardWindowButton: NSWindowButton::ZoomButton];

            if close.is_null() || miniaturize.is_null() || zoom.is_null() {
                return;
            }

            let close_superview: *mut AnyObject = msg_send![close, superview];
            if close_superview.is_null() {
                return;
            }
            let title_bar_container_view: *mut AnyObject = msg_send![close_superview, superview];
            if title_bar_container_view.is_null() {
                return;
            }

            let window_frame: NSRect = msg_send![ns_window, frame];
            let close_rect: NSRect = msg_send![close, frame];
            let title_bar_frame_height = close_rect.size.height + y;

            let mut title_bar_rect: NSRect = msg_send![title_bar_container_view, frame];
            title_bar_rect.size.height = title_bar_frame_height;
            title_bar_rect.origin.y = window_frame.size.height - title_bar_frame_height;
            let _: () = msg_send![title_bar_container_view, setFrame: title_bar_rect];

            let miniaturize_rect: NSRect = msg_send![miniaturize, frame];
            let space_between = miniaturize_rect.origin.x - close_rect.origin.x;

            let buttons = [close, miniaturize, zoom];
            for (i, button) in buttons.iter().enumerate() {
                let mut rect: NSRect = msg_send![*button, frame];
                rect.origin.x = x + (i as f64 * space_between);
                let _: () = msg_send![*button, setFrameOrigin: rect.origin];
            }
        }
    };

    if is_main_thread() {
        run();
    } else {
        dispatch2::DispatchQueue::main().exec_sync(run);
    }
}

#[cfg(target_os = "macos")]
fn is_main_thread() -> bool {
    use objc2::msg_send;
    use objc2::runtime::AnyClass;

    unsafe {
        let Some(cls) = AnyClass::get(c"NSThread") else {
            return false;
        };
        let is_main: bool = msg_send![cls, isMainThread];
        is_main
    }
}
