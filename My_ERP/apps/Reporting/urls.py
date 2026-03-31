from django.urls import path
from . import views

urlpatterns = [
    path('executive-summary/',      views.ExecutiveSummaryView.as_view(),          name='executive-summary'),
    path('ar-aging/',               views.ARAgingReportView.as_view(),              name='ar-aging'),
    path('ap-aging/',               views.APAgingReportView.as_view(),              name='ap-aging'),
    path('inventory-valuation/',    views.InventoryValuationReportView.as_view(),   name='inventory-valuation'),
    path('stock-movements/',        views.StockMovementReportView.as_view(),        name='stock-movements'),
    path('reorder-alerts/',         views.ReorderAlertReportView.as_view(),         name='reorder-alerts'),
    path('sales/',                  views.SalesReportView.as_view(),                name='sales-report'),
    path('purchase/',               views.PurchaseReportView.as_view(),             name='purchase-report'),
    path('asset-register/',         views.AssetRegisterReportView.as_view(),        name='asset-register'),
    path('depreciation-schedule/',  views.DepreciationScheduleReportView.as_view(), name='depreciation-schedule'),
]