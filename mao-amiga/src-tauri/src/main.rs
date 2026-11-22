// Esconde a janela de consola extra no Windows nas versões finais.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mao_amiga_lib::run()
}
