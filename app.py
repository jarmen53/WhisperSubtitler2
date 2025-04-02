import os
import logging
import tempfile
import uuid
from flask import Flask, render_template, request, redirect, url_for, flash, session, send_file
from werkzeug.utils import secure_filename
import whisper_subtitler

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default_secret_key")

# Configure upload settings
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv', 'flac', 'ogg', 'm4a'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 512 * 1024 * 1024  # 512MB max upload size

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        flash('No file part', 'danger')
        return redirect(request.url)
    
    file = request.files['file']
    if file.filename == '':
        flash('No file selected', 'danger')
        return redirect(request.url)
    
    if file and allowed_file(file.filename):
        # Generate a unique filename to prevent collisions
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        file.save(filepath)
        logger.debug(f"File saved at {filepath}")
        
        # Get form parameters
        language = request.form.get('language', 'auto')
        model = request.form.get('model', 'base')
        format_type = request.form.get('format', 'srt')
        
        try:
            # Process the file with WhisperSubtitler
            result_path = whisper_subtitler.process_file(
                filepath, 
                language=language,
                model=model,
                format_type=format_type
            )
            
            # Store result information in session for download
            session['result_path'] = result_path
            session['original_filename'] = original_filename.rsplit('.', 1)[0]
            session['format_type'] = format_type
            
            flash('File processed successfully!', 'success')
            return redirect(url_for('results'))
            
        except Exception as e:
            logger.error(f"Error processing file: {str(e)}")
            flash(f"Error processing file: {str(e)}", 'danger')
            return redirect(url_for('index'))
    else:
        flash(f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}', 'danger')
        return redirect(url_for('index'))

@app.route('/results')
def results():
    result_path = session.get('result_path')
    if not result_path or not os.path.exists(result_path):
        flash('No results found or results expired', 'warning')
        return redirect(url_for('index'))
    
    # Read the first few lines of the subtitle file to preview
    try:
        with open(result_path, 'r', encoding='utf-8') as f:
            preview_content = ''.join(f.readlines()[:20])  # First 20 lines
    except Exception as e:
        logger.error(f"Error reading subtitle file: {str(e)}")
        preview_content = "Error reading subtitle content"
    
    return render_template('results.html', 
                          preview_content=preview_content,
                          original_filename=session.get('original_filename', 'subtitle'),
                          format_type=session.get('format_type', 'srt'))

@app.route('/download')
def download_result():
    result_path = session.get('result_path')
    if not result_path or not os.path.exists(result_path):
        flash('Results not found or expired', 'danger')
        return redirect(url_for('index'))
    
    original_filename = session.get('original_filename', 'subtitle')
    format_type = session.get('format_type', 'srt')
    download_name = f"{original_filename}.{format_type}"
    
    return send_file(result_path, 
                     as_attachment=True,
                     download_name=download_name)

@app.route('/clear')
def clear_session():
    # Clear any temporary files
    if 'result_path' in session and os.path.exists(session['result_path']):
        try:
            os.remove(session['result_path'])
        except Exception as e:
            logger.error(f"Error removing temporary file: {str(e)}")
    
    # Clear session data
    session.clear()
    return redirect(url_for('index'))

@app.errorhandler(413)
def request_entity_too_large(error):
    flash('File too large. Maximum size is 512MB.', 'danger')
    return redirect(url_for('index')), 413

@app.errorhandler(500)
def server_error(error):
    flash('Server error occurred. Please try again later.', 'danger')
    return redirect(url_for('index')), 500
