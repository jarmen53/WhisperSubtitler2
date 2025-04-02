document.addEventListener('DOMContentLoaded', function() {
    // Form submission handling
    const uploadForm = document.getElementById('uploadForm');
    const submitBtn = document.getElementById('submitBtn');
    const processingModal = new bootstrap.Modal(document.getElementById('processingModal'), {
        keyboard: false,
        backdrop: 'static'
    });
    
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(event) {
            // Validate file input
            const fileInput = document.getElementById('file');
            if (!fileInput.files || fileInput.files.length === 0) {
                event.preventDefault();
                
                // Create and show alert instead of using the alert() function
                showFeedback('Please select a file to upload.', 'danger');
                
                // Add invalid feedback to the file input
                fileInput.classList.add('is-invalid');
                addInvalidFeedback(fileInput, 'Please select a file to upload.');
                
                return;
            }
            
            // Validate file size (max 512MB)
            const maxSize = 512 * 1024 * 1024; // 512MB
            if (fileInput.files[0].size > maxSize) {
                event.preventDefault();
                
                // Create and show alert
                showFeedback('File is too large. Maximum file size is 512MB.', 'danger');
                
                // Add invalid feedback to the file input
                fileInput.classList.add('is-invalid');
                addInvalidFeedback(fileInput, 'File is too large. Maximum file size is 512MB.');
                
                return;
            }
            
            // Validate file type
            const fileName = fileInput.files[0].name;
            const fileExt = fileName.split('.').pop().toLowerCase();
            const allowedTypes = ['mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv', 'flac', 'ogg', 'm4a'];
            
            if (!allowedTypes.includes(fileExt)) {
                event.preventDefault();
                
                // Create and show alert
                showFeedback('Invalid file type. Allowed types: ' + allowedTypes.join(', '), 'danger');
                
                // Add invalid feedback to the file input
                fileInput.classList.add('is-invalid');
                addInvalidFeedback(fileInput, 'Invalid file type. Allowed types: ' + allowedTypes.join(', '));
                
                return;
            }
            
            // Show processing modal
            processingModal.show();
            
            // Disable submit button to prevent multiple submissions
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Processing...';
        });
    }
    
    // File input change handler - show filename and validate
    const fileInput = document.getElementById('file');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            // Reset validation classes
            fileInput.classList.remove('is-invalid', 'is-valid');
            removeInvalidFeedback(fileInput);
            
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const fileName = file.name;
                const fileExt = fileName.split('.').pop().toLowerCase();
                const allowedTypes = ['mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv', 'flac', 'ogg', 'm4a'];
                
                // Validate file type
                if (!allowedTypes.includes(fileExt)) {
                    fileInput.classList.add('is-invalid');
                    addInvalidFeedback(fileInput, 'Invalid file type. Allowed types: ' + allowedTypes.join(', '));
                    return;
                }
                
                // Validate file size
                const maxSize = 512 * 1024 * 1024; // 512MB
                if (file.size > maxSize) {
                    fileInput.classList.add('is-invalid');
                    addInvalidFeedback(fileInput, 'File is too large. Maximum file size is 512MB.');
                    return;
                }
                
                // File is valid
                fileInput.classList.add('is-valid');
                
                // Optional: Display the selected filename
                const fileLabel = fileInput.nextElementSibling;
                if (fileLabel && fileLabel.classList.contains('form-file-label')) {
                    fileLabel.textContent = fileName;
                }
            }
        });
    }
    
    // Add card hover effects
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        if (!card.classList.contains('hero-card')) {
            card.addEventListener('mouseenter', function() {
                this.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
                this.style.transform = 'translateY(-5px)';
                this.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.2)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
        }
    });
    
    // Add animation to feature icons
    const featureIcons = document.querySelectorAll('.feature-icon');
    featureIcons.forEach(icon => {
        icon.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.transition = 'transform 0.3s ease';
        });
        
        icon.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
    
    // Tooltips initialization
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    alerts.forEach(alert => {
        setTimeout(() => {
            // Check if the alert still exists in the DOM
            if (document.body.contains(alert)) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    });
    
    // Helper function to create and display feedback messages
    function showFeedback(message, type) {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.role = 'alert';
        
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Find the upload form to insert the alert before it
        const targetElement = document.querySelector('.card-body');
        if (targetElement) {
            targetElement.insertBefore(alertDiv, targetElement.firstChild);
            
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                if (document.body.contains(alertDiv)) {
                    const bsAlert = new bootstrap.Alert(alertDiv);
                    bsAlert.close();
                }
            }, 5000);
        }
    }
    
    // Helper function to add invalid feedback to an input
    function addInvalidFeedback(inputElement, message) {
        // Remove any existing feedback
        removeInvalidFeedback(inputElement);
        
        // Create feedback element
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'invalid-feedback';
        feedbackDiv.innerText = message;
        
        // Insert after the input
        inputElement.parentNode.appendChild(feedbackDiv);
    }
    
    // Helper function to remove invalid feedback
    function removeInvalidFeedback(inputElement) {
        // Find any existing feedback
        const existingFeedback = inputElement.parentNode.querySelector('.invalid-feedback');
        if (existingFeedback) {
            existingFeedback.remove();
        }
    }
});
