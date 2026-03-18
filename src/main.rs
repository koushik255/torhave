use clap::Parser;
use std::io::{self, Write};
use std::path::Path;
use std::process::{Command, Stdio};

#[derive(Parser)]
#[command(about = "A terminal program", long_about = None)]
struct Args {
    #[arg(short = 't', long = "torrent")]
    torrent: Option<String>,

    #[arg(short = 'T', long = "torrent-test")]
    torrent_test: Option<String>,
}

fn main() {
    let args = Args::parse();

    if let Some(torrent) = args.torrent_test {
        test_torrent(&torrent);
    } else if let Some(torrent) = args.torrent {
        download_torrent(&torrent);
    } else {
        println!("Use -t <torrent> to download, or -tt <torrent> to test if reachable");
    }
}

fn test_torrent(torrent: &str) {
    let is_magnet = torrent.starts_with("magnet:");

    let result = if is_magnet {
        Command::new("aria2c")
            .arg("--bt-metadata-only=true")
            .arg("--bt-save-metadata=false")
            .arg("--timeout=30")
            .arg(torrent)
            .output()
    } else {
        Command::new("aria2c")
            .arg("--dry-run=true")
            .arg(torrent)
            .output()
    };

    match result {
        Ok(output) => {
            if output.status.success() {
                println!("Torrent is reachable and can be downloaded!");
            } else {
                println!("Cannot reach torrent - it may not exist or is unavailable");
            }
        }
        Err(_) => {
            println!("Cannot reach torrent - it may not exist or is unavailable");
        }
    }
}

fn download_torrent(torrent: &str) {
    let output_dir = Path::new("/home/koushikk/Documents/anew/tor/movie");

    if !output_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(output_dir) {
            println!("Failed to create output directory: {}", e);
            return;
        }
    }

    print!("\n");
    io::stdout().flush().unwrap();

    let result = Command::new("aria2c")
        .arg("-d")
        .arg(output_dir)
        .arg(torrent)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status();

    match result {
        Ok(status) => {
            if status.success() {
                println!("\nDownload completed successfully!");
            } else {
                println!(
                    "\neither that torrent doesnt exist or we are having trouble finding it so sorry"
                );
            }
        }
        Err(_) => {
            println!(
                "\neither that torrent doesnt exist or we are having trouble finding it so sorry"
            );
        }
    }
}
