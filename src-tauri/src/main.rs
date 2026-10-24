// Windows release da qo'shimcha konsol oynasi ochilmasin. O'CHIRMANG.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sevento_lib::run();
}
