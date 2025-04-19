import os
from celery import Celery
import requests
import logging
import whisper_subtitler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery('whisper_subtitler',
                    broker=os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
                    backend=os.environ.get('REDIS_URL', 'redis://localhost:6379/0'))

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour time limit for tasks
)

# Gofile API functions
def get_gofile_server():
    """Get the best server for uploading to Gofile."""
    try:
        response = requests.get('https://api.gofile.io/getServer')
        data = response.json()
        if data['status'] == 'ok':
            return data['data']['server']
        else:
            logger.error(f"Failed to get Gofile server: {data}")
            return None
    except Exception as e:
        logger.error(f"Error getting Gofile server: {str(e)}")
        return None

def upload_to_gofile(file_path, file_name=None):
    """Upload a file to Gofile and return the download link."""
    server = get_gofile_server()
    if not server:
        return None

    try:
        if not file_name:
            file_name = os.path.basename(file_path)
        
        with open(file_path, 'rb') as f:
            files = {'file': (file_name, f)}
            response = requests.post(
                f'https://{server}.gofile.io/uploadFile',
                files=files
            )
        
        data = response.json()
        if data['status'] == 'ok':
            return {
                'download_link': data['data']['downloadPage'],
                'direct_link': data['data']['downloadLink'],
                'file_id': data['data']['fileId'],
                'file_name': file_name
            }
        else:
            logger.error(f"Failed to upload to Gofile: {data}")
            return None
    except Exception as e:
        logger.error(f"Error uploading to Gofile: {str(e)}")
        return None

def download_from_gofile(file_id, output_path):
    """Download a file from Gofile using the file ID."""
    try:
        # Get content info
        content_response = requests.get(f'https://api.gofile.io/getContent?contentId={file_id}')
        content_data = content_response.json()
        
        if content_data['status'] != 'ok':
            logger.error(f"Failed to get content info from Gofile: {content_data}")
            return None
        
        # Get the download link
        file_data = list(content_data['data']['contents'].values())[0]
        direct_link = file_data.get('directLink')
        
        if not direct_link:
            logger.error("No direct link found in Gofile response")
            return None
        
        # Download the file
        download_response = requests.get(direct_link, stream=True)
        with open(output_path, 'wb') as f:
            for chunk in download_response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        return output_path
    except Exception as e:
        logger.error(f"Error downloading from Gofile: {str(e)}")
        return None

# Celery tasks
@celery_app.task(bind=True)
def process_subtitle_task(self, gofile_id, language, model, format_type):
    """
    Process subtitle generation as a background task.
    
    Args:
        gofile_id: The Gofile ID of the uploaded video/audio file
        language: The language code or 'auto' for auto-detection
        model: The Whisper model size to use ('tiny', 'base', 'small', 'medium', 'large')
        format_type: The output format ('srt', 'vtt', 'txt')
        
    Returns:
        dict: Results including task status and gofile links
    """
    try:
        # Update task state to STARTED
        self.update_state(state='STARTED', meta={
            'status': 'Downloading file from Gofile'
        })
        
        # Create temporary directory for processing
        import tempfile
        temp_dir = tempfile.mkdtemp(prefix='whisper_subtitler_')
        input_file = os.path.join(temp_dir, f'input_{gofile_id}')
        
        # Download the file from Gofile
        if not download_from_gofile(gofile_id, input_file):
            return {'status': 'error', 'message': 'Failed to download file from Gofile'}
        
        # Update task state to PROCESSING
        self.update_state(state='PROCESSING', meta={
            'status': 'Generating subtitles'
        })
        
        # Process the file to generate subtitles
        try:
            result_path = whisper_subtitler.process_file(
                input_file,
                language=language,
                model=model,
                format_type=format_type
            )
        except Exception as e:
            logger.error(f"Error processing file: {str(e)}")
            return {'status': 'error', 'message': f'Error during subtitle generation: {str(e)}'}
        
        # Update task state to UPLOADING
        self.update_state(state='UPLOADING', meta={
            'status': 'Uploading subtitle file to Gofile'
        })
        
        # Upload the subtitle file to Gofile
        subtitle_filename = f"subtitles_{os.path.basename(input_file)}.{format_type}"
        gofile_result = upload_to_gofile(result_path, subtitle_filename)
        
        if not gofile_result:
            return {'status': 'error', 'message': 'Failed to upload subtitle file to Gofile'}
        
        # Clean up temporary files
        try:
            os.remove(input_file)
            os.remove(result_path)
            os.rmdir(temp_dir)
        except Exception as e:
            logger.warning(f"Error cleaning up temporary files: {str(e)}")
        
        # Return success result
        return {
            'status': 'completed',
            'message': 'Subtitles generated successfully',
            'subtitle_download_link': gofile_result['download_link'],
            'subtitle_direct_link': gofile_result['direct_link'],
            'subtitle_file_id': gofile_result['file_id'],
            'subtitle_file_name': gofile_result['file_name']
        }
        
    except Exception as e:
        logger.error(f"Task error: {str(e)}")
        return {'status': 'error', 'message': f'Task error: {str(e)}'}