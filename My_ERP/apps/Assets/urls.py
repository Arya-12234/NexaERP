from django.urls import path
from . import views

urlpatterns = [
    # Categories
    path('categories/',          views.AssetCategoryListCreateView.as_view(), name='category-list'),
    path('categories/<int:pk>/', views.AssetCategoryDetailView.as_view(),     name='category-detail'),

    # Assets
    path('',             views.AssetListCreateView.as_view(), name='asset-list'),
    path('<int:pk>/',    views.AssetDetailView.as_view(),     name='asset-detail'),

    # Asset actions
    path('<int:pk>/depreciate/',  views.DepreciateAssetView.as_view(),   name='asset-depreciate'),
    path('<int:pk>/schedule/',    views.AssetScheduleView.as_view(),      name='asset-schedule'),
    path('<int:pk>/dispose/',     views.AssetDisposalView.as_view(),      name='asset-dispose'),
    path('<int:pk>/revalue/',     views.AssetRevaluationView.as_view(),   name='asset-revalue'),
    path('<int:pk>/maintenance/', views.MaintenanceListCreateView.as_view(), name='asset-maintenance'),

    # Bulk operations
    path('depreciate-all/', views.DepreciateAllAssetsView.as_view(), name='depreciate-all'),
    path('summary/',        views.AssetSummaryView.as_view(),        name='asset-summary'),
]