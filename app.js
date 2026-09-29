import { createExtractorFromData } from 'https://esm.sh/node-unrar-js@2.0.2';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const convertBtn = document.getElementById('convert-btn');
const statusContainer = document.getElementById('status-container');
const statusText = document.getElementById('status-text');

let selectedFile = null;

// UI Event Listeners
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('border-indigo-500');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('border-indigo-500');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-indigo-500');
  if (e.dataTransfer.files.length > 0) {
    handleFileSelection(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelection(e.target.files[0]);
  }
});

function handleFileSelection(file) {
  if (!file.name.toLowerCase().endsWith('.rar')) {
    alert('Please select a valid .rar file.');
    return;
  }
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = `${(file.size / 1024).toFixed(2)} KB`;
  fileInfo.classList.remove('hidden');
}

// Conversion Logic
convertBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  try {
    updateStatus('Reading .rar file...', true);
    convertBtn.disabled = true;

    const arrayBuffer = await selectedFile.arrayBuffer();

    // 1. Fetch the exact WebAssembly binary
    const wasmResponse = await fetch('https://unpkg.com/node-unrar-js@2.0.2/dist/js/unrar.wasm');
    if (!wasmResponse.ok) throw new Error('Failed to load WebAssembly module.');
    const wasmBinary = await wasmResponse.arrayBuffer();

    // 2. Initialize the extractor
    const extractor = await createExtractorFromData({
      data: arrayBuffer,
      wasmBinary: wasmBinary
    });

    const extracted = extractor.extract();
    const files = [...extracted.files];

    // 3. Find the CSV file
    const csvFile = files.find(fileHeader => fileHeader.fileHeader.name.toLowerCase().endsWith('.csv'));

    if (!csvFile) {
      throw new Error('No .csv file found inside the .rar archive.');
    }

    updateStatus('Parsing CSV data...', true);

    const csvUint8Array = csvFile.extraction;
    const csvText = new TextDecoder('utf-8').decode(csvUint8Array);

    // 4. Parse CSV using pipe '|' delimiter
    Papa.parse(csvText, {
      delimiter: '|',
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        updateStatus('Generating Excel workbook...', true);

        const worksheet = XLSX.utils.aoa_to_sheet(results.data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

        const outputFileName = selectedFile.name.replace(/\.rar$/i, '.xlsx');
        XLSX.writeFile(workbook, outputFileName);

        updateStatus('Completed successfully!', false);
        convertBtn.disabled = false;
      },
      error: (err) => {
        throw new Error(`CSV parsing failed: ${err.message}`);
      }
    });

  } catch (error) {
    console.error(error);
    alert(`Error: ${error.message}`);
    updateStatus('Failed to process file.', false);
    convertBtn.disabled = false;
  }
});

function updateStatus(message, show) {
  statusText.textContent = message;
  if (show) {
    statusContainer.classList.remove('hidden');
  }
}