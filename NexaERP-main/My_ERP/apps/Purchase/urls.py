from django.urls import path
from . import views

urlpatterns = [
    # Dashboard & Analytics
    path('dashboard/',   views.PurchaseDashboardView.as_view(),  name='purchase-dashboard'),
    path('analytics/',   views.PurchaseAnalyticsView.as_view(),  name='purchase-analytics'),

    # Suppliers
    path('suppliers/',                        views.SupplierListCreateView.as_view(),  name='supplier-list'),
    path('suppliers/<int:pk>/',               views.SupplierDetailView.as_view(),      name='supplier-detail'),
    path('suppliers/<int:pk>/ratings/',       views.SupplierRatingsView.as_view(),     name='supplier-ratings'),

    # Requisitions
    path('requisitions/',                          views.RequisitionListCreateView.as_view(),  name='pr-list'),
    path('requisitions/<int:pk>/',                 views.RequisitionDetailView.as_view(),      name='pr-detail'),
    path('requisitions/<int:pk>/submit/',          views.SubmitRequisitionView.as_view(),      name='pr-submit'),
    path('requisitions/<int:pk>/approve/',         views.ApproveRequisitionView.as_view(),     name='pr-approve'),
    path('requisitions/<int:pk>/reject/',          views.RejectRequisitionView.as_view(),      name='pr-reject'),
    path('requisitions/<int:pk>/convert/',         views.ConvertRequisitionView.as_view(),     name='pr-convert'),

    # Budgets
    path('budgets/',             views.BudgetListCreateView.as_view(), name='budget-list'),
    path('budgets/<int:pk>/',    views.BudgetDetailView.as_view(),     name='budget-detail'),
    path('budgets/summary/',     views.BudgetSummaryView.as_view(),    name='budget-summary'),

    # GRNs
    path('grns/',                    views.GRNListCreateView.as_view(), name='grn-list'),
    path('grns/<int:pk>/',           views.GRNDetailView.as_view(),     name='grn-detail'),
    path('grns/<int:pk>/confirm/',   views.ConfirmGRNView.as_view(),    name='grn-confirm'),
    path('grns/<int:pk>/post/',      views.PostGRNView.as_view(),       name='grn-post'),

    # Supplier Ratings
    path('ratings/', views.SupplierRatingListCreateView.as_view(), name='rating-list'),
]