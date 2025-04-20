document.addEventListener('DOMContentLoaded', function() {
    // Process form submission with Gofile and API task creation
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('file');
            const languageSelect = document.getElementById('language');
            const modelSelect = document.getElementById('model');
            const formatSelect = document.getElementById('format');
            const submitBtn = document.getElementById('submitBtn');
            
            // Validate file
            if (!fileInput.files || fileInput.files.length === 0) {
                showFeedback('Please select a file', 'danger');
                return;
            }
            
            const file = fileInput.files[0];
            const allowedExtensions = ['mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv', 'flac', 'ogg', 'm4a'];
            const extension = file.name.split('.').pop().toLowerCase();
            
            if (!allowedExtensions.includes(extension)) {
                showFeedback(`File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`, 'danger');
                return;
            }
            
            // Show processing dialog
            const processingModal = new bootstrap.Modal(document.getElementById('processingModal'));
            processingModal.show();
            
            // Update modal status
            const updateModalStatus = (message) => {
                const statusElement = document.getElementById('processingStatus');
                if (statusElement) {
                    statusElement.textContent = message;
                }
            };
            
            try {
                // 1. Get Gofile server
                updateModalStatus('Getting upload server...');
                const serverResponse = await fetch('/api/gofile/server');
                const serverData = await serverResponse.json();
                
                if (serverData.status !== 'success') {
                    throw new Error('Failed to get Gofile server');
                }
                
                const server = serverData.server;
                
                // 2. Upload file to Gofile
                updateModalStatus('Uploading file to temporary storage...');
                
                const formData = new FormData();
                formData.append('file', file);
                
                const uploadResponse = await fetch(`https://${server}.gofile.io/uploadFile`, {
                    method: 'POST',
                    body: formData
                });
                
                const uploadData = await uploadResponse.json();
                
                if (uploadData.status !== 'ok') {
                    throw new Error('Failed to upload file to Gofile');
                }
                
                // 3. Create task for subtitle generation
                updateModalStatus('Starting subtitle generation task...');
                
                const taskData = {
                    gofile_id: uploadData.data.fileId,
                    gofile_link: uploadData.data.downloadPage,
                    filename: file.name,
                    language: languageSelect.value,
                    model: modelSelect.value,
                    format: formatSelect.value
                };
                
                const taskResponse = await fetch('/api/task', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(taskData)
                });
                
                const taskResult = await taskResponse.json();
                
                if (taskResult.status !== 'success') {
                    throw new Error(taskResult.message || 'Failed to create task');
                }
                
                // 4. Redirect to task status page
                window.location.href = `/task/${taskResult.task_id}`;
                
            } catch (error) {
                console.error('Error:', error);
                processingModal.hide();
                showFeedback(error.message || 'An error occurred during processing', 'danger');
            }
        });
    }
    
    // Task status checking
    const taskStatusContainer = document.getElementById('taskStatus');
    if (taskStatusContainer) {
        const taskId = taskStatusContainer.dataset.taskId;
        
        const checkTaskStatus = async () => {
            try {
                const response = await fetch(`/api/task/${taskId}`);
                const data = await response.json();
                
                if (data.status !== 'success') {
                    throw new Error(data.message || 'Failed to get task status');
                }
                
                const task = data.task;
                
                // Update UI based on task status
                updateTaskUI(task);
                
                // If task is still in progress, check again after a delay
                if (task.status === 'pending' || task.celery_status === 'STARTED' || 
                    task.celery_status === 'PROCESSING' || task.celery_status === 'UPLOADING') {
                    setTimeout(checkTaskStatus, 5000);
                }
                
            } catch (error) {
                console.error('Error checking task status:', error);
                document.getElementById('statusMessage').textContent = 'Error checking task status';
            }
        };
        
        const updateTaskUI = (task) => {
            const statusElement = document.getElementById('statusMessage');
            const progressElement = document.getElementById('progressPercentage');
            const resultLinkContainer = document.getElementById('resultLinkContainer');
            const resultLink = document.getElementById('resultLink');
            const detailedStatus = document.getElementById('taskDetailedStatus');
            
            // Update task information
            document.getElementById('taskFilename').textContent = task.original_filename || 'Unknown';
            document.getElementById('taskLanguage').textContent = task.language === 'auto' ? 'Auto-detect' : task.language;
            document.getElementById('taskModel').textContent = capitalizeFirstLetter(task.model || 'base');
            document.getElementById('taskFormat').textContent = (task.format_type || 'srt').toUpperCase();
            
            // Reset all stages
            resetStages();
            
            // Update status message and UI based on status
            if (task.status === 'completed') {
                statusElement.textContent = 'Subtitles generated successfully!';
                statusElement.className = 'text-success';
                
                // Complete all stages
                completeStage('upload');
                completeStage('download');
                completeStage('processing');
                completeStage('completion');
                
                // Show detailed status
                detailedStatus.className = 'alert alert-success';
                detailedStatus.innerHTML = `
                    <i class="fas fa-check-circle me-2"></i>
                    Subtitles have been successfully generated and are ready for download.
                    ${task.message ? `<p class="mb-0 mt-2 small">${task.message}</p>` : ''}
                `;
                
                // Show result link
                if (resultLinkContainer && resultLink && task.subtitle_gofile_link) {
                    resultLink.href = task.subtitle_gofile_link;
                    resultLinkContainer.classList.remove('d-none');
                }
                
                // Update progress
                if (progressElement) {
                    progressElement.className = 'progress-bar bg-success';
                    progressElement.style.width = '100%';
                    progressElement.setAttribute('aria-valuenow', 100);
                }
                
            } else if (task.status === 'failed') {
                statusElement.textContent = `Error: ${task.message || 'Task failed'}`;
                statusElement.className = 'text-danger';
                
                // Mark stage as failed based on celery status
                completeStage('upload');
                
                if (task.celery_status === 'STARTED') {
                    failStage('download');
                } else if (task.celery_status === 'PROCESSING') {
                    completeStage('download');
                    failStage('processing');
                } else if (task.celery_status === 'UPLOADING') {
                    completeStage('download');
                    completeStage('processing');
                    failStage('completion');
                } else {
                    failStage('download');
                }
                
                // Show detailed status
                detailedStatus.className = 'alert alert-danger';
                detailedStatus.innerHTML = `
                    <i class="fas fa-exclamation-circle me-2"></i>
                    ${task.message || 'Task failed due to an error.'}
                    <p class="mb-0 mt-2 small">Please try again or contact support if the problem persists.</p>
                `;
                
                // Update progress to show error
                if (progressElement) {
                    progressElement.style.width = '100%';
                    progressElement.classList.remove('bg-primary', 'bg-success');
                    progressElement.classList.add('bg-danger');
                }
                
            } else {
                // Task in progress
                let progressMessage = 'Processing...';
                let progressPercent = 30;
                let detailedMessage = 'Your subtitle generation task is being processed...';
                
                // Complete initial stage
                completeStage('upload');
                
                if (task.celery_status === 'PENDING') {
                    progressMessage = 'Waiting in queue...';
                    progressPercent = 10;
                    detailedMessage = 'Your task is in the queue and will be processed shortly.';
                    activateStage('download');
                } else if (task.celery_status === 'STARTED') {
                    progressMessage = 'Downloading file...';
                    progressPercent = 25;
                    detailedMessage = 'Downloading your media file for processing...';
                    activateStage('download');
                } else if (task.celery_status === 'PROCESSING') {
                    progressMessage = 'Generating subtitles...';
                    progressPercent = 60;
                    detailedMessage = `Transcribing audio using the ${task.model || 'base'} model...`;
                    completeStage('download');
                    activateStage('processing');
                } else if (task.celery_status === 'UPLOADING') {
                    progressMessage = 'Uploading subtitle file...';
                    progressPercent = 85;
                    detailedMessage = 'Finalizing and uploading your subtitle file...';
                    completeStage('download');
                    completeStage('processing');
                    activateStage('completion');
                }
                
                // Use progress info if available
                if (task.progress) {
                    progressMessage = task.progress;
                }
                
                statusElement.textContent = progressMessage;
                
                // Update detailed status
                detailedStatus.className = 'alert alert-primary';
                detailedStatus.innerHTML = `
                    <i class="fas fa-info-circle me-2"></i>
                    ${detailedMessage}
                `;
                
                // Update progress bar
                if (progressElement) {
                    progressElement.style.width = `${progressPercent}%`;
                    progressElement.setAttribute('aria-valuenow', progressPercent);
                }
            }
        };
        
        // Helper functions for stage updates
        function resetStages() {
            document.querySelectorAll('.task-stage').forEach(stage => {
                stage.classList.remove('active', 'completed', 'failed');
            });
        }
        
        function activateStage(stageId) {
            const stage = document.getElementById(`stage-${stageId}`);
            if (stage) {
                stage.classList.add('active');
            }
        }
        
        function completeStage(stageId) {
            const stage = document.getElementById(`stage-${stageId}`);
            if (stage) {
                stage.classList.remove('active', 'failed');
                stage.classList.add('completed');
            }
        }
        
        function failStage(stageId) {
            const stage = document.getElementById(`stage-${stageId}`);
            if (stage) {
                stage.classList.remove('active', 'completed');
                stage.classList.add('failed');
            }
        }
        
        function capitalizeFirstLetter(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        }
        
        // Start checking status
        checkTaskStatus();
    }
    
    // Tasks list page
    const tasksListContainer = document.getElementById('tasksList');
    if (tasksListContainer) {
        const loadTasks = async () => {
            try {
                const response = await fetch('/api/my-tasks');
                const data = await response.json();
                
                if (data.status !== 'success') {
                    throw new Error(data.message || 'Failed to load tasks');
                }
                
                renderTasksList(data.tasks);
                
            } catch (error) {
                console.error('Error loading tasks:', error);
                tasksListContainer.innerHTML = `
                    <div class="alert alert-danger">
                        Failed to load tasks: ${error.message || 'Unknown error'}
                    </div>
                `;
            }
        };
        
        const renderTasksList = (tasks) => {
            if (!tasks || tasks.length === 0) {
                tasksListContainer.innerHTML = `
                    <div class="alert alert-info">
                        No subtitle generation tasks found.
                    </div>
                `;
                return;
            }
            
            let html = `
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>File</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            for (const task of tasks) {
                const statusClass = task.status === 'completed' ? 'text-success' : 
                                    task.status === 'failed' ? 'text-danger' : 'text-warning';
                                    
                html += `
                    <tr>
                        <td>${task.original_filename}</td>
                        <td><span class="${statusClass}">${task.status}</span></td>
                        <td>${task.created_at}</td>
                        <td>
                            <a href="/task/${task.task_id}" class="btn btn-sm btn-primary">
                                <i class="fas fa-eye"></i> View
                            </a>
                            ${task.status === 'completed' ? `
                                <a href="${task.subtitle_gofile_link}" target="_blank" class="btn btn-sm btn-success">
                                    <i class="fas fa-download"></i> Download
                                </a>
                            ` : ''}
                        </td>
                    </tr>
                `;
            }
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            tasksListContainer.innerHTML = html;
        };
        
        // Load tasks
        loadTasks();
    }
});

// Utility functions
function showFeedback(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('main.container');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alertDiv);
            bsAlert.close();
        }, 5000);
    }
}

function addInvalidFeedback(inputElement, message) {
    inputElement.classList.add('is-invalid');
    
    // Check if feedback element already exists
    let feedbackElement = inputElement.nextElementSibling;
    if (!feedbackElement || !feedbackElement.classList.contains('invalid-feedback')) {
        feedbackElement = document.createElement('div');
        feedbackElement.className = 'invalid-feedback';
        inputElement.parentNode.insertBefore(feedbackElement, inputElement.nextSibling);
    }
    
    feedbackElement.textContent = message;
}

function removeInvalidFeedback(inputElement) {
    inputElement.classList.remove('is-invalid');
    
    // Remove any existing feedback
    const feedbackElement = inputElement.nextElementSibling;
    if (feedbackElement && feedbackElement.classList.contains('invalid-feedback')) {
        feedbackElement.textContent = '';
    }
}