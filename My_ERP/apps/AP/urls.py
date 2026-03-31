from django.urls import path
from . import views

urlpatterns = [
    # Dashboard & Aging
    path('dashboard/', views.APDashboardView.as_view(), name='ap-dashboard'),
    path('aging/',     views.APAgingView.as_view(),     name='ap-aging'),

    # Vendors
    path('vendors/',                       views.VendorListCreateView.as_view(),  name='vendor-list'),
    path('vendors/<int:pk>/',              views.VendorDetailView.as_view(),       name='vendor-detail'),
    path('vendors/<int:pk>/statement/',    views.VendorStatementView.as_view(),    name='vendor-statement'),

    # Bills
    path('bills/',                         views.BillListCreateView.as_view(),          name='bill-list'),
    path('bills/<int:pk>/',                views.BillDetailView.as_view(),              name='bill-detail'),
    path('bills/<int:pk>/submit/',         views.SubmitBillView.as_view(),              name='bill-submit'),
    path('bills/<int:pk>/approve-procurement/', views.ApproveProcurementView.as_view(), name='bill-approve-procurement'),
    path('bills/<int:pk>/approve-finance/', views.ApproveFinanceBillView.as_view(),     name='bill-approve-finance'),
    path('bills/<int:pk>/reject/',         views.RejectBillView.as_view(),              name='bill-reject'),
    path('bills/<int:pk>/pay/',            views.PayBillView.as_view(),                 name='bill-pay'),

    # Payments
    path('payments/',  views.PaymentListView.as_view(), name='payment-list'),
]