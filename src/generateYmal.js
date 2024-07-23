import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert the URL path of the current module to a directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Execute the Python script
const runPythonScript = () => {
  // Path to the Python executable in the virtual environment
  const pythonExecutable = path.join(__dirname, 'scripts/gip_scraper/bin/python'); // Adjust path as needed for your OS and directory structure

  const pythonProcess = spawn(pythonExecutable, ['src/scripts/snapshot_crawler.py']);

  pythonProcess.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python script exited with code ${code}`);
  });
};

runPythonScript();