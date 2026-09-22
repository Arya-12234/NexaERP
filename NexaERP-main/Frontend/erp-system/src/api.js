import axios from 'axios';

const BASE = 'http://localhost:8000/api';
const api  = axios.create({ baseURL: BASE });

// ── Finance ────────────────────────────────────────────────────
// Endpoints: /api/finance/
export const financeApi = {
  // Accounts
  getAccounts:        ()           => api.get('/finance/accounts/'),
  createAccount:      (data)       => api.post('/finance/accounts/', data),
  getAccount:         (id)         => api.get(`/finance/accounts/${id}/`),
  updateAccount:      (id, data)   => api.put(`/finance/accounts/${id}/`, data),

  // Journal Entries
  getJournalEntries:  (params)     => api.get('/finance/journal-entries/', { params }),
  getJournalEntry:    (id)         => api.get(`/finance/journal-entries/${id}/`),
  createJournalEntry: (data)       => api.post('/finance/journal-entries/', data),
  postJournalEntry:   (id)         => api.post(`/finance/journal-entries/${id}/post/`),
  voidJournalEntry:   (id)         => api.post(`/finance/journal-entries/${id}/void/`),

  // Trial Balance
  getTrialBalance:    (params)     => api.get('/finance/trial-balance/', { params }),
};

// ── Payroll ────────────────────────────────────────────────────
// Endpoints: /api/payroll/
export const payrollApi = {
  // Departments
  getDepartments:     ()           => api.get('/payroll/departments/'),
  createDepartment:   (data)       => api.post('/payroll/departments/', data),
  getDepartment:      (id)         => api.get(`/payroll/departments/${id}/`),
  updateDepartment:   (id, data)   => api.put(`/payroll/departments/${id}/`, data),

  // Employees
  getEmployees:       (params)     => api.get('/payroll/employees/', { params }),
  getEmployee:        (id)         => api.get(`/payroll/employees/${id}/`),
  createEmployee:     (data)       => api.post('/payroll/employees/', data),
  updateEmployee:     (id, data)   => api.put(`/payroll/employees/${id}/`, data),
  terminateEmployee:  (id)         => api.delete(`/payroll/employees/${id}/`),

  // Payroll Runs
  getRuns:            (params)     => api.get('/payroll/runs/', { params }),
  getRun:             (id)         => api.get(`/payroll/runs/${id}/`),
  createRun:          (data)       => api.post('/payroll/runs/', data),
  getSummary:         (id)         => api.get(`/payroll/runs/${id}/summary/`),
  getPayslips:        (id)         => api.get(`/payroll/runs/${id}/payslips/`),
  getPayslip:         (id)         => api.get(`/payroll/payslips/${id}/`),

  // Workflow
  calculateRun:       (id)         => api.post(`/payroll/runs/${id}/calculate/`),
  submitRun:          (id)         => api.post(`/payroll/runs/${id}/submit/`),
  approveHR:          (id)         => api.post(`/payroll/runs/${id}/approve-hr/`),
  approveFinance:     (id)         => api.post(`/payroll/runs/${id}/approve-finance/`),
  rejectRun:          (id, reason) => api.post(`/payroll/runs/${id}/reject/`, { reason }),
  markPaid:           (id)         => api.post(`/payroll/runs/${id}/mark-paid/`),

  // Statutory Reports (CSV — open as download URL)
  paymentFileUrl:     (id)         => `${BASE}/payroll/runs/${id}/payment-file/`,
  p10Url:             (id)         => `${BASE}/payroll/runs/${id}/p10/`,
  nssfUrl:            (id)         => `${BASE}/payroll/runs/${id}/nssf/`,
  shifUrl:            (id)         => `${BASE}/payroll/runs/${id}/shif/`,
  housingLevyUrl:     (id)         => `${BASE}/payroll/runs/${id}/housing-levy/`,
};

// ── Fixed Assets ───────────────────────────────────────────────
// Endpoints: /api/assets/
export const assetsApi = {
  // Categories
  getCategories:      ()           => api.get('/assets/categories/'),
  createCategory:     (data)       => api.post('/assets/categories/', data),
  getCategory:        (id)         => api.get(`/assets/categories/${id}/`),
  updateCategory:     (id, data)   => api.put(`/assets/categories/${id}/`, data),

  // Assets
  getSummary:         ()           => api.get('/assets/summary/'),
  getAssets:          (params)     => api.get('/assets/', { params }),
  getAsset:           (id)         => api.get(`/assets/${id}/`),
  createAsset:        (data)       => api.post('/assets/', data),
  updateAsset:        (id, data)   => api.put(`/assets/${id}/`, data),

  // Depreciation
  depreciateOne:      (id)         => api.post(`/assets/${id}/depreciate/`),
  depreciateAll:      ()           => api.post('/assets/depreciate-all/'),
  getSchedule:        (id)         => api.get(`/assets/${id}/schedule/`),

  // Lifecycle
  dispose:            (id, data)   => api.post(`/assets/${id}/dispose/`, data),
  revalue:            (id, data)   => api.post(`/assets/${id}/revalue/`, data),

  // Maintenance
  getMaintenance:     (id)         => api.get(`/assets/${id}/maintenance/`),
  addMaintenance:     (id, data)   => api.post(`/assets/${id}/maintenance/`, data),
};

// ── Accounts Payable ───────────────────────────────────────────
// Endpoints: /api/ap/
export const apApi = {
  // Dashboard & Aging
  getDashboard:        ()           => api.get('/ap/dashboard/'),
  getAging:            ()           => api.get('/ap/aging/'),

  // Vendors
  getVendors:          (params)     => api.get('/ap/vendors/', { params }),
  getVendor:           (id)         => api.get(`/ap/vendors/${id}/`),
  createVendor:        (data)       => api.post('/ap/vendors/', data),
  updateVendor:        (id, data)   => api.put(`/ap/vendors/${id}/`, data),
  getVendorStatement:  (id)         => api.get(`/ap/vendors/${id}/statement/`),

  // Bills
  getBills:            (params)     => api.get('/ap/bills/', { params }),
  getBill:             (id)         => api.get(`/ap/bills/${id}/`),
  createBill:          (data)       => api.post('/ap/bills/', data),
  submitBill:          (id)         => api.post(`/ap/bills/${id}/submit/`),
  approveProcurement:  (id)         => api.post(`/ap/bills/${id}/approve-procurement/`),
  approveFinance:      (id)         => api.post(`/ap/bills/${id}/approve-finance/`),
  rejectBill:          (id, reason) => api.post(`/ap/bills/${id}/reject/`, { reason }),
  payBill:             (id, data)   => api.post(`/ap/bills/${id}/pay/`, data),

  // Payments
  getPayments:         (params)     => api.get('/ap/payments/', { params }),
};

// ── Accounts Receivable ────────────────────────────────────────
// Endpoints: /api/ar/
export const arApi = {
  // Dashboard & Aging
  getDashboard:         ()           => api.get('/ar/dashboard/'),
  getAging:             ()           => api.get('/ar/aging/'),

  // Customers
  getCustomers:         (params)     => api.get('/ar/customers/', { params }),
  getCustomer:          (id)         => api.get(`/ar/customers/${id}/`),
  createCustomer:       (data)       => api.post('/ar/customers/', data),
  updateCustomer:       (id, data)   => api.put(`/ar/customers/${id}/`, data),
  getCustomerStatement: (id)         => api.get(`/ar/customers/${id}/statement/`),

  // Invoices
  getInvoices:          (params)     => api.get('/ar/invoices/', { params }),
  getInvoice:           (id)         => api.get(`/ar/invoices/${id}/`),
  createInvoice:        (data)       => api.post('/ar/invoices/', data),
  approveInvoice:       (id)         => api.post(`/ar/invoices/${id}/approve/`),
  sendInvoice:          (id)         => api.post(`/ar/invoices/${id}/send/`),
  collectInvoice:       (id, data)   => api.post(`/ar/invoices/${id}/collect/`, data),
  cancelInvoice:        (id)         => api.post(`/ar/invoices/${id}/cancel/`),
  issueCreditNote:      (id, data)   => api.post(`/ar/invoices/${id}/credit-note/`, data),

  // Receipts
  getReceipts:          (params)     => api.get('/ar/receipts/', { params }),
};

// ── Inventory ──────────────────────────────────────────────────
// Endpoints: /api/inventory/
export const inventoryApi = {
  // Dashboard & Reports
  getDashboard:      ()           => api.get('/inventory/dashboard/'),
  getValuation:      ()           => api.get('/inventory/valuation/'),
  getReorderAlerts:  ()           => api.get('/inventory/reorder-alerts/'),

  // Categories
  getCategories:     ()           => api.get('/inventory/categories/'),
  createCategory:    (data)       => api.post('/inventory/categories/', data),
  getCategory:       (id)         => api.get(`/inventory/categories/${id}/`),
  updateCategory:    (id, data)   => api.put(`/inventory/categories/${id}/`, data),

  // Warehouses
  getWarehouses:     ()           => api.get('/inventory/warehouses/'),
  createWarehouse:   (data)       => api.post('/inventory/warehouses/', data),
  getWarehouse:      (id)         => api.get(`/inventory/warehouses/${id}/`),
  updateWarehouse:   (id, data)   => api.put(`/inventory/warehouses/${id}/`, data),

  // Products
  getProducts:       (params)     => api.get('/inventory/products/', { params }),
  getProduct:        (id)         => api.get(`/inventory/products/${id}/`),
  createProduct:     (data)       => api.post('/inventory/products/', data),
  updateProduct:     (id, data)   => api.put(`/inventory/products/${id}/`, data),

  // Stock Operations
  receiveStock:      (id, data)   => api.post(`/inventory/products/${id}/receive/`, data),
  issueStock:        (id, data)   => api.post(`/inventory/products/${id}/issue/`, data),
  transferStock:     (id, data)   => api.post(`/inventory/products/${id}/transfer/`, data),
  adjustStock:       (id, data)   => api.post(`/inventory/products/${id}/adjust/`, data),

  // Movement & Adjustment History
  getMovements:      (params)     => api.get('/inventory/movements/', { params }),
  getAdjustments:    (params)     => api.get('/inventory/adjustments/', { params }),

  // Purchase Orders
  getPOs:            (params)     => api.get('/inventory/pos/', { params }),
  getPO:             (id)         => api.get(`/inventory/pos/${id}/`),
  createPO:          (data)       => api.post('/inventory/pos/', data),
  approvePO:         (id)         => api.post(`/inventory/pos/${id}/approve/`),
  receivePO:         (id, data)   => api.post(`/inventory/pos/${id}/receive/`, data),
  cancelPO:          (id)         => api.post(`/inventory/pos/${id}/cancel/`),
};

// ── Orders ─────────────────────────────────────────────────────
// Endpoints: /api/orders/
export const ordersApi = {
  // Dashboard
  getDashboard:        ()           => api.get('/orders/dashboard/'),

  // Quotations
  getQuotations:       (params)     => api.get('/orders/quotations/', { params }),
  getQuotation:        (id)         => api.get(`/orders/quotations/${id}/`),
  createQuotation:     (data)       => api.post('/orders/quotations/', data),
  updateQuotation:     (id, data)   => api.put(`/orders/quotations/${id}/`, data),
  sendQuotation:       (id)         => api.post(`/orders/quotations/${id}/send/`),
  convertQuotation:    (id)         => api.post(`/orders/quotations/${id}/convert/`),

  // Sales Orders
  getSalesOrders:      (params)     => api.get('/orders/sales/', { params }),
  getSalesOrder:       (id)         => api.get(`/orders/sales/${id}/`),
  createSalesOrder:    (data)       => api.post('/orders/sales/', data),
  confirmOrder:        (id)         => api.post(`/orders/sales/${id}/confirm/`),
  approveOrder:        (id)         => api.post(`/orders/sales/${id}/approve/`),
  processOrder:        (id)         => api.post(`/orders/sales/${id}/process/`),
  shipOrder:           (id)         => api.post(`/orders/sales/${id}/ship/`),
  deliverOrder:        (id)         => api.post(`/orders/sales/${id}/deliver/`),
  cancelOrder:         (id, reason) => api.post(`/orders/sales/${id}/cancel/`, { reason }),

  // Purchase Orders
  getPurchaseOrders:   (params)     => api.get('/orders/purchases/', { params }),
  getPurchaseOrder:    (id)         => api.get(`/orders/purchases/${id}/`),
  createPurchaseOrder: (data)       => api.post('/orders/purchases/', data),
  submitPO:            (id)         => api.post(`/orders/purchases/${id}/submit/`),
  approvePO:           (id)         => api.post(`/orders/purchases/${id}/approve/`),
  sendPO:              (id)         => api.post(`/orders/purchases/${id}/send/`),
  receivePO:           (id)         => api.post(`/orders/purchases/${id}/receive/`),
  cancelPO:            (id, reason) => api.post(`/orders/purchases/${id}/cancel/`, { reason }),

  // Deliveries
  getDeliveries:       (params)     => api.get('/orders/deliveries/', { params }),
  getDelivery:         (id)         => api.get(`/orders/deliveries/${id}/`),
  createDelivery:      (data)       => api.post('/orders/deliveries/', data),
  dispatchDelivery:    (id)         => api.post(`/orders/deliveries/${id}/dispatch/`),
  completeDelivery:    (id)         => api.post(`/orders/deliveries/${id}/complete/`),
};