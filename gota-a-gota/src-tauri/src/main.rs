// Esconde a janela de consola extra no Windows nas versões finais.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gota_a_gota_lib::run()
}
