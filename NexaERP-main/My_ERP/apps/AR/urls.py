from django.urls import path
from . import views

urlpatterns = [
    # Dashboard & Aging
    path('dashboard/', views.ARDashboardView.as_view(), name='ar-dashboard'),
    path('aging/',     views.ARAgingView.as_view(),     name='ar-aging'),

    # Customers
    path('customers/',                    views.CustomerListCreateView.as_view(),  name='customer-list'),
    path('customers/<int:pk>/',           views.CustomerDetailView.as_view(),      name='customer-detail'),
    path('customers/<int:pk>/statement/', views.CustomerStatementView.as_view(),   name='customer-statement'),

    # Invoices
    path('invoices/',                          views.InvoiceListCreateView.as_view(),  name='invoice-list'),
    path('invoices/<int:pk>/',                 views.InvoiceDetailView.as_view(),      name='invoice-detail'),
    path('invoices/<int:pk>/approve/',         views.ApproveInvoiceView.as_view(),     name='invoice-approve'),
    path('invoices/<int:pk>/send/',            views.SendInvoiceView.as_view(),        name='invoice-send'),
    path('invoices/<int:pk>/collect/',         views.CollectInvoiceView.as_view(),     name='invoice-collect'),
    path('invoices/<int:pk>/cancel/',          views.CancelInvoiceView.as_view(),      name='invoice-cancel'),
    path('invoices/<int:pk>/credit-note/',     views.CreditNoteCreateView.as_view(),   name='invoice-credit-note'),

    # Receipts
    path('receipts/', views.ReceiptListView.as_view(), name='receipt-list'),
]