/**
 * Main application JavaScript file
 * Contains shared functionality and utility functions
 */

// Global application state
const AppState = {
    cashierName: 'Demo Cashier',
    isLoading: false,
    toastQueue: [],
    processingToast: false
};

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize Bootstrap popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
    
    // Set cashier name if available in localStorage
    if (localStorage.getItem('cashierName')) {
        AppState.cashierName = localStorage.getItem('cashierName');
        updateCashierName();
    }

    // Add event listener for cashier name form if it exists
    const cashierForm = document.getElementById('cashierNameForm');
    if (cashierForm) {
        cashierForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const nameInput = document.getElementById('cashierNameInput');
            if (nameInput && nameInput.value.trim()) {
                AppState.cashierName = nameInput.value.trim();
                localStorage.setItem('cashierName', AppState.cashierName);
                updateCashierName();
                
                // Close modal if it exists
                const modal = bootstrap.Modal.getInstance(document.getElementById('cashierModal'));
                if (modal) {
                    modal.hide();
                }
                
                showToast('Success', `Cashier name set to ${AppState.cashierName}`, 'success');
            }
        });
    }
});

/**
 * Update the cashier name display in the UI
 */
function updateCashierName() {
    const cashierElements = document.querySelectorAll('.cashier-name');
    cashierElements.forEach(element => {
        element.textContent = AppState.cashierName;
    });
}

/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

/**
 * Format a date as a readable string
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/**
 * Show a toast notification
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 * @param {string} type - Toast type (success, error, warning, info)
 */
function showToast(title, message, type = 'info') {
    // Add toast to queue
    AppState.toastQueue.push({ title, message, type });
    
    // Process queue if not already processing
    if (!AppState.processingToast) {
        processToastQueue();
    }
}

/**
 * Process the toast notification queue
 */
function processToastQueue() {
    if (AppState.toastQueue.length === 0) {
        AppState.processingToast = false;
        return;
    }
    
    AppState.processingToast = true;
    const { title, message, type } = AppState.toastQueue.shift();
    
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastElement = document.createElement('div');
    toastElement.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type}`;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    
    // Create toast content
    toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}</strong>: ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Add toast to container
    toastContainer.appendChild(toastElement);
    
    // Initialize toast
    const toast = new bootstrap.Toast(toastElement, {
        delay: 5000
    });
    
    // Show toast
    toast.show();
    
    // Handle toast hidden event
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
        // Process next toast in queue
        processToastQueue();
    });
}

/**
 * Make an API call with error handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise} API response as JSON
 */
async function apiCall(url, options = {}) {
    try {
        AppState.isLoading = true;
        updateLoadingState();
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showToast('Error', error.message || 'An error occurred', 'error');
        throw error;
    } finally {
        AppState.isLoading = false;
        updateLoadingState();
    }
}

/**
 * Update the loading state UI
 */
function updateLoadingState() {
    const loadingSpinners = document.querySelectorAll('.loading-spinner');
    if (AppState.isLoading) {
        loadingSpinners.forEach(spinner => {
            spinner.style.display = 'inline-block';
        });
    } else {
        loadingSpinners.forEach(spinner => {
            spinner.style.display = 'none';
        });
    }
}

/**
 * Generate a printable receipt
 * @param {object} transaction - Transaction data
 */
function printReceipt(transaction) {
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (!receiptWindow) {
        showToast('Error', 'Please allow pop-ups to print receipts', 'error');
        return;
    }
    
    // Build receipt HTML
    let receiptHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt #${transaction.reference_number}</title>
        <style>
            body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                margin: 0;
                padding: 10px;
                width: 300px;
            }
            .receipt-header {
                text-align: center;
                margin-bottom: 10px;
            }
            .receipt-title {
                font-size: 16px;
                font-weight: bold;
            }
            .receipt-info {
                margin-bottom: 10px;
            }
            .receipt-table {
                width: 100%;
                border-collapse: collapse;
            }
            .receipt-table th {
                text-align: left;
                border-bottom: 1px solid #000;
                padding: 5px 0;
            }
            .receipt-table td {
                padding: 5px 0;
            }
            .receipt-total {
                margin-top: 10px;
                text-align: right;
                font-weight: bold;
            }
            .receipt-footer {
                margin-top: 20px;
                text-align: center;
                font-size: 10px;
            }
            .text-right {
                text-align: right;
            }
            .text-center {
                text-align: center;
            }
            @media print {
                body {
                    width: 100%;
                }
                .no-print {
                    display: none;
                }
            }
        </style>
    </head>
    <body>
        <div class="receipt-header">
            <div class="receipt-title">Super POS System</div>
            <div>123 Main Street</div>
            <div>Anytown, ST 12345</div>
            <div>Tel: (123) 456-7890</div>
        </div>
        
        <div class="receipt-info">
            <div>Receipt #: ${transaction.reference_number}</div>
            <div>Date: ${formatDate(transaction.transaction_date)}</div>
            <div>Cashier: ${transaction.cashier_name}</div>
        </div>
        
        <table class="receipt-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add items to receipt
    transaction.items.forEach(item => {
        receiptHtml += `
            <tr>
                <td>${item.product_name}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${formatCurrency(item.unit_price)}</td>
                <td class="text-right">${formatCurrency(item.total_price)}</td>
            </tr>
        `;
    });
    
    // Add totals and footer
    receiptHtml += `
            </tbody>
        </table>
        
        <div class="receipt-total">
            <div>Total: ${formatCurrency(transaction.total_amount)}</div>
        </div>
        
        <div class="receipt-info">
            <div>Payment Method: ${transaction.payment_method.toUpperCase()}</div>
            ${transaction.payment_reference ? `<div>Payment Reference: ${transaction.payment_reference}</div>` : ''}
        </div>
        
        <div class="receipt-footer">
            <div>Thank you for shopping with us!</div>
            <div>Please come again.</div>
        </div>
        
        <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()">Print Receipt</button>
        </div>
    </body>
    </html>
    `;
    
    // Write to the new window
    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
}

/**
 * Navigate to receipt page
 * @param {number} transactionId - Transaction ID
 */
function viewReceipt(transactionId) {
    window.location.href = `/receipt/${transactionId}`;
}
