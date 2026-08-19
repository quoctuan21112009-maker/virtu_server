import os
import requests
from flask import Flask, request, send_from_directory, jsonify, Response
from flask_cors import CORS
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='build')

# CORS
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        "allow_headers": ["*"]
    }
})

# Serve React build
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # Nếu path là API -> proxy
    if path.startswith('api/'):
        return proxy_api(path[4:])  # Bỏ 'api/' prefix
    
    # Nếu file tồn tại trong build folder -> serve
    if path and os.path.exists(os.path.join('build', path)):
        return send_from_directory('build', path)
    
    # Còn lại serve index.html (cho React Router)
    return send_from_directory('build', 'index.html')

# Proxy API
@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
def proxy_api(path):
    try:
        # Lấy server URL từ header hoặc env
        api_server = request.headers.get('X-API-URL') or os.environ.get('API_SERVER_URL', 'http://localhost:5000')
        target_url = f"{api_server}/api/{path}"
        
        # Forward request
        headers = {k: v for k, v in request.headers if k not in ['Host', 'Content-Length']}
        headers.pop('X-API-URL', None)
        
        logger.info(f"🔄 {request.method} {target_url}")
        
        # Gửi request đến server thật
        resp = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=request.get_data(),
            timeout=30
        )
        
        # Trả về response
        return Response(
            resp.content,
            status=resp.status_code,
            headers=dict(resp.headers)
        )
        
    except requests.exceptions.ConnectionError:
        return jsonify({'loi': 'Không thể kết nối đến server API'}), 503
    except Exception as e:
        logger.error(f"Proxy error: {str(e)}")
        return jsonify({'loi': str(e)}), 500

# Health check
@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'service': 'Virtu Proxy',
        'build': os.path.exists('build')
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f"🚀 Server chạy tại: http://localhost:{port}")
    print(f"📁 Serving build folder: {os.path.abspath('build')}")
    app.run(host='0.0.0.0', port=port, debug=False)
