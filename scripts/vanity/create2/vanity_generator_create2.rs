use clap::{App, Arg};
use ethers::core::types::{Address, H256};
use ethers::utils::{hex, keccak256};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json;
use std::fs;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use rayon::prelude::*;
use tokio::sync::mpsc;
use std::time::{Duration, Instant};
use chrono::prelude::*;
use num_cpus;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use ctrlc;

#[derive(Debug, Clone, Serialize, Deserialize)]
enum PatternType {
    #[serde(rename = "prefix")]
    Prefix,
    #[serde(rename = "suffix")]
    Suffix,
    #[serde(rename = "both")]
    Both,
    #[serde(rename = "regex")]
    Regex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Pattern {
    #[serde(rename = "type")]
    pattern_type: String,
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VanityResult {
    salt: String,
    address: String,
    pattern: String,
    attempt: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BytecodeFile {
    #[serde(rename = "contractName")]
    contract_name: String,
    bytecode: String,
    #[serde(rename = "bytecodeHash")]
    bytecode_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OutputResults {
    timestamp: String,
    deployer: String,
    #[serde(rename = "codeHash")]
    code_hash: String,
    results: Vec<VanityResult>,
}

#[derive(Clone)]
struct Create2VanityHelper {
    deployer_address: Address,
    init_code_hash: H256,
}

impl Create2VanityHelper {
    fn new(deployer_address: Address, init_code_hash: H256) -> Self {
        Self { deployer_address, init_code_hash }
    }

    // Generate a guarded salt for CREATE2 deployment
    fn generate_guarded_salt(&self, random_part: &[u8; 11]) -> H256 {
        let mut salt_bytes = [0u8; 32];
        
        // Copy deployer address to first 20 bytes
        salt_bytes[0..20].copy_from_slice(&self.deployer_address.as_bytes());
        
        // Set the 21st byte to 0x00 (NO cross-chain protection)
        salt_bytes[20] = 0x00;
        
        // Copy the random part to the remaining 11 bytes
        salt_bytes[21..32].copy_from_slice(random_part);
        
        H256::from(salt_bytes)
    }

    // Calculate the actual salt used by CreateX contract
    // This applies the CreateX special salt handling
    fn calculate_create_x_salt(&self, salt: H256) -> H256 {
        let salt_bytes = salt.as_bytes();
        
        // Check if first 20 bytes match deployer and 21st byte is 0x00
        // This replicates the CreateX contract's salt guarding logic
        let salt_deployer = Address::from_slice(&salt_bytes[0..20]);
        if salt_deployer == self.deployer_address && salt_bytes[20] == 0 {
            // Hash deployer with salt as per CreateX contract
            let encoded = ethers::abi::encode(&[
                ethers::abi::Token::Address(self.deployer_address),
                ethers::abi::Token::FixedBytes(salt.as_bytes().to_vec())
            ]);
            
            return H256::from_slice(&keccak256(&encoded));
        }
        
        // No special processing needed
        salt
    }

    // Compute CREATE2 address using the factory contract address
    fn compute_create2_address(&self, salt: H256) -> Address {
        // Apply the CreateX salt guarding logic
        let guarded_salt = self.calculate_create_x_salt(salt);
        
        // For CREATE2 address calculation, we need to use:
        // 1. The CreateX factory address (hardcoded)
        // 2. The guarded salt
        // 3. The init code hash
        
        // CreateX factory contract address
        let factory_address = Address::from_str("0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed").unwrap();
        
        // BUILD THE CREATE2 INPUT: 0xff ++ factory_address ++ guarded_salt ++ keccak256(init_code)
        let mut create2_input = Vec::with_capacity(1 + 20 + 32 + 32);
        create2_input.push(0xff);
        create2_input.extend_from_slice(factory_address.as_bytes());
        create2_input.extend_from_slice(guarded_salt.as_bytes());
        create2_input.extend_from_slice(self.init_code_hash.as_bytes());
        
        // Hash it and take last 20 bytes for the address
        let address_bytes = &keccak256(&create2_input)[12..];
        Address::from_slice(address_bytes)
    }
}

struct SearchRange {
    start: u64,
    end: u64,
    patterns: Vec<(String, Regex)>,
}

// Helper function to save results
fn save_results(output: &OutputResults, path: &str) -> std::io::Result<()> {
    let output_json = serde_json::to_string_pretty(&output)?;
    fs::write(path, output_json)
}

// Helper function to format duration as human-readable time
fn format_duration(duration: Duration) -> String {
    let total_seconds = duration.as_secs();
    
    if total_seconds < 60 {
        return format!("{}s", total_seconds);
    }
    
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    
    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, seconds)
    } else {
        format!("{}m {}s", minutes, seconds)
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse command line arguments
    let matches = App::new("CREATE2 Vanity Address Generator")
        .version("1.0")
        .author("VaultEdge")
        .about("Generate CREATE2 vanity addresses for contract deployment")
        .arg(
            Arg::with_name("deployer")
                .long("deployer")
                .value_name("ADDRESS")
                .help("The address that will deploy the contracts")
                .required(true)
                .takes_value(true),
        )
        .arg(
            Arg::with_name("bytecode-file")
                .long("bytecode-file")
                .value_name("FILE")
                .help("Path to bytecode JSON file")
                .required(true)
                .takes_value(true),
        )
        .arg(
            Arg::with_name("patterns-file")
                .long("patterns-file")
                .value_name("FILE")
                .help("JSON file containing patterns to search for")
                .required(true)
                .takes_value(true),
        )
        .arg(
            Arg::with_name("output")
                .long("output")
                .value_name("FILE")
                .help("Output file path to save results")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("attempts")
                .long("attempts")
                .value_name("NUMBER")
                .help("Maximum number of attempts")
                .default_value("1000000")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("threads")
                .long("threads")
                .value_name("NUMBER")
                .help("Number of worker threads to use")
                .takes_value(true),
        )
        .get_matches();

    // Parse deployer address
    let deployer_address_str = matches.value_of("deployer").unwrap().to_string();
    let deployer_address = Address::from_str(&deployer_address_str)?;
    println!("Deployer address: {}", deployer_address);

    // Load bytecode from file
    let bytecode_file_path = matches.value_of("bytecode-file").unwrap();
    let bytecode_content = fs::read_to_string(bytecode_file_path)?;
    let bytecode_data: BytecodeFile = serde_json::from_str(&bytecode_content)?;
    
    println!("Contract name: {}", bytecode_data.contract_name);
    println!("Bytecode loaded: {} bytes", bytecode_data.bytecode.len());

    // Get init code hash (either from file or calculate)
    let init_code_hash = if !bytecode_data.bytecode_hash.is_empty() {
        H256::from_str(&bytecode_data.bytecode_hash)?
    } else {
        let init_code = hex::decode(bytecode_data.bytecode.trim_start_matches("0x"))?;
        H256::from_slice(&keccak256(&init_code))
    };
    println!("Init code hash: {}", init_code_hash);

    // Load patterns
    let patterns_file_path = matches.value_of("patterns-file").unwrap();
    let patterns_content = fs::read_to_string(patterns_file_path)?;
    let patterns: Vec<Pattern> = serde_json::from_str(&patterns_content)?;
    println!("Loaded {} patterns", patterns.len());

    // Prepare regex patterns
    let regex_patterns = patterns
        .iter()
        .map(|pattern| {
            let regex = match pattern.pattern_type.as_str() {
                "prefix" => Regex::new(&format!(r"(?i)^0x{}", pattern.value)).unwrap(),
                "suffix" => Regex::new(&format!(r"(?i){}$", pattern.value)).unwrap(),
                "contains" => Regex::new(&format!(r"(?i){}", pattern.value)).unwrap(),
                "regex" => Regex::new(&format!(r"(?i){}", pattern.value)).unwrap(),
                _ => Regex::new(&format!(r"(?i)^0x{}", pattern.value)).unwrap(),
            };
            
            let description = match pattern.pattern_type.as_str() {
                "prefix" => format!("starts with {}", pattern.value),
                "suffix" => format!("ends with {}", pattern.value),
                "contains" => format!("contains {}", pattern.value),
                "regex" => format!("matches regex {}", pattern.value),
                _ => format!("starts with {}", pattern.value),
            };
            
            println!("Pattern: {} ({})", description, pattern.value);
            (description, regex)
        })
        .collect::<Vec<_>>();

    // Parse number of attempts
    let max_attempts = matches
        .value_of("attempts")
        .unwrap()
        .parse::<u64>()
        .unwrap_or(1000000);
    println!("Max attempts: {}", max_attempts);

    // Get number of threads
    let num_threads = matches
        .value_of("threads")
        .map(|s| s.parse::<usize>().unwrap_or(num_cpus::get()))
        .unwrap_or(num_cpus::get());
    println!("Using {} worker threads", num_threads);

    // Get output file path and ensure output directory exists
    let timestamp = Utc::now().format("%Y-%m-%d_%H%M%S").to_string();
    let output_file_path = matches
        .value_of("output")
        .map(|path| {
            let path = std::path::Path::new(path);
            let parent = path.parent().unwrap_or(std::path::Path::new(""));
            let stem = path.file_stem().unwrap_or_default().to_str().unwrap_or("vanity-salts-create2");
            let ext = path.extension().unwrap_or_default().to_str().unwrap_or("json");
            parent.join(format!("{}_{}.{}", stem, timestamp, ext)).to_str().unwrap().to_string()
        })
        .unwrap_or_else(|| format!("./output/vanity-salts-create2_{}.json", timestamp));

    // Clone output path for async context
    let async_output_path = output_file_path.clone();

    // Ensure output directory exists
    if let Some(parent) = std::path::Path::new(&output_file_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Create vanity helper
    let create2_helper = Create2VanityHelper::new(deployer_address, init_code_hash);

    // Create a multi-progress bar for monitoring
    let mp = MultiProgress::new();
    
    // Create a progress bar for overall progress
    let overall_pb = mp.add(ProgressBar::new(max_attempts));
    overall_pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} ({percent}%) @ {per_sec} {msg}")
            .expect("Failed to set progress bar style")
            .progress_chars("#>-")
    );
    overall_pb.set_message("Starting...");
    
    // Clone for later use
    let overall_pb_for_completion = overall_pb.clone();
    
    // Channel for workers to send results
    let (tx, mut rx) = mpsc::channel(1000);
    let (progress_tx, mut progress_rx) = mpsc::channel(1000);

    // Split the work into ranges
    let chunk_size = max_attempts / num_threads as u64;
    let mut ranges = Vec::new();
    for i in 0..num_threads {
        let start = i as u64 * chunk_size;
        let end = if i == num_threads - 1 {
            max_attempts
        } else {
            (i + 1) as u64 * chunk_size
        };
        ranges.push(SearchRange {
            start,
            end,
            patterns: regex_patterns.clone(),
        });
    }

    // Results collection
    let results = Arc::new(Mutex::new(Vec::new()));
    let results_clone = Arc::clone(&results);

    // Worker logic
    let handles: Vec<_> = ranges
        .into_par_iter()
        .enumerate()
        .map(|(i, range)| {
            let tx = tx.clone();
            let progress_tx = progress_tx.clone();
            let helper = create2_helper.clone();
            let patterns = range.patterns.clone();

            std::thread::spawn(move || {
                let mut rng = rand::thread_rng();
                let mut local_results = Vec::new();
                let mut last_progress_update = 0;
                let progress_update_interval = 50_000; // Update every 50k attempts instead of 10k

                for attempt in range.start..range.end {
                    // Generate random salt part (11 bytes)
                    let mut random_part = [0u8; 11];
                    rand::Rng::fill(&mut rng, &mut random_part);

                    // Generate guarded salt
                    let salt = helper.generate_guarded_salt(&random_part);
                    
                    // Compute CREATE2 address
                    let address = helper.compute_create2_address(salt);
                    let address_str = format!("{:?}", address);

                    // Only print a single example address at startup
                    if i == 0 && attempt == range.start {
                        println!("Starting search... Example address: {}", address_str);
                    }

                    // Check if address matches any pattern
                    for (description, pattern) in &patterns {
                        if pattern.is_match(&address_str) {
                            let result = VanityResult {
                                salt: format!("0x{}", hex::encode(salt.as_bytes())),
                                address: address_str.clone(),
                                pattern: description.clone(),
                                attempt,
                            };
                            local_results.push(result.clone());
                            
                            // Don't print match immediately to reduce scrolling
                            // Instead, we'll consolidate and print in batches
                            
                            // Send result through channel
                            if let Err(e) = tx.blocking_send(result) {
                                eprintln!("Failed to send result: {}", e);
                            }
                            
                            break;
                        }
                    }

                    // Update progress less frequently to reduce overhead
                    if attempt - range.start >= last_progress_update + progress_update_interval {
                        let progress = attempt - range.start - last_progress_update;
                        last_progress_update = attempt - range.start;
                        
                        if let Err(e) = progress_tx.blocking_send(progress) {
                            eprintln!("Failed to send progress update: {}", e);
                        }
                    }
                }

                // Final progress update
                let final_progress = range.end - range.start - last_progress_update;
                if final_progress > 0 {
                    if let Err(e) = progress_tx.blocking_send(final_progress) {
                        eprintln!("Failed to send final progress update: {}", e);
                    }
                }

                // Only print thread completion messages if matches were found
                if !local_results.is_empty() && local_results.len() >= 5 {
                    println!("Worker {} found {} matches", i + 1, local_results.len());
                }
            })
        })
        .collect();

    // Spawn task to collect results and update progress
    let deployer_str = deployer_address_str.clone();
    let init_hash = init_code_hash.clone();
    
    // Set up ctrl-c handler
    let running = Arc::new(Mutex::new(true));
    let r = running.clone();
    
    // Clone progress bar for cleanup in ctrl+c handler
    let overall_pb_ctrl_c = overall_pb_for_completion.clone();
    
    // Clone results for saving on interrupt
    let results_for_interrupt = Arc::clone(&results);
    let output_path_for_interrupt = output_file_path.clone();
    let deployer_str_for_interrupt = deployer_address_str.clone();
    let init_hash_for_interrupt = init_code_hash.clone();
    
    ctrlc::set_handler(move || {
        let mut running = r.lock().unwrap();
        *running = false;
        println!("\nStopping search (Ctrl+C)...");
        
        // Save results before exiting
        let final_results = results_for_interrupt.lock().unwrap();
        if !final_results.is_empty() {
            println!("Saving {} results before exit...", final_results.len());
            
            // Create output structure
            let output = OutputResults {
                timestamp: Utc::now().to_rfc3339(),
                deployer: deployer_str_for_interrupt.clone(),
                code_hash: format!("{:?}", init_hash_for_interrupt),
                results: final_results.clone(),
            };
            
            // Save to file
            if let Err(e) = save_results(&output, &output_path_for_interrupt) {
                eprintln!("Error saving results on exit: {}", e);
            } else {
                // Create absolute path for clickable link
                let abs_path = match std::fs::canonicalize(&output_path_for_interrupt) {
                    Ok(p) => p.to_string_lossy().into_owned(),
                    Err(_) => output_path_for_interrupt.clone(),
                };
                println!("Results saved to file://{} (on exit)", abs_path);
            }
        } else {
            println!("No results to save.");
        }
        
        // Finish progress bar to stop rendering
        overall_pb_ctrl_c.finish_with_message("Search interrupted");
        
        // Allow a little time for cleanup then force exit
        std::thread::sleep(std::time::Duration::from_secs(1));
        println!("Exiting...");
        std::process::exit(0);
    }).expect("Error setting Ctrl-C handler");

    let collect_task = tokio::spawn(async move {
        let start_time = Instant::now();
        let mut _processed = 0; // Total processed attempts
        let mut _processed_since_last_update = 0; // Added underscore to fix warning
        let mut last_status_time = Instant::now();
        let mut last_save_time = Instant::now();
        let status_interval = std::time::Duration::from_secs(5); // Update status every 5 seconds
        let save_interval = std::time::Duration::from_secs(30); // Save results every 30 seconds
        let mut consolidated_matches = 0;
        let mut last_rate = 0.0; // Processing rate (attempts per second)
        
        loop {
            tokio::select! {
                Some(result) = rx.recv() => {
                    let mut results_vec = results_clone.lock().unwrap();
                    results_vec.push(result);
                    let matches_count = results_vec.len();
                    consolidated_matches += 1;
                    
                    // Only print status update periodically, not for every match
                    if last_status_time.elapsed() >= status_interval {
                        let elapsed = start_time.elapsed();
                        let elapsed_secs = elapsed.as_secs_f64();
                        
                        // Calculate processing rate and estimated time remaining
                        last_rate = _processed as f64 / elapsed_secs;
                        let remaining_attempts = max_attempts as i64 - _processed as i64;
                        
                        if remaining_attempts > 0 && last_rate > 0.0 {
                            let remaining_secs = remaining_attempts as f64 / last_rate;
                            let eta = format_duration(Duration::from_secs_f64(remaining_secs));
                            
                            println!("Found {} matches in {:?} ({} new) - {:.2}M attempts/s - ETA: {}",
                                matches_count, elapsed, consolidated_matches, 
                                last_rate / 1_000_000.0, eta);
                        } else {
                            println!("Found {} matches in {:?} ({} new) - {:.2}M attempts/s", 
                                matches_count, elapsed, consolidated_matches,
                                last_rate / 1_000_000.0);
                        }
                        
                        consolidated_matches = 0;
                        last_status_time = Instant::now();
                        _processed_since_last_update = 0;
                    }
                    
                    // Save results periodically based on time interval instead of match count
                    if last_save_time.elapsed() >= save_interval && !results_vec.is_empty() {
                        // Create output structure
                        let output = OutputResults {
                            timestamp: Utc::now().to_rfc3339(),
                            deployer: deployer_str.clone(),
                            code_hash: format!("{:?}", init_hash),
                            results: results_vec.clone(),
                        };
                        
                        // Save to file
                        if let Err(e) = save_results(&output, &async_output_path) {
                            eprintln!("Error saving intermediate results: {}", e);
                        } else {
                            // Create absolute path for clickable link
                            let abs_path = match std::fs::canonicalize(&async_output_path) {
                                Ok(p) => p.to_string_lossy().into_owned(),
                                Err(_) => async_output_path.clone(),
                            };
                            println!("Saved {} results to file://{} (auto-save)", results_vec.len(), abs_path);
                        }
                        
                        last_save_time = Instant::now();
                    }
                },
                Some(progress) = progress_rx.recv() => {
                    _processed += progress;
                    _processed_since_last_update += progress;
                    overall_pb.inc(progress);
                    
                    // Update progress bar message with ETA
                    if last_rate > 0.0 {
                        let remaining_attempts = max_attempts as i64 - _processed as i64;
                        if remaining_attempts > 0 {
                            let remaining_secs = remaining_attempts as f64 / last_rate;
                            let eta = format_duration(Duration::from_secs_f64(remaining_secs));
                            overall_pb.set_message(format!("ETA: {}", eta));
                        }
                    }
                },
                else => {
                    break;
                }
            }
            
            // Check if we should stop
            if !*running.lock().unwrap() {
                break;
            }
        }

        Ok::<_, Box<dyn std::error::Error + Send>>(())
    });

    // Wait for all worker threads to complete
    for handle in handles {
        handle.join().unwrap();
    }

    // Complete progress bar
    overall_pb_for_completion.finish_with_message("Search completed");
    
    // Close all channels to prevent further output
    drop(tx);
    drop(progress_tx);

    // Wait for collect task to complete with a timeout
    match tokio::time::timeout(std::time::Duration::from_secs(2), collect_task).await {
        Ok(result) => {
            if let Err(e) = result {
                eprintln!("Error in collect task: {}", e);
            }
        },
        Err(_) => {
            println!("Timed out waiting for collection. Moving to final results...");
        }
    }

    // Final save
    let final_results = results.lock().unwrap();
    
    println!("\n------------ FINAL RESULTS ------------");
    println!("Total matches found: {}", final_results.len());
    
    if !final_results.is_empty() {
        // Create output structure
        let output = OutputResults {
            timestamp: Utc::now().to_rfc3339(),
            deployer: deployer_address_str,
            code_hash: format!("{:?}", init_code_hash),
            results: final_results.clone(),
        };
        
        // Save to file using original path
        if let Err(e) = save_results(&output, &output_file_path) {
            eprintln!("Error saving final results: {}", e);
        } else {
            // Create absolute path for clickable link
            let abs_path = match std::fs::canonicalize(&output_file_path) {
                Ok(p) => p.to_string_lossy().into_owned(),
                Err(_) => output_file_path.clone(),
            };
            println!("Final results saved to: file://{}", abs_path);
            
            // Show only first 3 matches in summary to avoid scrolling
            let display_count = std::cmp::min(3, final_results.len());
            if display_count > 0 {
                println!("\nSample matches:");
                for i in 0..display_count {
                    let result = &final_results[i];
                    println!("{}. Address: {}", i+1, result.address);
                }
                
                if final_results.len() > display_count {
                    println!("... and {} more matches in the output file", 
                        final_results.len() - display_count);
                }
            }
        }
    } else {
        println!("No matches found after {} attempts", max_attempts);
    }
    
    println!("\nSearch complete. Process finished.");
    
    // Force exit to ensure all threads terminate
    std::process::exit(0);
} 