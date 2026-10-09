// The console window is only wanted while developing; a released Windows build
// should not open one behind the game.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dooz_lib::run()
}
