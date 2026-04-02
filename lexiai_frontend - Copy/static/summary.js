// File type validation
function validateFileType(input) {
    const fileInput = input;
    const filePath = fileInput.value;
    const allowedExtensions = /(\.|\/)(pdf|docx?|txt)$/i;
    const errorElement = document.getElementById('fileError');
    const submitButton = document.querySelector('.generate-btn');
    const fileNameElement = fileInput.parentElement.querySelector('.file-name');
    
    if (!filePath) {
        errorElement.textContent = '';
        fileNameElement.textContent = 'No file chosen';
        submitButton.disabled = false;
        return;
    }
    
    if (!allowedExtensions.exec(filePath)) {
        errorElement.textContent = 'Invalid file format. Please upload a PDF, DOCX, or TXT document only.';
        fileInput.value = '';
        fileNameElement.textContent = 'No file chosen';
        submitButton.disabled = true;
        return false;
    } else {
        errorElement.textContent = '';
        // Display the file name
        const fileName = filePath.split('\\').pop();
        fileNameElement.textContent = fileName;
        submitButton.disabled = false;
        return true;
    }
}

// Form submission handling
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('summaryForm');
    const submitButton = form.querySelector('button[type="submit"]');
    
    form.addEventListener('submit', function(e) {
        const fileInput = document.getElementById('document');
        const filePath = fileInput.value;
        const allowedExtensions = /(\.|\/)(pdf|docx?|txt)$/i;
        
        if (filePath && !allowedExtensions.exec(filePath)) {
            e.preventDefault();
            document.getElementById('fileError').textContent = 
                'Invalid file format. Please upload a PDF, DOCX, or TXT document only.';
            return false;
        }
        
        // Show loading state
        submitButton.classList.add('loading');
        submitButton.disabled = true;
    });
    
    // Drag and drop functionality
    const dropArea = document.querySelector('.file-input-placeholder');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        const fileInput = document.getElementById('document');
        
        if (file) {
            const fileNameElement = dropArea.querySelector('.file-name');
            const allowedExtensions = /(\.|\/)(pdf|docx?|txt)$/i;
            
            if (!allowedExtensions.exec(file.name)) {
                document.getElementById('fileError').textContent = 
                    'Invalid file format. Please upload a PDF, DOCX, or TXT document only.';
                return;
            }
            
            // Create a new FileList to set on the input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            
            // Update UI
            fileNameElement.textContent = file.name;
            document.getElementById('fileError').textContent = '';
            submitButton.disabled = false;
        }
    }
});
