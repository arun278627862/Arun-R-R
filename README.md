# Tabular Data Analyzer

A Flask web application for analyzing tabular data with interactive visualizations.

## Features

- Upload CSV/Excel files with tabular data
- Interactive data table with sorting and searching capabilities
- Filter data by date range, product family, problem category, reason, shift, and line
- Visualize data with various charts:
  - Bar chart of problem categories vs frequency
  - Pie chart of repair types
  - Line chart for TAT (Turn Around Time) over time
  - Count of issues by Shift or Line
- Display TAT statistics (average, median, min, max)

## Data Structure

The application is designed to work with tabular data containing the following columns:

- Request Id
- Secure Week
- In Date
- In Time
- Shift
- Product Family
- Job No
- Product Code
- Product Serial No
- Assembly No
- CCA No
- Problem Detection Stage
- Submitted By
- Line
- Problem Observed
- Location
- Closure
- MU Serial
- Stage
- Remarks(IFR Request)
- Action Id
- Inspected By
- Out Date
- Out Time
- Part No
- UID No
- Problem Analysis
- Remarks(IFR Inspection)
- Functionality
- Problem Category
- Reason
- Repair
- Responsible
- Component Change
- Reference Designator
- IFR Result
- Traceability
- Closed By
- Close Date
- Close Time
- TAT
- Status

## Installation

1. Clone this repository or download the source code
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

1. Start the Flask application:

```bash
python app.py
```

2. Open your web browser and navigate to http://localhost:5000
3. Upload a CSV or Excel file containing the tabular data
4. Use the filters and interactive charts to analyze the data

## Technologies Used

- Backend: Flask, Pandas
- Frontend: Bootstrap 5, jQuery, DataTables
- Visualization: Plotly.js

## Project Structure

```
.
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── static/               
│   ├── css/              
│   │   └── style.css     # Custom CSS styles
│   └── js/               
│       └── main.js       # JavaScript for client-side functionality
├── templates/            
│   └── index.html        # Main HTML template
└── uploads/              # Directory for uploaded files (created automatically)
```

## License

MIT