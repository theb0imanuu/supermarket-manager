/**
 * Inventory Management JavaScript
 * Handles product and stock management functionality
 */

// Inventory state
const InventoryState = {
    products: [],
    categories: [],
    stockMovements: [],
    selectedProduct: null,
    currentView: 'products', // 'products' or 'stock'
};

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('inventoryPage')) {
        initializeInventory();
    }
});

/**
 * Initialize the inventory page
 */
async function initializeInventory() {
    try {
        // Load products and categories
        await Promise.all([
            loadProducts(),
            loadCategories(),
            loadStockMovements()
        ]);
        
        // Set up event listeners
        setupInventoryEventListeners();
        
        // Show products by default
        showProductsView();
    } catch (error) {
        console.error('Error initializing inventory:', error);
        showToast('Error', 'Failed to initialize inventory', 'error');
    }
}

/**
 * Set up event listeners for inventory page
 */
function setupInventoryEventListeners() {
    // Tab navigation
    document.getElementById('productsTab').addEventListener('click', showProductsView);
    document.getElementById('stockTab').addEventListener('click', showStockView);
    
    // Product form
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', handleProductFormSubmit);
    }
    
    // Stock movement form
    const stockForm = document.getElementById('stockMovementForm');
    if (stockForm) {
        stockForm.addEventListener('submit', handleStockMovementSubmit);
    }
    
    // New product button
    const newProductBtn = document.getElementById('newProductBtn');
    if (newProductBtn) {
        newProductBtn.addEventListener('click', () => {
            resetProductForm();
            const productModal = new bootstrap.Modal(document.getElementById('productModal'));
            productModal.show();
        });
    }
    
    // New stock movement button
    const newStockBtn = document.getElementById('newStockMovementBtn');
    if (newStockBtn) {
        newStockBtn.addEventListener('click', () => {
            resetStockMovementForm();
            const stockModal = new bootstrap.Modal(document.getElementById('stockMovementModal'));
            stockModal.show();
        });
    }
    
    // Search input
    const searchInput = document.getElementById('inventorySearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleInventorySearch);
    }
    
    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleCategoryFilter);
    }
}

/**
 * Show the products view
 */
function showProductsView() {
    InventoryState.currentView = 'products';
    
    // Update active tab
    document.getElementById('productsTab').classList.add('active');
    document.getElementById('stockTab').classList.remove('active');
    
    // Show/hide relevant containers
    document.getElementById('productsContainer').style.display = 'block';
    document.getElementById('stockContainer').style.display = 'none';
    
    // Update buttons
    document.getElementById('newProductBtn').style.display = 'block';
    document.getElementById('newStockMovementBtn').style.display = 'none';
    
    // Refresh product list
    renderProductList();
}

/**
 * Show the stock view
 */
function showStockView() {
    InventoryState.currentView = 'stock';
    
    // Update active tab
    document.getElementById('productsTab').classList.remove('active');
    document.getElementById('stockTab').classList.add('active');
    
    // Show/hide relevant containers
    document.getElementById('productsContainer').style.display = 'none';
    document.getElementById('stockContainer').style.display = 'block';
    
    // Update buttons
    document.getElementById('newProductBtn').style.display = 'none';
    document.getElementById('newStockMovementBtn').style.display = 'block';
    
    // Refresh stock movement list
    renderStockMovements();
}

/**
 * Load products from API
 */
async function loadProducts() {
    try {
        const response = await apiCall('/inventory/products');
        InventoryState.products = response.products || [];
        renderProductList();
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

/**
 * Load categories from API
 */
async function loadCategories() {
    try {
        const response = await apiCall('/inventory/categories');
        InventoryState.categories = response.categories || [];
        
        // Populate category dropdowns
        populateCategoryDropdowns();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

/**
 * Load stock movements from API
 */
async function loadStockMovements() {
    try {
        const response = await apiCall('/inventory/stock-movements');
        InventoryState.stockMovements = response.movements || [];
        renderStockMovements();
    } catch (error) {
        console.error('Error loading stock movements:', error);
    }
}

/**
 * Populate category dropdowns
 */
function populateCategoryDropdowns() {
    const categoryFilter = document.getElementById('categoryFilter');
    const productCategory = document.getElementById('productCategory');
    
    if (categoryFilter) {
        // Clear current options except for the first one (All Categories)
        while (categoryFilter.options.length > 1) {
            categoryFilter.remove(1);
        }
        
        // Add categories
        InventoryState.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    }
    
    if (productCategory) {
        // Clear current options
        productCategory.innerHTML = '';
        
        // Add categories
        InventoryState.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            productCategory.appendChild(option);
        });
        
        // Add option to create new category
        const newOption = document.createElement('option');
        newOption.value = 'new';
        newOption.textContent = '+ Add New Category';
        productCategory.appendChild(newOption);
        
        // Handle new category selection
        productCategory.addEventListener('change', function() {
            if (this.value === 'new') {
                const newCategory = prompt('Enter new category name:');
                if (newCategory && newCategory.trim()) {
                    // Add to category list if not exists
                    if (!InventoryState.categories.includes(newCategory.trim())) {
                        InventoryState.categories.push(newCategory.trim());
                        
                        // Add to dropdown
                        const option = document.createElement('option');
                        option.value = newCategory.trim();
                        option.textContent = newCategory.trim();
                        productCategory.insertBefore(option, productCategory.lastChild);
                        
                        // Select the new option
                        productCategory.value = newCategory.trim();
                        
                        // Also update filter dropdown
                        if (categoryFilter) {
                            const filterOption = document.createElement('option');
                            filterOption.value = newCategory.trim();
                            filterOption.textContent = newCategory.trim();
                            categoryFilter.appendChild(filterOption);
                        }
                    } else {
                        // Select existing category
                        productCategory.value = newCategory.trim();
                    }
                } else {
                    // If canceled or empty, revert to first option
                    productCategory.selectedIndex = 0;
                }
            }
        });
    }
}

/**
 * Render the product list
 */
function renderProductList() {
    const productListElem = document.getElementById('productList');
    if (!productListElem) return;
    
    // Clear current list
    productListElem.innerHTML = '';
    
    // Check if there are products
    if (InventoryState.products.length === 0) {
        productListElem.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="alert alert-info mb-0">
                        No products found. Add your first product to get started.
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Add products to list
    InventoryState.products.forEach(product => {
        // Determine stock status class
        let stockStatusClass = '';
        let stockStatusText = '';
        
        if (product.stock_quantity <= 0) {
            stockStatusClass = 'text-danger';
            stockStatusText = 'Out of Stock';
        } else if (product.stock_quantity <= 10) {
            stockStatusClass = 'text-warning';
            stockStatusText = 'Low Stock';
        } else {
            stockStatusClass = 'text-success';
            stockStatusText = 'In Stock';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.barcode}</td>
            <td>${product.name}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${product.category}</td>
            <td class="${stockStatusClass}">
                ${product.stock_quantity} 
                <small>(${stockStatusText})</small>
            </td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-primary edit-product" data-id="${product.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger delete-product" data-id="${product.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Add event listeners
        row.querySelector('.edit-product').addEventListener('click', () => {
            editProduct(product.id);
        });
        
        row.querySelector('.delete-product').addEventListener('click', () => {
            deleteProduct(product.id);
        });
        
        productListElem.appendChild(row);
    });
    
    // Set up event listeners for buttons
    setupProductButtonListeners();
}

/**
 * Setup listeners for product action buttons
 */
function setupProductButtonListeners() {
    // Edit product buttons
    document.querySelectorAll('.edit-product').forEach(button => {
        button.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            editProduct(productId);
        });
    });
    
    // Delete product buttons
    document.querySelectorAll('.delete-product').forEach(button => {
        button.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            deleteProduct(productId);
        });
    });
}

/**
 * Render the stock movements list
 */
function renderStockMovements() {
    const stockListElem = document.getElementById('stockMovementsList');
    if (!stockListElem) return;
    
    // Clear current list
    stockListElem.innerHTML = '';
    
    // Check if there are stock movements
    if (InventoryState.stockMovements.length === 0) {
        stockListElem.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="alert alert-info mb-0">
                        No stock movements found. Add stock adjustments to track inventory changes.
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Add stock movements to list
    InventoryState.stockMovements.forEach(movement => {
        // Determine movement type class
        let typeClass = '';
        let typeIcon = '';
        
        if (movement.movement_type === 'in') {
            typeClass = 'text-success';
            typeIcon = 'bi-arrow-down-circle-fill';
        } else if (movement.movement_type === 'out') {
            typeClass = 'text-danger';
            typeIcon = 'bi-arrow-up-circle-fill';
        } else {
            typeClass = 'text-warning';
            typeIcon = 'bi-arrow-repeat';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(movement.movement_date)}</td>
            <td>${movement.product_name}</td>
            <td class="${typeClass}">
                <i class="bi ${typeIcon}"></i>
                ${movement.movement_type.charAt(0).toUpperCase() + movement.movement_type.slice(1)}
            </td>
            <td class="${movement.quantity >= 0 ? 'text-success' : 'text-danger'}">
                ${movement.quantity}
            </td>
            <td>${movement.reference || '-'}</td>
            <td>${movement.notes || '-'}</td>
        `;
        
        stockListElem.appendChild(row);
    });
}

/**
 * Handle product form submission
 */
async function handleProductFormSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(event.target);
    const productData = {
        barcode: formData.get('barcode'),
        name: formData.get('name'),
        description: formData.get('description'),
        price: parseFloat(formData.get('price')),
        cost_price: parseFloat(formData.get('costPrice')),
        category: formData.get('category'),
        stock_quantity: parseInt(formData.get('stockQuantity') || 0)
    };
    
    try {
        let response;
        const productId = formData.get('productId');
        
        if (productId) {
            // Update existing product
            response = await apiCall(`/inventory/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });
            
            showToast('Success', 'Product updated successfully', 'success');
        } else {
            // Create new product
            response = await apiCall('/inventory/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });
            
            showToast('Success', 'Product added successfully', 'success');
        }
        
        // Close modal
        const productModal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
        productModal.hide();
        
        // Refresh product list
        await loadProducts();
    } catch (error) {
        console.error('Error saving product:', error);
    }
}

/**
 * Handle stock movement form submission
 */
async function handleStockMovementSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(event.target);
    const movementData = {
        product_id: parseInt(formData.get('productId')),
        quantity: parseInt(formData.get('quantity')),
        movement_type: formData.get('movementType'),
        reference: formData.get('reference'),
        notes: formData.get('notes')
    };
    
    try {
        // Create stock movement
        const response = await apiCall('/inventory/stock-movements', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(movementData)
        });
        
        showToast('Success', 'Stock movement recorded successfully', 'success');
        
        // Close modal
        const stockModal = bootstrap.Modal.getInstance(document.getElementById('stockMovementModal'));
        stockModal.hide();
        
        // Refresh data
        await Promise.all([
            loadProducts(),
            loadStockMovements()
        ]);
    } catch (error) {
        console.error('Error recording stock movement:', error);
    }
}

/**
 * Edit a product
 * @param {number} productId - Product ID to edit
 */
async function editProduct(productId) {
    try {
        // Find product in state
        const product = InventoryState.products.find(p => p.id == productId);
        if (!product) {
            // If not in state, fetch from API
            const response = await apiCall(`/inventory/products/${productId}`);
            product = response.product;
        }
        
        if (product) {
            // Populate form
            const form = document.getElementById('productForm');
            form.elements['productId'].value = product.id;
            form.elements['barcode'].value = product.barcode;
            form.elements['name'].value = product.name;
            form.elements['description'].value = product.description || '';
            form.elements['price'].value = product.price;
            form.elements['costPrice'].value = product.cost_price || 0;
            form.elements['category'].value = product.category;
            form.elements['stockQuantity'].value = product.stock_quantity;
            
            // Update form title
            document.getElementById('productModalLabel').textContent = 'Edit Product';
            
            // Show modal
            const productModal = new bootstrap.Modal(document.getElementById('productModal'));
            productModal.show();
        }
    } catch (error) {
        console.error('Error editing product:', error);
        showToast('Error', 'Failed to load product details', 'error');
    }
}

/**
 * Delete a product
 * @param {number} productId - Product ID to delete
 */
async function deleteProduct(productId) {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Delete product
        await apiCall(`/inventory/products/${productId}`, {
            method: 'DELETE'
        });
        
        showToast('Success', 'Product deleted successfully', 'success');
        
        // Refresh product list
        await loadProducts();
    } catch (error) {
        console.error('Error deleting product:', error);
    }
}

/**
 * Reset the product form
 */
function resetProductForm() {
    const form = document.getElementById('productForm');
    if (form) {
        form.reset();
        form.elements['productId'].value = '';
        document.getElementById('productModalLabel').textContent = 'Add New Product';
    }
}

/**
 * Reset the stock movement form
 */
function resetStockMovementForm() {
    const form = document.getElementById('stockMovementForm');
    if (form) {
        form.reset();
        
        // Populate product dropdown
        const productSelect = document.getElementById('stockProductId');
        productSelect.innerHTML = '<option value="">Select Product</option>';
        
        InventoryState.products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} (Stock: ${product.stock_quantity})`;
            productSelect.appendChild(option);
        });
    }
}

/**
 * Handle inventory search
 */
function handleInventorySearch(event) {
    const searchTerm = event.target.value.trim().toLowerCase();
    
    if (InventoryState.currentView === 'products') {
        // Filter products
        const filteredProducts = InventoryState.products.filter(product => {
            return (
                product.name.toLowerCase().includes(searchTerm) ||
                product.barcode.toLowerCase().includes(searchTerm) ||
                product.category.toLowerCase().includes(searchTerm) ||
                (product.description && product.description.toLowerCase().includes(searchTerm))
            );
        });
        
        // Update view with filtered products
        const tempProducts = InventoryState.products;
        InventoryState.products = filteredProducts;
        renderProductList();
        InventoryState.products = tempProducts;
    } else {
        // Filter stock movements
        const filteredMovements = InventoryState.stockMovements.filter(movement => {
            return (
                movement.product_name.toLowerCase().includes(searchTerm) ||
                movement.reference.toLowerCase().includes(searchTerm) ||
                (movement.notes && movement.notes.toLowerCase().includes(searchTerm))
            );
        });
        
        // Update view with filtered movements
        const tempMovements = InventoryState.stockMovements;
        InventoryState.stockMovements = filteredMovements;
        renderStockMovements();
        InventoryState.stockMovements = tempMovements;
    }
}

/**
 * Handle category filter change
 */
function handleCategoryFilter(event) {
    const category = event.target.value;
    
    if (category === 'all') {
        // Show all products
        renderProductList();
    } else {
        // Filter products by category
        const filteredProducts = InventoryState.products.filter(product => product.category === category);
        
        // Update view with filtered products
        const tempProducts = InventoryState.products;
        InventoryState.products = filteredProducts;
        renderProductList();
        InventoryState.products = tempProducts;
    }
}
