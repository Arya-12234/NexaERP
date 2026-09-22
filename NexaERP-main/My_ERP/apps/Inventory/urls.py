from django.urls import path
from . import views

urlpatterns = [
    # Dashboard & Reports
    path('dashboard/',       views.InventoryDashboardView.as_view(), name='inventory-dashboard'),
    path('valuation/',       views.ValuationReportView.as_view(),    name='inventory-valuation'),
    path('reorder-alerts/',  views.ReorderAlertsView.as_view(),      name='reorder-alerts'),

    # Categories
    path('categories/',            views.CategoryListCreateView.as_view(), name='category-list'),
    path('categories/<int:pk>/',   views.CategoryDetailView.as_view(),     name='category-detail'),

    # Warehouses
    path('warehouses/',            views.WarehouseListCreateView.as_view(), name='warehouse-list'),
    path('warehouses/<int:pk>/',   views.WarehouseDetailView.as_view(),     name='warehouse-detail'),

    # Products
    path('products/',              views.ProductListCreateView.as_view(),   name='product-list'),
    path('products/<int:pk>/',     views.ProductDetailView.as_view(),       name='product-detail'),

    # Stock operations
    path('products/<int:pk>/receive/',  views.ReceiveStockView.as_view(),   name='stock-receive'),
    path('products/<int:pk>/issue/',    views.IssueStockView.as_view(),     name='stock-issue'),
    path('products/<int:pk>/transfer/', views.TransferStockView.as_view(),  name='stock-transfer'),
    path('products/<int:pk>/adjust/',   views.StockAdjustmentView.as_view(),name='stock-adjust'),

    # Stock movements & adjustments history
    path('movements/',             views.StockMovementListView.as_view(),   name='movement-list'),
    path('adjustments/',           views.StockAdjustmentListView.as_view(), name='adjustment-list'),

    # Purchase Orders
    path('pos/',                   views.PurchaseOrderListCreateView.as_view(), name='po-list'),
    path('pos/<int:pk>/',          views.PurchaseOrderDetailView.as_view(),     name='po-detail'),
    path('pos/<int:pk>/approve/',  views.ApprovePOView.as_view(),               name='po-approve'),
    path('pos/<int:pk>/receive/',  views.ReceivePOView.as_view(),               name='po-receive'),
    path('pos/<int:pk>/cancel/',   views.CancelPOView.as_view(),                name='po-cancel'),
]