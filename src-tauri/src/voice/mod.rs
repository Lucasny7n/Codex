use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone)]
pub struct VoiceBackends {
    pub stt: Vec<String>,
    pub tts: Vec<String>,
    pub has_mic: bool,
}

fn check_command(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn detect_voice_backends() -> Result<VoiceBackends, String> {
    let mut stt = Vec::new();
    if check_command("faster-whisper") { stt.push("faster-whisper".to_string()); }
    if check_command("whisper") { stt.push("whisper".to_string()); }
    if check_command("vosk") { stt.push("vosk".to_string()); }

    let mut tts = Vec::new();
    if check_command("piper") { tts.push("piper".to_string()); }
    if check_command("espeak-ng") { tts.push("espeak-ng".to_string()); }
    if check_command("spd-say") { tts.push("spd-say".to_string()); }

    // Check if arecord or pactl can list sources (microphones)
    let has_mic = if check_command("wpctl") {
        let out = Command::new("wpctl").arg("status").output().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
        out.contains("Audio") && out.contains("Sources")
    } else {
        Command::new("arecord").arg("-l").output().map(|o| o.status.success()).unwrap_or(false)
    };

    Ok(VoiceBackends {
        stt,
        tts,
        has_mic,
    })
}
