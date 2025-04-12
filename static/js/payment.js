/**
 * Payment Processing JavaScript
 * Handles payment processing UI and logic
 */

// Payment state
const PaymentState = {
    currentMethod: 'cash',
    amount: 0,
    reference: '',
    isProcessing: false,
    mpesaCheckoutRequestId: null,
    mpesaVerificationTimer: null
};

/**
 * Initialize the payment form
 * @param {number} amount - Amount to be paid
 * @param {Function} onSuccess - Callback function on successful payment
 * @param {Function} onCancel - Callback function on canceled payment
 */
function initializePaymentForm(amount, onSuccess, onCancel) {
    PaymentState.amount = amount;
    
    // Fill in amount in the form
    document.getElementById('paymentTotal').textContent = formatCurrency(amount);
    document.getElementById('cashAmount').value = amount.toFixed(2);
    document.getElementById('changeAmount').textContent = formatCurrency(0);
    
    // Reset form
    document.getElementById('paymentForm').reset();
    
    // Select cash payment by default
    document.querySelector('input[name="paymentMethod"][value="cash"]').checked = true;
    togglePaymentMethodDetails('cash');
    
    // Set up event listeners
    setupPaymentEventListeners(onSuccess, onCancel);
}

/**
 * Set up payment event listeners
 * @param {Function} onSuccess - Callback function on successful payment
 * @param {Function} onCancel - Callback function on canceled payment
 */
function setupPaymentEventListeners(onSuccess, onCancel) {
    // Payment method toggle
    const methodInputs = document.querySelectorAll('input[name="paymentMethod"]');
    methodInputs.forEach(input => {
        input.addEventListener('change', function() {
            togglePaymentMethodDetails(this.value);
        });
    });
    
    // Cash amount input
    const cashInput = document.getElementById('cashAmount');
    cashInput.addEventListener('input', function() {
        calculateChange(this.value);
    });
    
    // Cancel payment button
    const cancelBtn = document.getElementById('cancelPaymentBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (typeof onCancel === 'function') {
                onCancel();
            }
        });
    }
    
    // Payment form submission
    const paymentForm = document.getElementById('paymentForm');
    paymentForm.addEventListener('submit', function(e) {
        e.preventDefault();
        processPayment(onSuccess);
    });
    
    // Card number formatting
    const cardInput = document.getElementById('cardNumber');
    if (cardInput) {
        cardInput.addEventListener('input', function() {
            // Format card number with spaces
            let value = this.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
            let formattedValue = '';
            
            for (let i = 0; i < value.length; i++) {
                if (i > 0 && i % 4 === 0) {
                    formattedValue += ' ';
                }
                formattedValue += value[i];
            }
            
            this.value = formattedValue;
        });
    }
    
    // Card expiry date formatting
    const expiryInput = document.getElementById('cardExpiry');
    if (expiryInput) {
        expiryInput.addEventListener('input', function() {
            // Format expiry date as MM/YY
            let value = this.value.replace(/\D/g, '');
            
            if (value.length > 2) {
                this.value = value.substring(0, 2) + '/' + value.substring(2, 4);
            } else {
                this.value = value;
            }
        });
    }
}

/**
 * Toggle payment method details
 * @param {string} method - Payment method (cash, card, mpesa)
 */
function togglePaymentMethodDetails(method) {
    PaymentState.currentMethod = method;
    
    // Show/hide relevant payment details
    document.getElementById('cashPaymentDetails').style.display = method === 'cash' ? 'block' : 'none';
    document.getElementById('cardPaymentDetails').style.display = method === 'card' ? 'block' : 'none';
    document.getElementById('mpesaPaymentDetails').style.display = method === 'mpesa' ? 'block' : 'none';
}

/**
 * Calculate change for cash payment
 * @param {string} amountGiven - Amount given by customer
 */
function calculateChange(amountGiven) {
    const amount = parseFloat(amountGiven) || 0;
    const change = amount - PaymentState.amount;
    
    document.getElementById('changeAmount').textContent = formatCurrency(Math.max(0, change));
}

/**
 * Process payment
 * @param {Function} onSuccess - Callback function on successful payment
 */
function processPayment(onSuccess) {
    if (PaymentState.isProcessing) return;
    
    PaymentState.isProcessing = true;
    const submitBtn = document.getElementById('processPaymentBtn');
    const spinner = document.getElementById('paymentSpinner');
    
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    
    // Get form data
    const formData = new FormData(document.getElementById('paymentForm'));
    const paymentMethod = formData.get('paymentMethod');
    
    // Validate payment data
    let isValid = true;
    let paymentReference = '';
    
    if (paymentMethod === 'cash') {
        const cashAmount = parseFloat(formData.get('cashAmount')) || 0;
        if (cashAmount < PaymentState.amount) {
            showToast('Error', 'Cash amount is less than total amount', 'error');
            isValid = false;
        } else {
            paymentReference = `Cash: ${cashAmount.toFixed(2)}`;
            processStandardPayment(paymentMethod, paymentReference, onSuccess);
        }
    } else if (paymentMethod === 'card') {
        const cardNumber = formData.get('cardNumber');
        const cardExpiry = formData.get('cardExpiry');
        const cardCVV = formData.get('cardCVV');
        const cardType = formData.get('cardType');
        
        if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
            showToast('Error', 'Please enter a valid card number', 'error');
            isValid = false;
        } else if (!cardExpiry || cardExpiry.length < 5) {
            showToast('Error', 'Please enter a valid expiry date', 'error');
            isValid = false;
        } else if (!cardCVV || cardCVV.length < 3) {
            showToast('Error', 'Please enter a valid CVV', 'error');
            isValid = false;
        } else {
            // Create a reference with masked card number
            const lastFour = cardNumber.replace(/\s/g, '').slice(-4);
            paymentReference = `${cardType}-${lastFour}`;
            processStandardPayment(paymentMethod, paymentReference, onSuccess);
        }
    } else if (paymentMethod === 'mpesa') {
        const mpesaPhone = formData.get('mpesaPhone');
        
        if (!mpesaPhone || mpesaPhone.length < 10) {
            showToast('Error', 'Please enter a valid phone number', 'error');
            isValid = false;
        } else {
            // Check if phone format starts with 254
            let formattedPhone = mpesaPhone;
            if (!formattedPhone.startsWith('254')) {
                // Convert format from 07xx to 254xxx
                if (formattedPhone.startsWith('0')) {
                    formattedPhone = '254' + formattedPhone.substring(1);
                } else {
                    formattedPhone = '254' + formattedPhone;
                }
            }
            
            // Generate reference for this transaction
            const reference = 'TX' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            
            // Process M-PESA payment
            processMpesaPayment(formattedPhone, reference, onSuccess);
            return; // Early return as we're handling this asynchronously
        }
    }
    
    // If validation failed, reset processing state
    if (!isValid) {
        resetPaymentProcessingState();
    }
}

/**
 * Process standard payment methods (cash/card)
 * @param {string} method - Payment method
 * @param {string} reference - Payment reference
 * @param {Function} onSuccess - Success callback
 */
function processStandardPayment(method, reference, onSuccess) {
    // Simulate payment processing
    setTimeout(() => {
        resetPaymentProcessingState();
        PaymentState.reference = reference;
        
        // Call success callback
        if (typeof onSuccess === 'function') {
            onSuccess({
                method: method,
                reference: reference,
                amount: PaymentState.amount
            });
        }
    }, 1500); // Simulate processing time
}

/**
 * Process M-PESA payment
 * @param {string} phoneNumber - Customer phone number
 * @param {string} reference - Payment reference
 * @param {Function} onSuccess - Success callback
 */
function processMpesaPayment(phoneNumber, reference, onSuccess) {
    // Update UI to show STK push is being initiated
    const mpesaDetailsContainer = document.getElementById('mpesaPaymentDetails');
    if (mpesaDetailsContainer) {
        mpesaDetailsContainer.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <h5>Initiating M-PESA payment...</h5>
                <p class="text-muted">Sending payment request to ${phoneNumber}</p>
            </div>
        `;
    }
    
    // Make API call to initiate M-PESA STK Push
    apiCall('/mpesa/initiate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone_number: phoneNumber,
            amount: PaymentState.amount,
            reference: reference,
            description: 'Payment for goods at SuperPOS'
        })
    })
    .then(response => {
        if (response.success) {
            // Show success message
            const checkoutRequestId = response.data.checkout_request_id;
            PaymentState.mpesaCheckoutRequestId = checkoutRequestId;
            
            // Update UI to show payment is in progress
            if (mpesaDetailsContainer) {
                if (response.data.simulation) {
                    // If in simulation mode, show success message directly
                    mpesaDetailsContainer.innerHTML = `
                        <div class="alert alert-success">
                            <i class="bi bi-check-circle-fill"></i>
                            <h5 class="alert-heading">Payment Simulation Successful</h5>
                            <p>Your payment has been simulated successfully.</p>
                            <hr>
                            <p class="mb-0">Reference: ${reference}</p>
                        </div>
                    `;
                    
                    // Process success
                    setTimeout(() => {
                        resetPaymentProcessingState();
                        PaymentState.reference = reference;
                        
                        if (typeof onSuccess === 'function') {
                            onSuccess({
                                method: 'mpesa',
                                reference: reference,
                                amount: PaymentState.amount
                            });
                        }
                    }, 1500);
                } else {
                    // Real mode - wait for customer to complete payment on phone
                    mpesaDetailsContainer.innerHTML = `
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle-fill"></i>
                            <h5 class="alert-heading">Payment Request Sent</h5>
                            <p>An M-PESA payment request has been sent to your phone. Please check your phone and:</p>
                            <ol>
                                <li>Enter your M-PESA PIN when prompted</li>
                                <li>Wait for confirmation message</li>
                                <li>The system will automatically proceed when payment is confirmed</li>
                            </ol>
                            <div class="progress mt-3">
                                <div id="mpesaProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                                     role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                        <div id="mpesaVerificationStatus"></div>
                    `;
                    
                    // Start verification process
                    startMpesaVerification(checkoutRequestId, reference, onSuccess);
                }
            }
        } else {
            // Show error message
            if (mpesaDetailsContainer) {
                mpesaDetailsContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle-fill"></i>
                        <h5 class="alert-heading">Payment Failed</h5>
                        <p>${response.message || 'Failed to initiate M-PESA payment. Please try again.'}</p>
                    </div>
                    <button type="button" class="btn btn-primary mt-3" id="retryMpesaBtn">
                        <i class="bi bi-arrow-repeat"></i> Try Again
                    </button>
                `;
                
                // Add retry button handler
                const retryBtn = document.getElementById('retryMpesaBtn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', function() {
                        // Reset M-PESA form
                        resetPaymentProcessingState();
                        togglePaymentMethodDetails('mpesa');
                    });
                }
            }
            resetPaymentProcessingState();
        }
    })
    .catch(error => {
        console.error('Error initiating M-PESA payment:', error);
        if (mpesaDetailsContainer) {
            mpesaDetailsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    <h5 class="alert-heading">System Error</h5>
                    <p>Failed to communicate with the payment server. Please try again later.</p>
                </div>
                <button type="button" class="btn btn-primary mt-3" id="retryMpesaBtn">
                    <i class="bi bi-arrow-repeat"></i> Try Again
                </button>
            `;
            
            // Add retry button handler
            const retryBtn = document.getElementById('retryMpesaBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', function() {
                    // Reset M-PESA form
                    resetPaymentProcessingState();
                    togglePaymentMethodDetails('mpesa');
                });
            }
        }
        resetPaymentProcessingState();
    });
}

/**
 * Start the M-PESA payment verification process
 * @param {string} checkoutRequestId - M-PESA checkout request ID
 * @param {string} reference - Payment reference
 * @param {Function} onSuccess - Success callback
 */
function startMpesaVerification(checkoutRequestId, reference, onSuccess) {
    // Clear any existing timer
    if (PaymentState.mpesaVerificationTimer) {
        clearInterval(PaymentState.mpesaVerificationTimer);
    }
    
    const progressBar = document.getElementById('mpesaProgressBar');
    const statusDiv = document.getElementById('mpesaVerificationStatus');
    let progress = 0;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Update progress bar
    function updateProgress() {
        progress += 10;
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress);
        }
    }
    
    // Set up verification timer
    PaymentState.mpesaVerificationTimer = setInterval(() => {
        attempts++;
        updateProgress();
        
        // After a few seconds, start verifying payment
        if (attempts >= 3) {
            verifyMpesaPayment(checkoutRequestId, reference, onSuccess, statusDiv);
        }
        
        // Stop after max attempts
        if (attempts >= maxAttempts) {
            clearInterval(PaymentState.mpesaVerificationTimer);
            PaymentState.mpesaVerificationTimer = null;
            
            // Show timeout message
            if (statusDiv) {
                statusDiv.innerHTML = `
                    <div class="alert alert-warning mt-3">
                        <i class="bi bi-clock-history"></i>
                        <h5 class="alert-heading">Payment Taking Too Long</h5>
                        <p>We haven't received your payment confirmation yet. You can:</p>
                        <ul>
                            <li>Enter your payment details again if you haven't completed the payment</li>
                            <li>If you've already paid, note the M-PESA confirmation code and enter it below</li>
                        </ul>
                    </div>
                    <div class="input-group mt-3">
                        <input type="text" class="form-control" id="manualMpesaCode" placeholder="Enter M-PESA confirmation code">
                        <button class="btn btn-primary" type="button" id="verifyManualCodeBtn">Verify</button>
                    </div>
                `;
                
                // Add manual verification handler
                const verifyBtn = document.getElementById('verifyManualCodeBtn');
                if (verifyBtn) {
                    verifyBtn.addEventListener('click', function() {
                        const code = document.getElementById('manualMpesaCode').value;
                        if (code && code.length >= 8) {
                            // Process successful payment
                            resetPaymentProcessingState();
                            PaymentState.reference = code;
                            
                            if (typeof onSuccess === 'function') {
                                onSuccess({
                                    method: 'mpesa',
                                    reference: code,
                                    amount: PaymentState.amount
                                });
                            }
                        } else {
                            showToast('Error', 'Please enter a valid M-PESA confirmation code', 'error');
                        }
                    });
                }
            }
            
            resetPaymentProcessingState(true); // Keep form disabled
        }
    }, 3000);
}

/**
 * Verify M-PESA payment status
 * @param {string} checkoutRequestId - M-PESA checkout request ID
 * @param {string} reference - Payment reference
 * @param {Function} onSuccess - Success callback
 * @param {HTMLElement} statusDiv - Status display element
 */
function verifyMpesaPayment(checkoutRequestId, reference, onSuccess, statusDiv) {
    apiCall(`/mpesa/verify/${checkoutRequestId}`)
        .then(response => {
            if (response.success) {
                // Payment successful
                clearInterval(PaymentState.mpesaVerificationTimer);
                PaymentState.mpesaVerificationTimer = null;
                
                if (statusDiv) {
                    statusDiv.innerHTML = `
                        <div class="alert alert-success mt-3">
                            <i class="bi bi-check-circle-fill"></i>
                            <h5 class="alert-heading">Payment Successful</h5>
                            <p>Your M-PESA payment has been confirmed.</p>
                        </div>
                    `;
                }
                
                // Process success
                setTimeout(() => {
                    resetPaymentProcessingState();
                    PaymentState.reference = reference;
                    
                    if (typeof onSuccess === 'function') {
                        onSuccess({
                            method: 'mpesa',
                            reference: reference,
                            amount: PaymentState.amount
                        });
                    }
                }, 1500);
            } else if (response.data && response.data.simulation) {
                // Simulation mode - return success
                clearInterval(PaymentState.mpesaVerificationTimer);
                PaymentState.mpesaVerificationTimer = null;
                
                if (statusDiv) {
                    statusDiv.innerHTML = `
                        <div class="alert alert-success mt-3">
                            <i class="bi bi-check-circle-fill"></i>
                            <h5 class="alert-heading">Payment Simulation Successful</h5>
                            <p>Your M-PESA payment has been simulated successfully.</p>
                        </div>
                    `;
                }
                
                // Process success
                setTimeout(() => {
                    resetPaymentProcessingState();
                    PaymentState.reference = reference;
                    
                    if (typeof onSuccess === 'function') {
                        onSuccess({
                            method: 'mpesa',
                            reference: reference,
                            amount: PaymentState.amount
                        });
                    }
                }, 1500);
            }
            // If payment is still pending, we continue checking with the interval
        })
        .catch(error => {
            console.error('Error verifying M-PESA payment:', error);
            // On error, we continue checking with the interval
        });
}

/**
 * Reset payment processing state
 * @param {boolean} keepDisabled - Whether to keep the form disabled
 */
function resetPaymentProcessingState(keepDisabled = false) {
    PaymentState.isProcessing = keepDisabled;
    const submitBtn = document.getElementById('processPaymentBtn');
    const spinner = document.getElementById('paymentSpinner');
    
    if (submitBtn && !keepDisabled) submitBtn.disabled = false;
    if (spinner) spinner.style.display = 'none';
}

/**
 * Show the payment modal
 * @param {number} amount - Amount to be paid
 * @param {Function} onSuccess - Callback function on successful payment
 * @param {Function} onCancel - Callback function on canceled payment
 */
function showPaymentModal(amount, onSuccess, onCancel) {
    // Initialize payment form
    initializePaymentForm(amount, onSuccess, onCancel);
    
    // Show modal
    const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    paymentModal.show();
    
    // Return modal instance for later reference
    return paymentModal;
}
