// --- Configuration ---
// !!! ADJUST THESE KEYS TO MATCH YOUR ACTUAL COLUMN NAMES IN THE UPLOADED FILE !!!
const COLUMN_KEYS = {
    week: 'Week',                       // For Weekly Trend
    productFamily: 'Product Family',    // For Product Family Chart & Filter
    assembly: 'Assembly',               // For Assembly Chart & Filter
    detectionStage: 'Detection Stage',  // For Detection Stage Chart
    problemObserved: 'Problem Observed',// For Problem Observed Chart
    functionality: 'Functionality',     // For Functionality Chart
    responsible: 'Responsible',         // For Responsible Chart
    problemAnalysis: 'Problem Analysis',// For Problem Analysis Chart (Root Cause)
    tat: 'TAT',                         // For KPI Cards
    submittedBy: 'Submitted By'         // <<<--- ADDED THIS LINE (Matches header 'Submitted By')
    // Add other keys if needed
};

// --- Global Variables ---
let allData = [];
let filteredData = [];
let chartInstances = {}; // To store chart objects for updates/destruction
const MAX_BAR_ITEMS = 15; // Max items to show directly on bar charts before grouping 'Other'
const MAX_PIE_ITEMS = 7;  // Max slices for pie/doughnut charts before grouping 'Other'

// --- Chart.js Defaults (Optional: Customize appearance) ---
Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.8)';
Chart.defaults.plugins.tooltip.titleFont.size = 14;
Chart.defaults.plugins.tooltip.bodyFont.size = 12;
Chart.defaults.plugins.legend.position = 'bottom';
// Initial default colors (will be updated by setTheme)
Chart.defaults.color = '#666';
Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.1)';

// --- DOM Ready ---
$(document).ready(function() {
    console.log("Dashboard initializing...");

    // --- Event Listeners ---
    $('#uploadFormNav').on('submit', handleFileUpload);
    $('#filterForm').on('submit', handleFilterSubmit);
    $('#resetFilters').on('click', handleFilterReset);
    $('#themeToggleBtn').on('click', toggleTheme);
    // $('#toggleFilters').on('click', toggleFilterVisibility); // <-- REMOVED - Handled by Bootstrap Collapse in HTML
    $('#downloadPdfBtn').on('click', downloadDashboardAsPdf);
    $('#downloadExcelBtn').on('click', downloadDataAsExcel);

    // Initialize theme based on preference or default
    initializeTheme();

    // Placeholder for initializing advanced filters like sliders or multi-select
    // initializeAdvancedFilters(); // Uncomment if you implement noUiSlider or Select2

    console.log("Event listeners attached.");
});

// --- File Handling ---
function handleFileUpload(event) {
    event.preventDefault();
    console.log("Handling file upload...");
    const fileInput = document.getElementById('fileInputNav');

    showStatus('Processing file...', 'info'); // Use helper function
    $('#analysisSection').slideUp(); // Hide previous analysis
    $('#exportBtnContainer').hide(); // Hide export buttons

    if (!fileInput.files || fileInput.files.length === 0) {
        showStatus('Please select a file.', 'danger');
        console.error("No file selected.");
        return;
    }

    const file = fileInput.files[0];
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    console.log(`File selected: ${fileName}, Extension: ${fileExtension}`);

    const reader = new FileReader();

    reader.onload = function(e) {
        console.log("File read successfully.");
        try {
            const fileContent = e.target.result;
            if (fileExtension === 'csv') {
                parseCsvData(fileContent);
            } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                parseExcelData(fileContent);
            } else {
                throw new Error("Unsupported file type. Please select CSV or Excel.");
            }
            processAndDisplayData(allData); // Process the globally stored 'allData'
            // Success status set within processAndDisplayData if successful
        } catch (error) {
            console.error("Error processing file:", error);
            showStatus(`Error processing file: ${error.message}`, 'danger');
            $('#analysisSection').slideUp();
            $('#exportBtnContainer').hide();
        } finally {
             // Clear the file input value after processing
             fileInput.value = '';
        }
    };

    reader.onerror = function(e) {
        console.error("Error reading file:", e);
        showStatus('Error reading file.', 'danger');
        $('#analysisSection').slideUp();
        $('#exportBtnContainer').hide();
        fileInput.value = ''; // Clear input on error too
    };

    // Read based on extension
    if (fileExtension === 'csv') {
        reader.readAsText(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        reader.readAsArrayBuffer(file);
    } else {
        showStatus('Unsupported file type. Please select CSV or Excel.', 'danger');
        console.error("Unsupported file type selected.");
        fileInput.value = ''; // Clear input
    }
}

function parseCsvData(csvString) {
    console.log("Parsing CSV data...");
    let parseError = false;
    let partialDataWarning = false;
    Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // Attempt auto-typing
        transformHeader: header => String(header).trim(), // Trim header whitespace
        complete: function(results) {
            if (results.errors && results.errors.length > 0) {
                console.error("CSV Parsing errors:", results.errors);
                const errorMsg = results.errors.slice(0, 3).map(err => `Row ${err.row}: ${err.message}`).join('; ');

                if (!results.data || results.data.length === 0) {
                    parseError = true; // Mark as fatal error if no data parsed
                    showStatus(`CSV Parsing failed critically: ${errorMsg}... Check console/data.`, 'danger');
                } else {
                     console.warn("Partial data parsed despite errors.");
                     // Add warning to status without overwriting success/failure
                     if ($('#uploadStatus')) $('#uploadStatus').append(`<br/><small class='text-warning'>Parsing issues found: ${errorMsg}...</small>`);
                     partialDataWarning = true;
                }
            }

            if (!parseError) {
                console.log(`CSV Parsed: ${results.data.length} records.`);
                allData = cleanData(results.data);
                if (allData.length === 0 && !partialDataWarning) { // Check if cleaning resulted in no data
                     showStatus('CSV parsed, but no valid data rows found after cleaning.', 'warning');
                     throw new Error('No valid data rows after cleaning.'); // Treat as error for processing flow
                }
            } else {
                 allData = []; // Ensure allData is empty on fatal error
                 throw new Error("CSV Parsing failed critically. Check console/data.");
            }
        },
        error: function(error) { // This catches fundamental PapaParse errors
            console.error("PapaParse error:", error);
            parseError = true;
            allData = [];
            throw new Error(`CSV Parsing failed: ${error.message}. Check file format.`);
        }
    });
     // Ensure error thrown within complete/error handler prevents further processing
     if(parseError && allData.length === 0) throw new Error("CSV Parsing failed.");
}

function parseExcelData(arrayBuffer) {
    console.log("Parsing Excel data...");
    try {
        if (typeof XLSX === 'undefined') {
            throw new Error("XLSX library is not loaded. Check script path or network.");
        }
        const workbook = XLSX.read(arrayBuffer, { type: 'buffer', cellDates: true }); // cellDates: true helps with date types
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("Excel file contains no sheets.");
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) throw new Error(`Sheet "${firstSheetName}" could not be read.`);

        // Use header: 1 to get array of arrays, then process headers manually for trimming and handling potential empty rows
        const sheetDataAoA = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false }); // raw: false attempts date formatting

        // Find the first row with any content to use as header
        let headerRowIndex = -1;
        for (let i = 0; i < sheetDataAoA.length; i++) {
            if (sheetDataAoA[i].some(cell => cell !== null && cell !== undefined && cell !== '')) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1 || sheetDataAoA.length <= headerRowIndex + 1) {
             allData = [];
             console.log("Excel sheet appears to be empty or has no data rows.");
             showStatus('Excel sheet parsed, but no header or data rows found.', 'warning');
             return; // Not throwing error, just no data
        }

        const headers = sheetDataAoA[headerRowIndex].map(header => String(header).trim());
        const jsonData = [];
        for(let i = headerRowIndex + 1; i < sheetDataAoA.length; i++) {
            // Only process rows that have at least one non-empty cell matching header length
             if (sheetDataAoA[i].length >= headers.length && sheetDataAoA[i].some(cell => cell !== null && cell !== undefined && cell !== '')) {
                const rowData = {};
                headers.forEach((header, index) => {
                    // Ensure index is within bounds of the current row array
                    rowData[header] = index < sheetDataAoA[i].length ? sheetDataAoA[i][index] : '';
                });
                jsonData.push(rowData);
            }
        }

        if (jsonData.length === 0) {
            allData = [];
            console.log("Excel sheet parsed, but no data rows found after header.");
            showStatus('Excel sheet parsed, but no data rows found after the header.', 'warning');
            return;
        }

        console.log(`Excel Parsed: ${jsonData.length} records.`);
        allData = cleanData(jsonData);
        if (allData.length === 0) {
             showStatus('Excel parsed, but no valid data rows found after cleaning.', 'warning');
        }

    } catch (error) {
        console.error("Excel Parsing Error:", error);
        allData = [];
        if (error.message.includes("XLSX library is not loaded")) {
             throw error;
        } else {
             throw new Error(`Excel parsing failed: ${error.message}`);
        }
    }
}


function cleanData(data) {
    console.log("Cleaning data...");
    if (!Array.isArray(data)) return [];
    const definedKeys = Object.values(COLUMN_KEYS);
    let missingKeyWarn = false;

    // Check if essential keys are present in the first row (if data exists)
    if (data.length > 0 && data[0]) {
         const firstRowKeys = Object.keys(data[0]);
         definedKeys.forEach(defKey => {
            if (!firstRowKeys.includes(defKey)) {
                console.warn(`Configured column key "${defKey}" might be missing in the uploaded data headers.`);
                // Optionally show a warning to the user once
                if (!missingKeyWarn && $('#uploadStatus')) {
                     $('#uploadStatus').append(`<br/><small class='text-warning'>Warning: Some expected columns (e.g., "${defKey}") might be missing or misnamed in the file.</small>`);
                     missingKeyWarn = true;
                }
            }
         });
    }

    return data.filter(row => row && typeof row === 'object').map(row => {
        const cleanedRow = {};
        // Iterate over the keys DEFINED in COLUMN_KEYS to ensure we process expected data
        for (const key in COLUMN_KEYS) {
             const headerName = COLUMN_KEYS[key];
             const value = row[headerName]; // Get value using the header name from the row
             let cleanedValue = value;

            // General Cleaning
            if (typeof value === 'string') {
                cleanedValue = value.trim();
            } else if (value instanceof Date) {
                 // Keep Date objects if needed, otherwise format them
                 // cleanedValue = value.toISOString().split('T')[0]; // Example: Format as YYYY-MM-DD
            } else if (value === null || value === undefined || value === '') {
                 cleanedValue = null; // Standardize empty values to null
            }

            // Specific cleaning based on the KEY from COLUMN_KEYS
            if (key === 'tat') { // Check using the object key 'tat'
                const num = Number(String(cleanedValue).replace(/[^0-9.-]+/g,""));
                cleanedValue = isNaN(num) ? null : num;
            } else if (key === 'week') { // Check using the object key 'week'
                 if (cleanedValue !== null) {
                      const weekNumMatch = String(cleanedValue).match(/\d+/);
                      cleanedValue = weekNumMatch ? parseInt(weekNumMatch[0], 10) : null;
                 }
            } else if (key === 'submittedBy') { // Specific cleaning for submitter if needed
                 // Example: convert to uppercase, or handle specific formatting
                 // if (cleanedValue !== null) cleanedValue = String(cleanedValue).toUpperCase();
            }
             // Add more specific cleaning rules here if needed

            cleanedRow[headerName] = cleanedValue; // Store with the original header name as key
        }
         // Add any other columns from the row that were not in COLUMN_KEYS (optional)
         // for (const originalKey in row) {
         //     if (!definedKeys.includes(originalKey) && !cleanedRow.hasOwnProperty(originalKey)) {
         //        cleanedRow[originalKey] = typeof row[originalKey] === 'string' ? row[originalKey].trim() : row[originalKey];
         //     }
         // }

        return cleanedRow;
    }).filter(row => {
        // Filter out rows that are entirely empty after cleaning (all values are null)
        return Object.values(row).some(val => val !== null);
    });
}


// --- Main Processing and Display ---
function processAndDisplayData(sourceData) {
    console.log("Processing and displaying data...");
    if (!sourceData || sourceData.length === 0) {
        console.warn("No data available to process.");
        // Status message should already be set by parsing functions if no data was found
        if($('#uploadStatus') && !$('#uploadStatus').text().toLowerCase().includes('no data') && !$('#uploadStatus').text().toLowerCase().includes('error')) {
            showStatus('Processed file, but no valid data was extracted.', 'warning');
        }
        $('#analysisSection').slideUp();
        $('#exportBtnContainer').hide();
        // Destroy any lingering charts
        Object.values(chartInstances).forEach(chart => {
             if (chart && typeof chart.destroy === 'function') {
                 chart.destroy();
             }
         });
        chartInstances = {};
        return;
    }

    filteredData = [...sourceData]; // Initialize filtered data with all (cleaned) data

    // Populate Filters (Do this before generating charts that might depend on filter state)
    populateFilterOptions(sourceData); // Populate based on ALL data

    // Update KPIs
    updateKpiCards(filteredData);

    // Generate Charts
    generateCharts(filteredData);

    // Show the analysis section and export buttons
    $('#exportBtnContainer').show();
    $('#analysisSection').slideDown();
    console.log("Analysis section displayed.");
    // If status was 'Processing...', update it to success if not already done
     if ($('#uploadStatus') && $('#uploadStatus').hasClass('alert-info')) {
         showStatus('Data processed and displayed.', 'success');
     }
}

// --- Filter Handling ---
function handleFilterSubmit(event) {
    event.preventDefault();
    applyFilters();
}

function handleFilterReset() {
    console.log("Resetting filters...");
    $('#filterForm')[0].reset(); // Reset standard form elements

    // --- Reset Advanced Filters (if implemented) ---
    // [...] Example code for noUiSlider/Select2 reset (keep commented if not used)
    // --- End Advanced Filter Reset ---

    applyFilters(); // Re-apply filters (which should now show all data)
    showStatus('Filters reset.', 'info');
}


function applyFilters() {
    console.log("Applying filters...");
    const productFamily = $('#productFamilyFilter').val();
    const assembly = $('#assemblyFilter').val();

    // --- Get Week Range from Slider (Example - requires week data to be numeric) ---
    let minWeekFilter = -Infinity; // Default to allow all if slider not used/present
    let maxWeekFilter = Infinity;
    // [...] Example code for reading noUiSlider values (keep commented if not used)
    // --- End Week Range Filter ---

    filteredData = allData.filter(item => {
        let keep = true;
        const weekKey = COLUMN_KEYS.week;
        const productFamilyKey = COLUMN_KEYS.productFamily;
        const assemblyKey = COLUMN_KEYS.assembly;

        // Product Family Filter
        if (productFamily && productFamilyKey && item.hasOwnProperty(productFamilyKey)) {
             if (String(item[productFamilyKey] ?? '') !== productFamily) {
                 keep = false;
             }
        }
        // Assembly Filter
        if (keep && assembly && assemblyKey && item.hasOwnProperty(assemblyKey)) {
            if (String(item[assemblyKey] ?? '') !== assembly) {
                keep = false;
            }
        }
        // Week Range Filter
        // if (keep && weekKey && item.hasOwnProperty(weekKey) && item[weekKey] !== null) {
        //     const itemWeek = item[weekKey]; // Assumes week is already cleaned to number or null
        //     if (itemWeek < minWeekFilter || itemWeek > maxWeekFilter) {
        //         keep = false;
        //     }
        // }

        // Add checks for other filters if implemented

        return keep;
    });

    console.log(`Filtering complete. ${filteredData.length} records remaining.`);

    // Re-render components with filtered data
    updateKpiCards(filteredData);
    generateCharts(filteredData);
    showStatus(`${filteredData.length} records displayed after filtering.`, 'info');
    // updateDataTable(filteredData); // Optional: Update a data table if you have one
}

function populateFilterOptions(data) {
    console.log("Populating filter options...");

    const populateSelect = (elementId, dataKey) => {
        const selectElement = $(elementId);
        selectElement.children('option:not(:first)').remove(); // Clear previous options but keep "All"
        selectElement.prop('disabled', true); // Disable while populating

        if (!dataKey) {
             console.warn(`Invalid dataKey provided for ${elementId}.`);
             selectElement.append('<option value="" disabled>Config Error</option>');
             return;
        }

        // Check if the first data row *actually has* this property after cleaning
        if (data.length > 0 && data[0] && data[0].hasOwnProperty(dataKey)) {
            // Use a Set for efficient unique values, filter out null/empty, convert to string for consistency
            const uniqueValues = [...new Set(data.map(item => item[dataKey]) // Use the actual header name as the key
                                            .filter(val => val !== null && val !== undefined && val !== '')
                                            .map(String))]
                                            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })); // Natural sort

            if (uniqueValues.length > 0) {
                uniqueValues.forEach(value => {
                    // HTML encode the value and text to prevent XSS issues if data is user-generated
                    const encodedValue = $('<textarea />').text(value).html();
                    selectElement.append($('<option></option>').attr('value', encodedValue).text(encodedValue));
                });
                selectElement.prop('disabled', false); // Re-enable
                console.log(`Populated ${elementId} with ${uniqueValues.length} options.`);
            } else {
                console.warn(`No unique, non-empty values found for filter key "${dataKey}".`);
                selectElement.append('<option value="" disabled>No data</option>');
                 selectElement.prop('disabled', true); // Keep disabled
            }
        } else {
            console.warn(`Filter key "${dataKey}" not found in cleaned data or data is empty. Skipping population for ${elementId}.`);
            selectElement.append('<option value="" disabled>N/A</option>');
             selectElement.prop('disabled', true); // Keep disabled
        }
        // Optional: Refresh Select2 if used
        // if (selectElement.data('select2')) {
        //     selectElement.trigger('change');
        // }
    };

    populateSelect('#productFamilyFilter', COLUMN_KEYS.productFamily);
    populateSelect('#assemblyFilter', COLUMN_KEYS.assembly);
    // Add calls for other select filters if needed

    // Placeholder for populating/updating advanced filters
    // updateWeekRangeSlider(data); // <-- Correctly Commented Out
}

// --- REMOVED toggleFilterVisibility FUNCTION ---
// This is now handled by Bootstrap Collapse via data-bs-* attributes and the inline script in HTML


/* // Placeholder for Advanced Filter Initialization and Update
// [...] Keep commented out if not using noUiSlider/Select2
*/


// --- KPI Update ---
function updateKpiCards(data) {
    console.log("Updating KPI cards...");
    const tatKey = COLUMN_KEYS.tat;
    let tatValues = [];

    if (!tatKey) {
         console.error("TAT column key is not defined in COLUMN_KEYS.");
         $('#tatAverage, #tatMedian, #tatMin, #tatMax').text('N/A');
         return;
    }

    // Check if the key exists in the first row of data
    if (data.length > 0 && data[0] && data[0].hasOwnProperty(tatKey)) {
        tatValues = data
            .map(item => item[tatKey]) // Access using the actual header name key
            .filter(tat => typeof tat === 'number' && !isNaN(tat) && isFinite(tat)); // Ensure valid numbers
    } else if (data.length > 0) {
         console.warn(`KPI key "${tatKey}" not found in filtered data rows.`);
    } else {
        console.log("No filtered data to calculate KPIs.");
    }


    if (tatValues.length > 0) {
        const sum = tatValues.reduce((a, b) => a + b, 0);
        const avg = sum / tatValues.length;
        const sortedTats = [...tatValues].sort((a, b) => a - b);
        const mid = Math.floor(sortedTats.length / 2);
        const median = sortedTats.length % 2 !== 0 ? sortedTats[mid] : (sortedTats[mid - 1] + sortedTats[mid]) / 2;
        const min = sortedTats[0]; // Already sorted
        const max = sortedTats[sortedTats.length - 1]; // Already sorted

        $('#tatAverage').text(avg.toFixed(2));
        $('#tatMedian').text(median.toFixed(2));
        $('#tatMin').text(min.toFixed(2));
        $('#tatMax').text(max.toFixed(2));
        console.log("KPI cards updated.");
    } else {
        $('#tatAverage, #tatMedian, #tatMin, #tatMax').text('N/A');
         console.log("KPI cards set to N/A (no valid TAT data).");
    }
}

// --- Chart Generation ---
function generateCharts(data) {
    console.log("Generating charts...");

    // Destroy previous chart instances if they exist
    Object.values(chartInstances).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    chartInstances = {}; // Reset the storage

    // Clear previous canvases explicitly
     $('.chart-container canvas').each(function() {
        const ctx = this.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, this.width, this.height);
        }
    });


    if (!data || data.length === 0) {
        console.warn("No data available for charts.");
        // Show 'No data' message on canvases
        $('.chart-container').each(function() {
             $(this).find('canvas').hide(); // Hide canvas
             if ($(this).find('.no-data-message').length === 0) { // Add message if not present
                $(this).append('<div class="no-data-message text-center text-muted small position-absolute top-50 start-50 translate-middle">No data to display</div>');
             } else {
                 $(this).find('.no-data-message').show(); // Show existing message
             }
        });
        return;
    } else {
        // Ensure 'No data' messages are hidden and canvases shown if data exists
         $('.chart-container').each(function() {
             $(this).find('.no-data-message').hide();
             $(this).find('canvas').show();
        });
    }


    // --- Helper: Count Categories ---
    const countCategories = (data, key, limit = null, sort = 'desc') => {
        // Check if key is valid and exists in the first data row
        if (!key || (data.length > 0 && data[0] && !data[0].hasOwnProperty(key))) {
            console.warn(`Key "${key}" not found in data or key is invalid. Cannot generate counts.`);
            return { labels: [], values: [], originalCounts: {} };
        }
        const counts = data.reduce((acc, item) => {
             // Use nullish coalescing for default value, then convert to string
             // Access data using the key (which is the header name)
            const category = String(item[key] ?? 'Unknown');
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});

        let sortedEntries = Object.entries(counts);
        const originalTotalItems = sortedEntries.length; // Count before potential grouping

        // Sorting logic
        if (sort === 'desc') {
            sortedEntries.sort(([, a], [, b]) => b - a); // Sort descending by count
        } else if (sort === 'asc') {
             sortedEntries.sort(([, a], [, b]) => a - b); // Sort ascending by count
        } else if (sort === 'key' || sort === 'alpha') {
             // Natural sort for keys
             sortedEntries.sort(([a], [b]) => String(a).localeCompare(String(b), undefined, {numeric: true, sensitivity: 'base'}));
        } else if (sort === 'week') {
            // Specific sort for week numbers (assuming key is cleaned to number)
             sortedEntries.sort(([a], [b]) => Number(a) - Number(b));
        }

        // Grouping logic ('Other' category)
        if (limit && limit > 0 && sortedEntries.length > limit) {
            const topEntries = sortedEntries.slice(0, limit -1); // Leave space for 'Other'
            const otherCount = sortedEntries.slice(limit - 1).reduce((sum, [, count]) => sum + count, 0);
            if (otherCount > 0) {
                 const otherLabel = `Other (${sortedEntries.length - (limit - 1)} items)`;
                topEntries.push([otherLabel, otherCount]);
            }
            sortedEntries = topEntries; // Replace with grouped data
        }

        return {
            labels: sortedEntries.map(entry => entry[0]),
            values: sortedEntries.map(entry => entry[1]),
            originalCounts: counts // Return original counts if needed elsewhere
        };
    };

    // --- Chart Color Palettes ---
    const palette1 = ['rgba(54, 162, 235, 0.7)', 'rgba(255, 99, 132, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)', 'rgba(201, 203, 207, 0.7)'];
    const palette2 = ['rgba(255, 159, 64, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(201, 203, 207, 0.7)'];
    const palette3 = ['rgba(153, 102, 255, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 159, 64, 0.7)', 'rgba(201, 203, 207, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(255, 99, 132, 0.7)'];

    const getChartColors = (count, palette) => { const colors = []; for (let i = 0; i < count; i++) { colors.push(palette[i % palette.length]); } return colors; };
    const getChartBorderColors = (colors) => colors.map(color => color.replace('0.7', '1'));


    // --- Chart Implementations ---

    // 1. Weekly Trend (Bar)
    try {
        const weeklyCtx = document.getElementById('weeklyTrendChart')?.getContext('2d');
        const weekKey = COLUMN_KEYS.week;
        if (weeklyCtx && weekKey) {
            const { labels: weeklyLabels, values: weeklyValues } = countCategories(data, weekKey, null, 'week');
             if (weeklyLabels.length > 0) {
                const colors = getChartColors(weeklyLabels.length, palette1);
                chartInstances.weeklyTrend = new Chart(weeklyCtx, { type: 'bar', data: { labels: weeklyLabels, datasets: [{ label: 'Defect Count', data: weeklyValues, backgroundColor: colors[0], borderColor: getChartBorderColors([colors[0]])[0], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Defect Count' } }, x: { title: { display: true, text: 'Week' } } }, plugins: { legend: { display: false }, tooltip: {callbacks: { title: (ctx) => `Week ${ctx[0].label}` }} } } });
            } else { console.warn(`Weekly chart: No valid data found for key "${weekKey}".`);}
        }
    } catch (error) { console.error("Error creating Weekly Trend chart:", error); }

    // 2. Product Family (Horizontal Bar)
    try {
        const productCtx = document.getElementById('productFamilyChart')?.getContext('2d');
        const productKey = COLUMN_KEYS.productFamily;
        if (productCtx && productKey) {
            const { labels: productLabels, values: productValues } = countCategories(data, productKey, MAX_BAR_ITEMS);
             if (productLabels.length > 0) {
                const colors = getChartColors(productLabels.length, palette2);
                chartInstances.productFamily = new Chart(productCtx, { type: 'bar', data: { labels: productLabels, datasets: [{ label: 'Defect Count', data: productValues, backgroundColor: colors, borderColor: getChartBorderColors(colors), borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, title: { display: true, text: 'Defect Count' } } }, plugins: { legend: { display: false } } } });
            } else { console.warn(`Product Family chart: No valid data found for key "${productKey}".`);}
        }
    } catch (error) { console.error("Error creating Product Family chart:", error); }

    // 3. Assembly Wise (Bar, Highlight Top 5)
    try {
        const assemblyCtx = document.getElementById('assemblyChart')?.getContext('2d');
         const assemblyKey = COLUMN_KEYS.assembly;
        if (assemblyCtx && assemblyKey) {
            const { labels: assemblyLabels, values: assemblyValues } = countCategories(data, assemblyKey, MAX_BAR_ITEMS);
             if (assemblyLabels.length > 0) {
                const highlightColor = 'rgba(255, 99, 132, 0.7)'; const defaultColor = 'rgba(201, 203, 207, 0.7)';
                const backgroundColors = assemblyValues.map((_, index) => index < 5 ? highlightColor : defaultColor); const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));
                chartInstances.assembly = new Chart(assemblyCtx, { type: 'bar', data: { labels: assemblyLabels, datasets: [{ label: 'Defect Count', data: assemblyValues, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Defect Count' } } }, plugins: { legend: { display: false } } } });
            } else { console.warn(`Assembly Wise chart: No valid data found for key "${assemblyKey}".`);}
        }
    } catch (error) { console.error("Error creating Assembly Wise chart:", error); }

    // 4. Detection Stage (Vertical Bar)
    try {
        const detectionCtx = document.getElementById('detectionStageChart')?.getContext('2d');
         const detectionKey = COLUMN_KEYS.detectionStage;
        if (detectionCtx && detectionKey) {
             const { labels: detectionLabels, values: detectionValues } = countCategories(data, detectionKey, null, 'alpha');
              if (detectionLabels.length > 0) {
                const colors = getChartColors(detectionLabels.length, palette3);
                chartInstances.detectionStage = new Chart(detectionCtx, { type: 'bar', data: { labels: detectionLabels, datasets: [{ label: 'Defect Count', data: detectionValues, backgroundColor: colors, borderColor: getChartBorderColors(colors), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Defect Count' } } }, plugins: { legend: { display: false } } } });
            } else { console.warn(`Detection Stage chart: No valid data found for key "${detectionKey}".`);}
        }
    } catch (error) { console.error("Error creating Detection Stage chart:", error); }

    // 5. Problem Observed (Bar)
    try {
        const observedCtx = document.getElementById('problemObservedChart')?.getContext('2d');
         const observedKey = COLUMN_KEYS.problemObserved;
        if (observedCtx && observedKey) {
            const { labels: observedLabels, values: observedValues } = countCategories(data, observedKey, MAX_BAR_ITEMS);
              if (observedLabels.length > 0) {
                 const colors = getChartColors(observedLabels.length, palette1);
                 chartInstances.problemObserved = new Chart(observedCtx, { type: 'bar', data: { labels: observedLabels, datasets: [{ label: 'Frequency', data: observedValues, backgroundColor: colors, borderColor: getChartBorderColors(colors), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Frequency' } } }, plugins: { legend: { display: false } } } });
            } else { console.warn(`Problem Observed chart: No valid data found for key "${observedKey}".`);}
        }
    } catch (error) { console.error("Error creating Problem Observed chart:", error); }

    // 6. Functionality (Doughnut)
    try {
        const funcCtx = document.getElementById('functionalityChart')?.getContext('2d');
         const funcKey = COLUMN_KEYS.functionality;
        if (funcCtx && funcKey) {
            const { labels: funcLabels, values: funcValues } = countCategories(data, funcKey, MAX_PIE_ITEMS);
             if (funcLabels.length > 0) {
                const colors = getChartColors(funcLabels.length, palette2);
                chartInstances.functionality = new Chart(funcCtx, { type: 'doughnut', data: { labels: funcLabels, datasets: [{ label: 'Count', data: funcValues, backgroundColor: colors, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
            } else { console.warn(`Functionality chart: No valid data found for key "${funcKey}".`);}
        }
    } catch (error) { console.error("Error creating Functionality chart:", error); }

    // 7. Responsible Parties (Doughnut)
    try {
        const respCtx = document.getElementById('responsibleChart')?.getContext('2d');
        const respKey = COLUMN_KEYS.responsible;
        if (respCtx && respKey) {
             const { labels: respLabels, values: respValues } = countCategories(data, respKey, MAX_PIE_ITEMS);
              if (respLabels.length > 0) {
                const colors = getChartColors(respLabels.length, palette3);
                 chartInstances.responsible = new Chart(respCtx, { type: 'doughnut', data: { labels: respLabels, datasets: [{ label: 'Count', data: respValues, backgroundColor: colors, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
            } else { console.warn(`Responsible Parties chart: No valid data found for key "${respKey}".`);}
        }
    } catch (error) { console.error("Error creating Responsible Parties chart:", error); }

    // 8. Problem Analysis / Root Cause (Bar)
    try {
        const analysisCtx = document.getElementById('problemAnalysisChart')?.getContext('2d');
        const analysisKey = COLUMN_KEYS.problemAnalysis;
        if (analysisCtx && analysisKey) {
            const { labels: analysisLabels, values: analysisValues } = countCategories(data, analysisKey, MAX_BAR_ITEMS);
             if (analysisLabels.length > 0) {
                const colors = getChartColors(analysisLabels.length, palette1);
                chartInstances.problemAnalysis = new Chart(analysisCtx, { type: 'bar', data: { labels: analysisLabels, datasets: [{ label: 'Count', data: analysisValues, backgroundColor: colors, borderColor: getChartBorderColors(colors), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Count' } } }, plugins: { legend: { display: false } } } });
            } else { console.warn(`Problem Analysis chart: No valid data found for key "${analysisKey}".`);}
        }
    } catch (error) { console.error("Error creating Problem Analysis chart:", error); }


    // 9. Submitted By (Bar Chart)  <--- START: NEW CHART CODE
    try {
        const submittedByCtx = document.getElementById('submittedByChart')?.getContext('2d'); // Get context by new ID
        const submittedByKey = COLUMN_KEYS.submittedBy; // Get the key from config (actual header name)

        if (submittedByCtx && submittedByKey) {
            // Count categories, limit items, sort descending
            const { labels: submittedByLabels, values: submittedByValues } = countCategories(data, submittedByKey, MAX_BAR_ITEMS, 'desc');

             if (submittedByLabels.length > 0) {
                const colors = getChartColors(submittedByLabels.length, palette3); // Use a palette (e.g., palette3)
                chartInstances.submittedBy = new Chart(submittedByCtx, { // Store instance with a unique key 'submittedBy'
                    type: 'bar',
                    data: {
                        labels: submittedByLabels,
                        datasets: [{
                            label: 'Number of Submissions', // Adjust label if needed
                            data: submittedByValues,
                            backgroundColor: colors,
                            borderColor: getChartBorderColors(colors),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'Submission Count' } },
                            x: { title: { display: false } } // Hide x-axis title if labels are clear names
                        },
                        plugins: {
                            legend: { display: false } // Hide legend if only one dataset
                            // Title handled by card header
                        }
                    }
                });
                console.log(`Generated chart for Submitted By.`);
            } else {
                console.warn(`Submitted By chart: No valid data found for key "${submittedByKey}".`);
                // Handle no data case (message already shown by general check)
            }
        } else if (submittedByCtx && !submittedByKey) {
            console.error(`Submitted By chart: Key 'submittedBy' (header: ${COLUMN_KEYS.submittedBy}) is not defined/found.`);
        }
    } catch (error) { console.error("Error creating Submitted By chart:", error); }
    // <--- END: NEW CHART CODE


    console.log("Chart generation complete.");
} // End of generateCharts


// --- Theme Toggle ---
function initializeTheme() {
    let preferredTheme = localStorage.getItem('theme');
    if (!preferredTheme) { preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    setTheme(preferredTheme);
}
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}
function setTheme(theme) {
    const themeIcon = $('#themeToggleBtn i');
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        themeIcon.removeClass('bi-moon-stars-fill').addClass('bi-sun-fill');
        localStorage.setItem('theme', 'dark');
        Chart.defaults.color = '#adb5bd'; Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.2)';
    } else {
        document.documentElement.setAttribute('data-bs-theme', 'light');
        themeIcon.removeClass('bi-sun-fill').addClass('bi-moon-stars-fill');
        localStorage.setItem('theme', 'light');
        Chart.defaults.color = '#666'; Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.1)';
    }
    if (filteredData && filteredData.length > 0) { console.log("Regenerating charts for theme change..."); generateCharts(filteredData); }
    console.log(`Theme set to ${theme}`);
}

// --- Export Functions ---
async function downloadDashboardAsPdf() {
    showStatus('Generating PDF... Please wait.', 'info');
    console.log("Starting PDF generation...");

    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') { console.error("jsPDF library is not loaded correctly!"); showStatus('Error: jsPDF library not loaded. Cannot generate PDF.', 'danger'); return; }
    const { jsPDF } = window.jspdf;
    if (Object.keys(chartInstances).length === 0 && filteredData.length === 0) { showStatus('No data or charts available to generate PDF.', 'warning'); return; }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 40; const pageHeight = doc.internal.pageSize.getHeight(); const contentWidth = doc.internal.pageSize.getWidth() - 2 * margin; let currentY = margin;
    const sectionSpacing = 30; const chartSpacing = 20; const chartRowBaseHeight = 200;
    const titleFontSize = 18; const headingFontSize = 14; const textFontSize = 10;

    const addText = (text, fontSize, x, y, options = {}) => { if (y > pageHeight - margin) { doc.addPage(); y = margin; } doc.setFontSize(fontSize); doc.text(text, x, y, options); return y + (fontSize * 1.2); };
    const addChartToPdf = async (chartId, chartTitle, xPos, yPos, width, height) => {
        const chartInstance = chartInstances[chartId]; const chartCanvas = document.getElementById(chartId);
        if (chartInstance && chartCanvas && $(chartCanvas).is(':visible')) {
            try {
                 if (yPos > pageHeight - margin - height) { doc.addPage(); yPos = margin; }
                 let titleY = addText(chartTitle, textFontSize + 1, xPos, yPos); // Add title
                 await new Promise(resolve => setTimeout(resolve, 150));
                 const imgData = chartInstance.toBase64Image('image/png', 1.0);
                 doc.addImage(imgData, 'PNG', xPos, titleY, width, height); // Add image below title
                 console.log(`Added chart ${chartId} ('${chartTitle}') to PDF.`);
                 return titleY + height + chartSpacing; // Return Y after chart + spacing
            } catch (error) { console.error(`Error adding chart ${chartId} to PDF:`, error); if (yPos > pageHeight - margin - 20) { doc.addPage(); yPos = margin; } doc.setFontSize(8); doc.setTextColor(255,0,0); doc.text(`Error rendering chart: ${chartTitle}`, xPos, yPos); doc.setTextColor(0,0,0); return yPos + 20; }
        } else { console.log(`Skipping chart ${chartId} ('${chartTitle}') for PDF (not found, not visible, or no instance).`); if (yPos > pageHeight - margin - 20) { doc.addPage(); yPos = margin; } doc.setFontSize(8); doc.setTextColor(150,150,150); doc.text(`[Chart: ${chartTitle} - No data or not rendered]`, xPos, yPos); doc.setTextColor(0,0,0); return yPos + 20; }
    };

    // --- PDF Content Generation ---
    currentY = addText('Production Quality Dashboard Report', titleFontSize, margin, currentY); currentY += sectionSpacing / 2;
    try { // Filter Summary
        let filterSummary = "Filters Applied: "; let filtersApplied = [];
        const productFamilyVal = $('#productFamilyFilter').val(); const productFamilyText = productFamilyVal ? $('#productFamilyFilter option:selected').text() : '';
        const assemblyVal = $('#assemblyFilter').val(); const assemblyText = assemblyVal ? $('#assemblyFilter option:selected').text() : '';
        if (productFamilyVal && productFamilyText) filtersApplied.push(`Family: ${productFamilyText}`);
        if (assemblyVal && assemblyText) filtersApplied.push(`Assembly: ${assemblyText}`);
        // Add Week Range if slider implemented
        // [...]
        filterSummary += filtersApplied.length > 0 ? filtersApplied.join('; ') : "None";
        currentY = addText(filterSummary, textFontSize - 1, margin, currentY); currentY += sectionSpacing;
    } catch (e) { console.error("Error generating filter summary:", e); }
    // KPIs
    currentY = addText('TAT Statistics:', headingFontSize, margin, currentY); currentY += 5;
    const kpiText = `Average: ${$('#tatAverage').text()}  |  Median: ${$('#tatMedian').text()}  |  Min: ${$('#tatMin').text()}  |  Max: ${$('#tatMax').text()}`;
    currentY = addText(kpiText, textFontSize, margin, currentY); currentY += sectionSpacing;

    // Chart Rows Layout
    const rowWidth1_1 = contentWidth * 0.65; const rowWidth1_2 = contentWidth * 0.30; const rowX2_1 = margin + rowWidth1_1 + (contentWidth * 0.05);
    const rowWidth2_1 = contentWidth * 0.65; const rowWidth2_2 = contentWidth * 0.30; const rowX2_2 = margin + rowWidth2_1 + (contentWidth * 0.05);
    const rowWidth3_1 = contentWidth * 0.65; const rowWidth3_2 = contentWidth * 0.30; const rowX2_3 = margin + rowWidth3_1 + (contentWidth * 0.05);
    const rowWidth4_1 = contentWidth * 0.30; const rowWidth4_2 = contentWidth * 0.65; const rowX2_4 = margin + rowWidth4_1 + (contentWidth * 0.05);

    // Add Charts
    let yAfterR1C1 = await addChartToPdf('weeklyTrendChart', 'Weekly Defect Trend', margin, currentY, rowWidth1_1, chartRowBaseHeight);
    let yAfterR1C2 = await addChartToPdf('productFamilyChart', 'Defects by Product Family', rowX2_1, currentY, rowWidth1_2, chartRowBaseHeight);
    currentY = Math.max(yAfterR1C1, yAfterR1C2);
    let yAfterR2C1 = await addChartToPdf('assemblyChart', 'Assembly Wise Defects', margin, currentY, rowWidth2_1, chartRowBaseHeight);
    let yAfterR2C2 = await addChartToPdf('detectionStageChart', 'Defects by Detection Stage', rowX2_2, currentY, rowWidth2_2, chartRowBaseHeight);
    currentY = Math.max(yAfterR2C1, yAfterR2C2);
    let yAfterR3C1 = await addChartToPdf('problemObservedChart', 'Problem Observed Frequency', margin, currentY, rowWidth3_1, chartRowBaseHeight);
    let yAfterR3C2 = await addChartToPdf('functionalityChart', 'Issue Functionality', rowX2_3, currentY, rowWidth3_2, chartRowBaseHeight);
    currentY = Math.max(yAfterR3C1, yAfterR3C2);
    let yAfterR4C1 = await addChartToPdf('responsibleChart', 'Responsible Parties', margin, currentY, rowWidth4_1, chartRowBaseHeight);
    let yAfterR4C2 = await addChartToPdf('problemAnalysisChart', 'Problem Analysis (Root Cause)', rowX2_4, currentY, rowWidth4_2, chartRowBaseHeight);
    currentY = Math.max(yAfterR4C1, yAfterR4C2);

    // Add Row 5: Submitted By Chart <-- START: ADD PDF EXPORT FOR NEW CHART
    currentY = await addChartToPdf('submittedByChart', 'Submissions by User', margin, currentY, contentWidth, chartRowBaseHeight);
    // <-- END: ADD PDF EXPORT FOR NEW CHART

    // --- Save PDF ---
    try { doc.save('production_dashboard_report.pdf'); console.log("PDF Saved."); showStatus('PDF generated successfully.', 'success');
    } catch (error) { console.error("Error saving PDF:", error); showStatus('Error saving PDF.', 'danger'); }
}


function downloadDataAsExcel() {
    console.log("Exporting data to Excel...");
    if (typeof XLSX === 'undefined') { console.error("XLSX library is not loaded!"); showStatus('Error: XLSX library not loaded. Cannot export Excel.', 'danger'); return; }
    if (!filteredData || filteredData.length === 0) { showStatus('No filtered data available to export.', 'warning'); return; }
    showStatus('Generating Excel file...', 'info');
    try {
        const worksheet = XLSX.utils.json_to_sheet(filteredData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtered Dashboard Data');
        const colWidths = []; // Autofit columns
        if (filteredData.length > 0 && filteredData[0]) {
             const headers = Object.keys(filteredData[0]);
             headers.forEach((header, index) => { colWidths[index] = { wch: Math.max(header.length, 10) }; });
             filteredData.slice(0, 100).forEach(row => { headers.forEach((header, index) => { if(index < colWidths.length) { const cellValue = row[header]; const cellLen = cellValue ? String(cellValue).length : 0; if (colWidths[index].wch < cellLen) { colWidths[index].wch = cellLen; } } }); });
             colWidths.forEach(col => { if (col.wch > 60) col.wch = 60; }); worksheet['!cols'] = colWidths;
         }
        const date = new Date(); const timestamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`; const filename = `dashboard_data_${timestamp}.xlsx`;
        XLSX.writeFile(workbook, filename);
        console.log("Excel file generated."); showStatus('Excel file generated successfully.', 'success');
    } catch (error) { console.error("Error generating Excel file:", error); showStatus(`Error generating Excel file: ${error.message}`, 'danger'); }
}

// Helper function for showing status messages
function showStatus(message, type = 'info') {
    const uploadStatusAlert = document.getElementById('uploadStatus');
    if (uploadStatusAlert) {
        uploadStatusAlert.innerHTML = message; // Use innerHTML to allow potential small tags
        uploadStatusAlert.className = 'mb-3 alert'; // Reset classes
        uploadStatusAlert.classList.add(`alert-${type}`);
        uploadStatusAlert.style.display = 'block';
    } else { console.log(`Status (${type}): ${message}`); }
}