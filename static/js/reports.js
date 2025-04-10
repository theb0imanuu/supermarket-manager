/**
 * Reports JavaScript
 * Handles the reporting functionality and data visualization
 */

// Reports state
const ReportsState = {
    salesSummary: null,
    categoryData: null,
    topProducts: null,
    inventoryStatus: null,
    currentPeriod: 'today',
    charts: {}
};

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('reportsPage')) {
        initializeReports();
    }
});

/**
 * Initialize the reports page
 */
async function initializeReports() {
    try {
        // Set up event listeners
        setupReportsEventListeners();
        
        // Load initial reports data
        await loadReportsData('today');
        
        // Render reports
        renderReports();
    } catch (error) {
        console.error('Error initializing reports:', error);
        showToast('Error', 'Failed to initialize reports', 'error');
    }
}

/**
 * Set up event listeners for reports page
 */
function setupReportsEventListeners() {
    // Period selector
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(button => {
        button.addEventListener('click', function() {
            const period = this.getAttribute('data-period');
            loadReportsData(period);
            
            // Update active state
            periodButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Custom date range form
    const dateRangeForm = document.getElementById('dateRangeForm');
    if (dateRangeForm) {
        dateRangeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            
            if (startDate && endDate) {
                loadReportsData('custom', startDate, endDate);
            } else {
                showToast('Error', 'Please select both start and end dates', 'error');
            }
        });
    }
    
    // Inventory threshold form
    const thresholdForm = document.getElementById('thresholdForm');
    if (thresholdForm) {
        thresholdForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const threshold = document.getElementById('lowStockThreshold').value;
            loadInventoryStatus(threshold);
        });
    }
    
    // Tab navigation
    const tabButtons = document.querySelectorAll('.nav-link[data-bs-toggle="tab"]');
    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', function(e) {
            // Resize charts when tab is shown
            Object.values(ReportsState.charts).forEach(chart => {
                if (chart) {
                    chart.resize();
                }
            });
        });
    });
}

/**
 * Load reports data for a specific period
 * @param {string} period - Period to load (today, week, month, custom)
 * @param {string} startDate - Start date for custom period (YYYY-MM-DD)
 * @param {string} endDate - End date for custom period (YYYY-MM-DD)
 */
async function loadReportsData(period, startDate = null, endDate = null) {
    try {
        // Show loading state
        AppState.isLoading = true;
        updateLoadingState();
        
        // Update current period
        ReportsState.currentPeriod = period;
        
        // Build URL parameters
        let params = `period=${period}`;
        if (period === 'custom' && startDate && endDate) {
            params += `&start_date=${startDate}&end_date=${endDate}`;
        }
        
        // Fetch data in parallel
        const [summaryRes, categoryRes, productsRes] = await Promise.all([
            apiCall(`/reports/sales/summary?${params}`),
            apiCall(`/reports/sales/by-category?${params}`),
            apiCall(`/reports/sales/top-products?${params}`),
        ]);
        
        // Update state
        ReportsState.salesSummary = summaryRes.data;
        ReportsState.categoryData = categoryRes.data;
        ReportsState.topProducts = productsRes.data;
        
        // Also load inventory status
        await loadInventoryStatus();
        
        // Render reports
        renderReports();
        
        // Update period display
        updatePeriodDisplay();
        
        // Show success message
        showToast('Success', 'Reports data loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading reports data:', error);
        showToast('Error', 'Failed to load reports data', 'error');
    } finally {
        // Hide loading state
        AppState.isLoading = false;
        updateLoadingState();
    }
}

/**
 * Load inventory status
 * @param {number} threshold - Low stock threshold
 */
async function loadInventoryStatus(threshold = 10) {
    try {
        const response = await apiCall(`/reports/inventory/status?low_stock=${threshold}`);
        ReportsState.inventoryStatus = response.data;
        renderInventoryStatus();
    } catch (error) {
        console.error('Error loading inventory status:', error);
    }
}

/**
 * Update the period display
 */
function updatePeriodDisplay() {
    const periodDisplay = document.getElementById('currentPeriod');
    if (!periodDisplay || !ReportsState.salesSummary) return;
    
    const period = ReportsState.salesSummary.period;
    
    let periodText = '';
    switch (period.name) {
        case 'today':
            periodText = 'Today';
            break;
        case 'week':
            periodText = 'Last 7 Days';
            break;
        case 'month':
            periodText = 'This Month';
            break;
        case 'custom':
            const start = new Date(period.start);
            const end = new Date(period.end);
            periodText = `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
            break;
        default:
            periodText = 'Custom Period';
    }
    
    periodDisplay.textContent = periodText;
}

/**
 * Render all reports
 */
function renderReports() {
    renderSalesSummary();
    renderSalesByCategory();
    renderTopProducts();
    renderInventoryStatus();
}

/**
 * Render sales summary
 */
function renderSalesSummary() {
    if (!ReportsState.salesSummary) return;
    
    const data = ReportsState.salesSummary;
    
    // Update summary cards
    document.getElementById('totalTransactions').textContent = data.sales.total_transactions;
    document.getElementById('totalSales').textContent = formatCurrency(data.sales.total_sales);
    document.getElementById('averageSale').textContent = formatCurrency(data.sales.average_sale);
    
    // Render payment methods chart
    renderPaymentMethodsChart(data.payment_methods);
}

/**
 * Render payment methods chart
 * @param {Array} paymentData - Payment methods data
 */
function renderPaymentMethodsChart(paymentData) {
    const chartCanvas = document.getElementById('paymentMethodsChart');
    if (!chartCanvas || !paymentData || paymentData.length === 0) return;
    
    // Destroy existing chart
    if (ReportsState.charts.paymentMethods) {
        ReportsState.charts.paymentMethods.destroy();
    }
    
    // Prepare data
    const labels = paymentData.map(item => item.method.toUpperCase());
    const counts = paymentData.map(item => item.count);
    const totals = paymentData.map(item => item.total);
    
    // Create chart
    ReportsState.charts.paymentMethods = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Transaction Count',
                    data: counts,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Total Amount',
                    data: totals,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Transaction Count'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Amount'
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.datasetIndex === 1) {
                                label += formatCurrency(context.raw);
                            } else {
                                label += context.raw;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render sales by category
 */
function renderSalesByCategory() {
    if (!ReportsState.categoryData) return;
    
    const data = ReportsState.categoryData;
    
    // Render categories chart
    renderCategoriesChart(data.categories);
}

/**
 * Render categories chart
 * @param {Array} categoriesData - Categories data
 */
function renderCategoriesChart(categoriesData) {
    const chartCanvas = document.getElementById('categoriesChart');
    if (!chartCanvas || !categoriesData || categoriesData.length === 0) return;
    
    // Destroy existing chart
    if (ReportsState.charts.categories) {
        ReportsState.charts.categories.destroy();
    }
    
    // Prepare data
    const labels = categoriesData.map(item => item.category);
    const sales = categoriesData.map(item => item.total_sales);
    const quantities = categoriesData.map(item => item.quantity_sold);
    
    // Create chart
    ReportsState.charts.categories = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Sales Amount',
                    data: sales,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Quantity Sold',
                    data: quantities,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Sales Amount'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Quantity'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.datasetIndex === 0) {
                                label += formatCurrency(context.raw);
                            } else {
                                label += context.raw;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render top products
 */
function renderTopProducts() {
    if (!ReportsState.topProducts) return;
    
    const data = ReportsState.topProducts;
    
    // Render top products table by quantity
    const quantityTableBody = document.getElementById('topQuantityBody');
    if (quantityTableBody) {
        quantityTableBody.innerHTML = '';
        
        if (data.top_by_quantity.length === 0) {
            quantityTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">No data available</td>
                </tr>
            `;
        } else {
            data.top_by_quantity.forEach((product, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${product.name}</td>
                    <td>${product.category}</td>
                    <td class="text-end">${product.quantity_sold}</td>
                `;
                quantityTableBody.appendChild(row);
            });
        }
    }
    
    // Render top products table by revenue
    const revenueTableBody = document.getElementById('topRevenueBody');
    if (revenueTableBody) {
        revenueTableBody.innerHTML = '';
        
        if (data.top_by_revenue.length === 0) {
            revenueTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">No data available</td>
                </tr>
            `;
        } else {
            data.top_by_revenue.forEach((product, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${product.name}</td>
                    <td>${product.category}</td>
                    <td class="text-end">${formatCurrency(product.total_revenue)}</td>
                `;
                revenueTableBody.appendChild(row);
            });
        }
    }
}

/**
 * Render inventory status
 */
function renderInventoryStatus() {
    if (!ReportsState.inventoryStatus) return;
    
    const data = ReportsState.inventoryStatus;
    
    // Update summary cards
    document.getElementById('totalProducts').textContent = data.summary.total_products;
    document.getElementById('outOfStockCount').textContent = data.summary.out_of_stock;
    document.getElementById('lowStockCount').textContent = data.summary.low_stock;
    document.getElementById('inventoryValue').textContent = formatCurrency(data.summary.total_value);
    
    // Update threshold display
    document.getElementById('currentThreshold').textContent = data.low_stock_threshold;
    
    // Render low stock table
    const lowStockBody = document.getElementById('lowStockBody');
    if (lowStockBody) {
        lowStockBody.innerHTML = '';
        
        if (data.low_stock_products.length === 0) {
            lowStockBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No low stock products</td>
                </tr>
            `;
        } else {
            data.low_stock_products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.barcode}</td>
                    <td>${product.name}</td>
                    <td>${product.category}</td>
                    <td class="text-warning">${product.stock_quantity}</td>
                    <td>${formatCurrency(product.price)}</td>
                `;
                lowStockBody.appendChild(row);
            });
        }
    }
    
    // Render out of stock table
    const outOfStockBody = document.getElementById('outOfStockBody');
    if (outOfStockBody) {
        outOfStockBody.innerHTML = '';
        
        if (data.out_of_stock_products.length === 0) {
            outOfStockBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No out of stock products</td>
                </tr>
            `;
        } else {
            data.out_of_stock_products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.barcode}</td>
                    <td>${product.name}</td>
                    <td>${product.category}</td>
                    <td class="text-danger">${product.stock_quantity}</td>
                    <td>${formatCurrency(product.price)}</td>
                `;
                outOfStockBody.appendChild(row);
            });
        }
    }
    
    // Render inventory distribution chart
    renderInventoryChart(data);
}

/**
 * Render inventory distribution chart
 * @param {Object} data - Inventory status data
 */
function renderInventoryChart(data) {
    const chartCanvas = document.getElementById('inventoryChart');
    if (!chartCanvas) return;
    
    // Destroy existing chart
    if (ReportsState.charts.inventory) {
        ReportsState.charts.inventory.destroy();
    }
    
    // Prepare data
    const chartData = [
        data.summary.out_of_stock,
        data.summary.low_stock,
        data.summary.total_products - data.summary.out_of_stock - data.summary.low_stock
    ];
    
    // Create chart
    ReportsState.charts.inventory = new Chart(chartCanvas, {
        type: 'pie',
        data: {
            labels: ['Out of Stock', 'Low Stock', 'Normal Stock'],
            datasets: [{
                data: chartData,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(255, 205, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 205, 86, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw;
                            const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}
