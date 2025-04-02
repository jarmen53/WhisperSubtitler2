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
                alert('Please select a file to upload.');
                return;
            }
            
            // Validate file size (max 512MB)
            const maxSize = 512 * 1024 * 1024; // 512MB
            if (fileInput.files[0].size > maxSize) {
                event.preventDefault();
                alert('File is too large. Maximum file size is 512MB.');
                return;
            }
            
            // Validate file type
            const fileName = fileInput.files[0].name;
            const fileExt = fileName.split('.').pop().toLowerCase();
            const allowedTypes = ['mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv', 'flac', 'ogg', 'm4a'];
            
            if (!allowedTypes.includes(fileExt)) {
                event.preventDefault();
                alert('Invalid file type. Allowed types: ' + allowedTypes.join(', '));
                return;
            }
            
            // Show processing modal
            processingModal.show();
            
            // Disable submit button to prevent multiple submissions
            submitBtn.disabled = true;
        });
    }
    
    // File input change handler - show filename
    const fileInput = document.getElementById('file');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (fileInput.files && fileInput.files.length > 0) {
                const fileName = fileInput.files[0].name;
                
                // Optional: Display the selected filename
                const fileLabel = fileInput.nextElementSibling;
                if (fileLabel && fileLabel.classList.contains('form-file-label')) {
                    fileLabel.textContent = fileName;
                }
            }
        });
    }
    
    // Tooltips initialization
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});
