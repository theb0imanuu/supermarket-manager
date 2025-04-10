/**
 * Checkout JavaScript
 * Handles the checkout process, cart management, and payment processing
 */

// Checkout state
const CheckoutState = {
    cart: [],
    products: [],
    searchResults: [],
    categories: [],
    currentTransaction: null,
    paymentMethod: 'cash',
    paymentReference: '',
    selectedCategory: 'all'
};

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('checkoutPage')) {
        initializeCheckout();
    }
});

/**
 * Initialize the checkout page
 */
async function initializeCheckout() {
    try {
        // Load products and categories
        await Promise.all([
            loadCheckoutProducts(),
            loadCheckoutCategories()
        ]);
        
        // Set up event listeners
        setupCheckoutEventListeners();
        
        // Initialize cart
        updateCart();
    } catch (error) {
        console.error('Error initializing checkout:', error);
        showToast('Error', 'Failed to initialize checkout', 'error');
    }
}

/**
 * Set up event listeners for checkout page
 */
function setupCheckoutEventListeners() {
    // Product search
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleProductSearch, 300));
    }
    
    // Search form submission (barcode scanner simulation)
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleProductSearch({ target: searchInput });
        });
    }
    
    // Category filter
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            filterProductsByCategory(category);
            
            // Update active state
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Complete sale button
    const completeSaleBtn = document.getElementById('completeSaleBtn');
    if (completeSaleBtn) {
        completeSaleBtn.addEventListener('click', handleCompleteSale);
    }
    
    // Payment form
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmit);
    }
    
    // Payment method selection
    const paymentMethodBtns = document.querySelectorAll('input[name="paymentMethod"]');
    paymentMethodBtns.forEach(btn => {
        btn.addEventListener('change', handlePaymentMethodChange);
    });
}

/**
 * Load products for checkout
 */
async function loadCheckoutProducts() {
    try {
        const response = await apiCall('/checkout/search');
        CheckoutState.products = response.products || [];
        renderProductGrid(CheckoutState.products);
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

/**
 * Load categories for checkout
 */
async function loadCheckoutCategories() {
    try {
        const response = await apiCall('/inventory/categories');
        CheckoutState.categories = response.categories || [];
        
        // Update category filter
        renderCategoryFilter();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

/**
 * Render the category filter
 */
function renderCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;
    
    // Clear current filter except for All
    while (categoryFilter.children.length > 1) {
        categoryFilter.removeChild(categoryFilter.lastChild);
    }
    
    // Add categories
    CheckoutState.categories.forEach(category => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-btn btn btn-outline-secondary';
        button.setAttribute('data-category', category);
        button.textContent = category;
        button.addEventListener('click', function() {
            filterProductsByCategory(category);
            
            // Update active state
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
        
        categoryFilter.appendChild(button);
    });
}

/**
 * Render the product grid
 * @param {Array} products - Products to display
 */
function renderProductGrid(products) {
    const productGridElem = document.getElementById('productGrid');
    if (!productGridElem) return;
    
    // Clear current grid
    productGridElem.innerHTML = '';
    
    // Check if there are products
    if (products.length === 0) {
        productGridElem.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="alert alert-info">
                    No products found. Try another search or category.
                </div>
            </div>
        `;
        return;
    }
    
    // Add products to grid
    products.forEach(product => {
        // Create product card
        const productCard = document.createElement('div');
        productCard.className = 'col-md-3 col-sm-4 col-6 mb-3';
        
        // Determine stock status
        let stockStatus = '';
        if (product.stock_quantity <= 0) {
            stockStatus = '<span class="badge bg-danger">Out of Stock</span>';
        } else if (product.stock_quantity <= 10) {
            stockStatus = `<span class="badge bg-warning text-dark">Low: ${product.stock_quantity}</span>`;
        } else {
            stockStatus = `<span class="badge bg-success">In Stock: ${product.stock_quantity}</span>`;
        }
        
        productCard.innerHTML = `
            <div class="card h-100 product-card ${product.stock_quantity <= 0 ? 'out-of-stock' : ''}">
                <div class="card-body text-center">
                    <h6 class="card-title mb-1">${product.name}</h6>
                    <p class="card-text text-muted small mb-1">${product.category}</p>
                    <p class="card-text mb-1">${formatCurrency(product.price)}</p>
                    <p class="card-text small mb-2">${stockStatus}</p>
                    <button class="btn btn-sm ${product.stock_quantity > 0 ? 'btn-primary' : 'btn-secondary'} add-to-cart-btn" 
                        data-id="${product.id}" 
                        ${product.stock_quantity <= 0 ? 'disabled' : ''}>
                        <i class="bi bi-cart-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
        `;
        
        // Add event listener
        const addButton = productCard.querySelector('.add-to-cart-btn');
        if (addButton && product.stock_quantity > 0) {
            addButton.addEventListener('click', () => {
                addToCart(product);
            });
        }
        
        productGridElem.appendChild(productCard);
    });
}

/**
 * Add a product to the cart
 * @param {Object} product - Product to add
 * @param {number} quantity - Quantity to add (default: 1)
 */
function addToCart(product, quantity = 1) {
    // Check if product is already in cart
    const existingItem = CheckoutState.cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
        // Check if we have enough stock
        if (product.stock_quantity < existingItem.quantity + quantity) {
            showToast('Warning', `Only ${product.stock_quantity} units available`, 'warning');
            return;
        }
        
        // Update quantity
        existingItem.quantity += quantity;
        existingItem.total = existingItem.quantity * existingItem.price;
    } else {
        // Check if we have enough stock
        if (product.stock_quantity < quantity) {
            showToast('Warning', `Only ${product.stock_quantity} units available`, 'warning');
            return;
        }
        
        // Add new item
        CheckoutState.cart.push({
            product_id: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity,
            total: product.price * quantity,
            stock_available: product.stock_quantity
        });
    }
    
    // Update cart UI
    updateCart();
    
    // Show confirmation
    showToast('Added', `${product.name} added to cart`, 'success');
}

/**
 * Update the cart display
 */
function updateCart() {
    const cartItemsElem = document.getElementById('cartItems');
    const cartTotalElem = document.getElementById('cartTotal');
    const cartEmptyElem = document.getElementById('cartEmpty');
    const cartActionsElem = document.getElementById('cartActions');
    const itemCountElem = document.getElementById('itemCount');
    
    if (!cartItemsElem || !cartTotalElem) return;
    
    // Clear current items
    cartItemsElem.innerHTML = '';
    
    // Check if cart is empty
    if (CheckoutState.cart.length === 0) {
        if (cartEmptyElem) cartEmptyElem.style.display = 'block';
        if (cartActionsElem) cartActionsElem.style.display = 'none';
        if (itemCountElem) itemCountElem.textContent = '0';
        cartTotalElem.textContent = formatCurrency(0);
        return;
    }
    
    // Show cart actions and hide empty message
    if (cartEmptyElem) cartEmptyElem.style.display = 'none';
    if (cartActionsElem) cartActionsElem.style.display = 'block';
    
    // Calculate total
    let total = 0;
    let itemCount = 0;
    
    // Add items to cart
    CheckoutState.cart.forEach((item, index) => {
        total += item.total;
        itemCount += item.quantity;
        
        const itemRow = document.createElement('tr');
        itemRow.innerHTML = `
            <td class="text-truncate" style="max-width: 150px;" title="${item.name}">${item.name}</td>
            <td>
                <div class="input-group input-group-sm">
                    <button class="btn btn-outline-secondary decrease-qty" data-index="${index}">-</button>
                    <input type="number" class="form-control text-center item-qty" value="${item.quantity}" min="1" max="${item.stock_available}" data-index="${index}">
                    <button class="btn btn-outline-secondary increase-qty" data-index="${index}">+</button>
                </div>
            </td>
            <td class="text-end">${formatCurrency(item.price)}</td>
            <td class="text-end">${formatCurrency(item.total)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger remove-item" data-index="${index}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        // Add event listeners
        const decreaseBtn = itemRow.querySelector('.decrease-qty');
        const increaseBtn = itemRow.querySelector('.increase-qty');
        const qtyInput = itemRow.querySelector('.item-qty');
        const removeBtn = itemRow.querySelector('.remove-item');
        
        decreaseBtn.addEventListener('click', () => {
            updateCartItemQuantity(index, item.quantity - 1);
        });
        
        increaseBtn.addEventListener('click', () => {
            updateCartItemQuantity(index, item.quantity + 1);
        });
        
        qtyInput.addEventListener('change', (e) => {
            const newQty = parseInt(e.target.value);
            if (newQty > 0 && newQty <= item.stock_available) {
                updateCartItemQuantity(index, newQty);
            } else {
                e.target.value = item.quantity;
                if (newQty > item.stock_available) {
                    showToast('Warning', `Only ${item.stock_available} units available`, 'warning');
                }
            }
        });
        
        removeBtn.addEventListener('click', () => {
            removeCartItem(index);
        });
        
        cartItemsElem.appendChild(itemRow);
    });
    
    // Update total and item count
    cartTotalElem.textContent = formatCurrency(total);
    if (itemCountElem) itemCountElem.textContent = itemCount.toString();
}

/**
 * Update a cart item's quantity
 * @param {number} index - Item index in cart
 * @param {number} quantity - New quantity
 */
function updateCartItemQuantity(index, quantity) {
    const item = CheckoutState.cart[index];
    if (!item) return;
    
    // Validate quantity
    if (quantity <= 0) {
        removeCartItem(index);
        return;
    }
    
    if (quantity > item.stock_available) {
        showToast('Warning', `Only ${item.stock_available} units available`, 'warning');
        return;
    }
    
    // Update quantity and total
    item.quantity = quantity;
    item.total = item.price * quantity;
    
    // Update cart UI
    updateCart();
}

/**
 * Remove an item from the cart
 * @param {number} index - Item index in cart
 */
function removeCartItem(index) {
    CheckoutState.cart.splice(index, 1);
    updateCart();
}

/**
 * Clear the cart
 */
function clearCart() {
    CheckoutState.cart = [];
    updateCart();
}

/**
 * Handle product search
 */
async function handleProductSearch(event) {
    const searchTerm = event.target.value.trim();
    
    if (searchTerm.length === 0) {
        // If search is cleared, show all products
        renderProductGrid(CheckoutState.products);
        return;
    }
    
    if (searchTerm.length < 2) {
        // Wait for more characters
        return;
    }
    
    try {
        // Search products
        const response = await apiCall(`/checkout/search?q=${encodeURIComponent(searchTerm)}`);
        CheckoutState.searchResults = response.products || [];
        
        // Apply category filter if active
        let filteredResults = CheckoutState.searchResults;
        if (CheckoutState.selectedCategory !== 'all') {
            filteredResults = filteredResults.filter(p => p.category === CheckoutState.selectedCategory);
        }
        
        renderProductGrid(filteredResults);
    } catch (error) {
        console.error('Error searching products:', error);
    }
}

/**
 * Filter products by category
 * @param {string} category - Category to filter by
 */
function filterProductsByCategory(category) {
    CheckoutState.selectedCategory = category;
    
    let productsToFilter = CheckoutState.searchResults.length > 0 
        ? CheckoutState.searchResults 
        : CheckoutState.products;
    
    if (category === 'all') {
        renderProductGrid(productsToFilter);
        return;
    }
    
    // Filter products
    const filteredProducts = productsToFilter.filter(p => p.category === category);
    renderProductGrid(filteredProducts);
}

/**
 * Handle complete sale button click
 */
function handleCompleteSale() {
    if (CheckoutState.cart.length === 0) {
        showToast('Error', 'Cannot complete sale with empty cart', 'error');
        return;
    }
    
    // Show payment modal
    const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    
    // Calculate total
    const total = CheckoutState.cart.reduce((sum, item) => sum + item.total, 0);
    document.getElementById('paymentTotal').textContent = formatCurrency(total);
    
    // Reset payment form
    document.getElementById('paymentForm').reset();
    document.getElementById('cashAmount').value = total.toFixed(2);
    document.getElementById('changeAmount').textContent = formatCurrency(0);
    
    // Select cash payment by default
    document.querySelector('input[name="paymentMethod"][value="cash"]').checked = true;
    handlePaymentMethodChange({ target: { value: 'cash' } });
    
    paymentModal.show();
}

/**
 * Handle payment method change
 */
function handlePaymentMethodChange(event) {
    const method = event.target ? event.target.value : event;
    CheckoutState.paymentMethod = method;
    
    // Show/hide relevant payment details
    const cashDetails = document.getElementById('cashPaymentDetails');
    const cardDetails = document.getElementById('cardPaymentDetails');
    const mpesaDetails = document.getElementById('mpesaPaymentDetails');
    
    cashDetails.style.display = method === 'cash' ? 'block' : 'none';
    cardDetails.style.display = method === 'card' ? 'block' : 'none';
    mpesaDetails.style.display = method === 'mpesa' ? 'block' : 'none';
    
    // Setup cash amount input listener
    if (method === 'cash') {
        const cashInput = document.getElementById('cashAmount');
        const changeOutput = document.getElementById('changeAmount');
        const total = CheckoutState.cart.reduce((sum, item) => sum + item.total, 0);
        
        cashInput.addEventListener('input', function() {
            const cashAmount = parseFloat(this.value) || 0;
            const change = cashAmount - total;
            changeOutput.textContent = formatCurrency(Math.max(0, change));
        });
    }
}

/**
 * Handle payment form submission
 */
async function handlePaymentSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(event.target);
    const paymentMethod = formData.get('paymentMethod');
    
    let paymentReference = '';
    
    // Get payment reference based on method
    if (paymentMethod === 'card') {
        const cardType = formData.get('cardType');
        const lastFour = formData.get('cardNumber').slice(-4);
        paymentReference = `${cardType}-${lastFour}`;
    } else if (paymentMethod === 'mpesa') {
        paymentReference = formData.get('mpesaReference');
    } else {
        // For cash, use the cash amount
        const cashAmount = formData.get('cashAmount');
        paymentReference = `Cash: ${cashAmount}`;
    }
    
    // Prepare transaction data
    const total = CheckoutState.cart.reduce((sum, item) => sum + item.total, 0);
    const transactionData = {
        items: CheckoutState.cart.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.total
        })),
        total_amount: total,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        cashier_name: AppState.cashierName
    };
    
    try {
        // Create transaction
        const response = await apiCall('/checkout/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transactionData)
        });
        
        // Store transaction in state
        CheckoutState.currentTransaction = response.transaction;
        
        // Close modal
        const paymentModal = bootstrap.Modal.getInstance(document.getElementById('paymentModal'));
        paymentModal.hide();
        
        // Show success message and ask about receipt
        Swal.fire({
            title: 'Sale Completed!',
            html: `
                <p>Transaction #${response.transaction.reference_number} has been processed successfully.</p>
                <p>Total: ${formatCurrency(response.transaction.total_amount)}</p>
                <p>Payment Method: ${response.transaction.payment_method.toUpperCase()}</p>
            `,
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'Print Receipt',
            cancelButtonText: 'Continue',
        }).then((result) => {
            if (result.isConfirmed) {
                // Print receipt
                printReceipt(response.transaction);
            }
            
            // Clear cart
            clearCart();
        });
    } catch (error) {
        console.error('Error processing transaction:', error);
        Swal.fire({
            title: 'Error',
            text: 'Failed to process transaction. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

/**
 * Debounce function for search input
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}
