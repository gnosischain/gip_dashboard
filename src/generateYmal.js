import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Convert the URL path of the current module to a directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Execute the Python script
const runPythonScript = () => {
  // Path to the Python executable in the virtual environment
  const pythonExecutable = path.join(__dirname, 'scripts/gip_scraper/bin/python');

  // Log file paths
  const stdoutLog = path.join(__dirname, 'logs/python_stdout.log');
  const stderrLog = path.join(__dirname, 'logs/python_stderr.log');

  // Ensure log directory exists
  fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });

  // Spawn the Python process using the virtual environment's Python executable
  const pythonProcess = spawn(pythonExecutable, ['src/scripts/snapshot_crawler_new.py']);

  // Handle standard output
  pythonProcess.stdout.on('data', (data) => {
    console.log(data.toString());
    fs.appendFileSync(stdoutLog, data);
  });

  // Handle error output
  pythonProcess.stderr.on('data', (data) => {
    console.error(data.toString());
    fs.appendFileSync(stderrLog, data);
  });

  // Handle process exit
  pythonProcess.on('close', (code) => {
    console.log(`Python script exited with code ${code}`);
  });
};

runPythonScript();
