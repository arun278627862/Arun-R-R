# Simple mock server implementation that doesn't require Flask
import os
import http.server
import socketserver
import json
import io
from email import message_from_bytes
from email.policy import default as default_policy
from urllib.parse import parse_qs, urlparse
# Using email package to parse multipart/form-data as cgi is deprecated

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}

# Create uploads folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Mock data for demonstration
mock_data = {
    'stats': {
        'total_records': 120,
        'product_families': 5,
        'problem_categories': 8,
        'avg_tat': 3.5
    },
    'filters': {
        'product_families': ['Family A', 'Family B', 'Family C', 'Family D', 'Family E'],
        'problem_categories': ['Category 1', 'Category 2', 'Category 3', 'Category 4'],
        'reasons': ['Reason 1', 'Reason 2', 'Reason 3'],
        'shifts': ['Morning', 'Afternoon', 'Night'],
        'lines': ['Line 1', 'Line 2', 'Line 3', 'Line 4']
    },
    'columns': ['ID', 'Product Family', 'Problem Category', 'Reason', 'Shift', 'Line', 'In Date', 'Out Date', 'TAT']
}

# Mock chart data
mock_chart_data = {
    'problem_categories': '{"data":[{"type":"bar","x":["Category 1","Category 2","Category 3","Category 4"],"y":[45,30,25,20]}],"layout":{"title":"Problem Categories Frequency"}}',
    'repair_types': '{"data":[{"type":"pie","labels":["Type A","Type B","Type C"],"values":[50,30,20]}],"layout":{"title":"Repair Types Distribution"}}',
    'tat_over_time': '{"data":[{"type":"line","x":["2023-01-01","2023-01-02","2023-01-03","2023-01-04","2023-01-05"],"y":[3.2,3.5,3.1,3.8,3.4]}],"layout":{"title":"Average TAT Over Time"}}',
    'issues_by_shift': '{"data":[{"type":"bar","x":["Morning","Afternoon","Night"],"y":[45,40,35]}],"layout":{"title":"Issues by Shift"}}',
    'issues_by_line': '{"data":[{"type":"bar","x":["Line 1","Line 2","Line 3","Line 4"],"y":[30,25,35,30]}],"layout":{"title":"Issues by Line"}}',
    'tat_stats': {
        'average': 3.5,
        'median': 3.2,
        'min': 1.5,
        'max': 7.8
    }
}

# Mock table data
mock_table_data = [
    {'ID': '001', 'Product Family': 'Family A', 'Problem Category': 'Category 1', 'Reason': 'Reason 1', 'Shift': 'Morning', 'Line': 'Line 1', 'In Date': '2023-01-01', 'Out Date': '2023-01-03', 'TAT': 2.0},
    {'ID': '002', 'Product Family': 'Family B', 'Problem Category': 'Category 2', 'Reason': 'Reason 2', 'Shift': 'Afternoon', 'Line': 'Line 2', 'In Date': '2023-01-02', 'Out Date': '2023-01-05', 'TAT': 3.0},
    {'ID': '003', 'Product Family': 'Family C', 'Problem Category': 'Category 3', 'Reason': 'Reason 3', 'Shift': 'Night', 'Line': 'Line 3', 'In Date': '2023-01-03', 'Out Date': '2023-01-07', 'TAT': 4.0},
    {'ID': '004', 'Product Family': 'Family D', 'Problem Category': 'Category 4', 'Reason': 'Reason 1', 'Shift': 'Morning', 'Line': 'Line 4', 'In Date': '2023-01-04', 'Out Date': '2023-01-09', 'TAT': 5.0},
    {'ID': '005', 'Product Family': 'Family E', 'Problem Category': 'Category 1', 'Reason': 'Reason 2', 'Shift': 'Afternoon', 'Line': 'Line 1', 'In Date': '2023-01-05', 'Out Date': '2023-01-08', 'TAT': 3.0}
]

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Custom HTTP request handler
class TabularDataAnalyzerHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Serve static files
        if self.path == '/':
            self.path = '/templates/index.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        elif self.path.startswith('/static/'):
            # Remove the /static/ prefix
            self.path = self.path[7:]
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        elif self.path.startswith('/get_data'):
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {'data': mock_table_data}
            self.wfile.write(json.dumps(response).encode())
            return
        elif self.path.startswith('/get_charts'):
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(mock_chart_data).encode())
            return
        else:
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
    
    def do_POST(self):
        print("do_POST method entered") # Added for debugging
        print(f"\n--- POST Request Received ---")
        print(f"Path: {self.path}")
        print(f"Headers:\n{self.headers}")

        if self.path == '/upload':
            content_type = self.headers.get('Content-Type', '')
            print(f"Content-Type: {content_type}")
            if not content_type.startswith('multipart/form-data'):
                print("Error: Invalid Content-Type")
                self.send_error(400, 'Bad Request: Expected multipart/form-data')
                return
            
            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))
            print(f"Content-Length: {content_length}")
            
            # We're not actually processing the file, just simulating a successful upload
            # In a real implementation, we would parse the multipart form data
            # and extract the file
            
            # Parse multipart/form-data
            print("Attempting to parse multipart/form-data...")
            boundary = content_type.split("boundary=")[1].encode()
            # Add boundary dashes for parsing
            full_boundary = b'--' + boundary
            
            # Read the body
            body = self.rfile.read(content_length)
            
            # Create headers for parsing
            headers = f"Content-Type: {content_type}\nContent-Length: {content_length}\n"
            
            try:
                # Combine headers and body for the parser
                # Need to prepend headers because message_from_bytes expects full HTTP message format
                # We also need to ensure the body starts and ends correctly with the boundary
                # Note: This basic parsing might be fragile. A proper library is better for production.
                
                # Construct the message bytes including headers
                message_bytes = headers.encode() + b'\n' + body
                
                # Use io.BytesIO to treat bytes as a file-like object for the parser
                msg = message_from_bytes(message_bytes, policy=default_policy)
                
                file_found = False
                if msg.is_multipart():
                    for part in msg.iter_parts():
                        # Check if this part is the file
                        if part.get_filename():
                            filename = part.get_filename()
                            file_content = part.get_payload(decode=True) # Get raw bytes
                            print(f"Successfully parsed file part: {filename}, size: {len(file_content)} bytes")
                            file_found = True
                            # In a real app, you would save file_content here
                            # and check allowed_file(filename)
                            break # Assuming only one file
                
                if not file_found:
                    print("Error: 'file' part not found in multipart data")
                    self.send_error(400, "Bad Request: 'file' part missing")
                    return

            except Exception as e:
                print(f"Error parsing multipart/form-data: {e}")
                self.send_error(500, 'Internal Server Error: Could not parse request body')
                return

            # If parsing was successful (file part found)
            print("Simulating successful file processing after parsing.")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'success': True,
                'message': 'File uploaded successfully (mock response)',
                'stats': mock_data['stats'],
                'filters': mock_data['filters'],
                'columns': mock_data['columns']
            }
            response_json = json.dumps(response)
            print(f"Sending response: {response_json}")
            self.wfile.write(response_json.encode())
        else:
            print(f"POST request to unhandled path: {self.path}")
            # Handle other POST requests or send error
            self.send_error(404, 'Not Found')

# Run the server
if __name__ == '__main__':
    PORT = 5000
    Handler = TabularDataAnalyzerHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Server stopped.")
            httpd.server_close()