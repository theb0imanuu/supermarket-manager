/**
 * Payment Processing JavaScript
 * Handles payment processing UI and logic
 */

// Payment state
const PaymentState = {
    currentMethod: 'cash',
    amount: 0,
    reference: '',
    isProcessing: false
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
        }
    } else if (paymentMethod === 'mpesa') {
        const mpesaPhone = formData.get('mpesaPhone');
        const mpesaReference = formData.get('mpesaReference');
        
        if (!mpesaPhone || mpesaPhone.length < 10) {
            showToast('Error', 'Please enter a valid phone number', 'error');
            isValid = false;
        } else if (!mpesaReference) {
            showToast('Error', 'Please enter a valid M-PESA reference', 'error');
            isValid = false;
        } else {
            paymentReference = mpesaReference;
        }
    }
    
    // If validation failed, reset processing state
    if (!isValid) {
        PaymentState.isProcessing = false;
        if (submitBtn) submitBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        return;
    }
    
    // Simulate payment processing
    setTimeout(() => {
        PaymentState.isProcessing = false;
        PaymentState.reference = paymentReference;
        
        if (submitBtn) submitBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        
        // Call success callback
        if (typeof onSuccess === 'function') {
            onSuccess({
                method: paymentMethod,
                reference: paymentReference,
                amount: PaymentState.amount
            });
        }
    }, 2000); // Simulate 2-second processing time
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
