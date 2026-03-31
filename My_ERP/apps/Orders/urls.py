from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('dashboard/', views.OrdersDashboardView.as_view(), name='orders-dashboard'),

    # Quotations
    path('quotations/',                      views.QuotationListCreateView.as_view(),  name='quotation-list'),
    path('quotations/<int:pk>/',             views.QuotationDetailView.as_view(),      name='quotation-detail'),
    path('quotations/<int:pk>/send/',        views.SendQuotationView.as_view(),        name='quotation-send'),
    path('quotations/<int:pk>/convert/',     views.ConvertQuotationView.as_view(),     name='quotation-convert'),

    # Sales Orders
    path('sales/',                           views.SalesOrderListCreateView.as_view(), name='so-list'),
    path('sales/<int:pk>/',                  views.SalesOrderDetailView.as_view(),     name='so-detail'),
    path('sales/<int:pk>/confirm/',          views.ConfirmSalesOrderView.as_view(),    name='so-confirm'),
    path('sales/<int:pk>/approve/',          views.ApproveSalesOrderView.as_view(),    name='so-approve'),
    path('sales/<int:pk>/process/',          views.ProcessSalesOrderView.as_view(),    name='so-process'),
    path('sales/<int:pk>/ship/',             views.ShipSalesOrderView.as_view(),       name='so-ship'),
    path('sales/<int:pk>/deliver/',          views.DeliverSalesOrderView.as_view(),    name='so-deliver'),
    path('sales/<int:pk>/cancel/',           views.CancelSalesOrderView.as_view(),     name='so-cancel'),

    # Purchase Orders
    path('purchases/',                       views.PurchaseOrderListCreateView.as_view(), name='po-list'),
    path('purchases/<int:pk>/',              views.PurchaseOrderDetailView.as_view(),     name='po-detail'),
    path('purchases/<int:pk>/submit/',       views.SubmitPurchaseOrderView.as_view(),     name='po-submit'),
    path('purchases/<int:pk>/approve/',      views.ApprovePurchaseOrderView.as_view(),    name='po-approve'),
    path('purchases/<int:pk>/send/',         views.SendPurchaseOrderView.as_view(),       name='po-send'),
    path('purchases/<int:pk>/receive/',      views.ReceivePurchaseOrderView.as_view(),    name='po-receive'),
    path('purchases/<int:pk>/cancel/',       views.CancelPurchaseOrderView.as_view(),     name='po-cancel'),

    # Deliveries
    path('deliveries/',                      views.DeliveryListCreateView.as_view(),   name='delivery-list'),
    path('deliveries/<int:pk>/',             views.DeliveryDetailView.as_view(),       name='delivery-detail'),
    path('deliveries/<int:pk>/dispatch/',    views.DispatchDeliveryView.as_view(),     name='delivery-dispatch'),
    path('deliveries/<int:pk>/complete/',    views.CompleteDeliveryView.as_view(),     name='delivery-complete'),
]