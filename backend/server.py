from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from minio import Minio
from minio.error import S3Error
import os
import re
from datetime import timedelta
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction
import nltk
from dotenv import load_dotenv

load_dotenv()

try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

app = Flask(__name__)
CORS(app)

genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

minio_client = Minio(
    f"{os.getenv('MINIO_ENDPOINT')}:{os.getenv('MINIO_PORT')}",
    access_key=os.getenv('MINIO_ACCESS_KEY'),
    secret_key=os.getenv('MINIO_SECRET_KEY'),
    secure=False
)

bucket_name = os.getenv('MINIO_BUCKET')

try:
    if not minio_client.bucket_exists(bucket_name):
        minio_client.make_bucket(bucket_name)
        print(f'Bucket "{bucket_name}" created')
    else:
        print(f'Bucket "{bucket_name}" already exists')
except S3Error as e:
    print(f'Error with bucket: {e}')

def generate_cpp_code(query):
    """Generate C++ code using Gemini"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"Generate C++ code for the following request: {query}. Provide only the code in a code block."
        
        response = model.generate_content(prompt)
        text = response.text

        cpp_match = re.search(r'```cpp\s*(.*?)\s*```', text, re.DOTALL)
        if cpp_match:
            return cpp_match.group(1).strip()
        
        generic_match = re.search(r'```\s*(.*?)\s*```', text, re.DOTALL)
        if generic_match:
            return generic_match.group(1).strip()
        
        return text.strip()
    
    except Exception as e:
        raise Exception(f'Error generating code: {str(e)}')

def calculate_bleu_score(reference, candidate):
    """Calculate BLEU score between reference and candidate"""
    try:
        reference_tokens = reference.split()
        candidate_tokens = candidate.split()
        smoothing = SmoothingFunction().method1
        score = sentence_bleu([reference_tokens], candidate_tokens, smoothing_function=smoothing)
        
        return score
    except Exception as e:
        print(f'Error calculating BLEU score: {e}')
        return None

@app.route('/generate-code', methods=['POST'])
def generate_code():
    try:
        data = request.json
        query = data.get('query')
        reference = data.get('reference')
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        code = generate_cpp_code(query)

        import time
        filename = f'generated_{int(time.time() * 1000)}.cpp'
        
        temp_path = os.path.join(os.path.dirname(__file__), filename)
        with open(temp_path, 'w') as f:
            f.write(code)
        
        try:
            minio_client.fput_object(
                bucket_name,
                filename,
                temp_path,
                content_type='text/plain'
            )
            
            os.remove(temp_path)
            
            presigned_url = minio_client.presigned_get_object(
                bucket_name,
                filename,
                expires=timedelta(days=1)
            )
            
            bleu_score = None
            if reference:
                bleu_score = calculate_bleu_score(reference, code)
            
            return jsonify({
                'fileUrl': presigned_url,
                'code': code,
                'bleuScore': bleu_score
            })
        
        except S3Error as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({'error': f'Failed to upload file: {str(e)}'}), 500
    
    except Exception as e:
        print(f'Error: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Server is running'})

if __name__ == '__main__':
    PORT = int(os.getenv('PORT', 5000))
    print(f'Server running on port {PORT}')
    app.run(host='0.0.0.0', port=PORT, debug=True)