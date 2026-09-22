from django.urls import path
from . import views

urlpatterns = [
    # Chart of Accounts
    path('accounts/',           views.AccountListCreateView.as_view(),  name='account-list'),
    path('accounts/<int:pk>/',  views.AccountDetailView.as_view(),      name='account-detail'),

    # Journal Entries
    path('journal-entries/',             views.JournalEntryListCreateView.as_view(), name='je-list'),
    path('journal-entries/<int:pk>/',    views.JournalEntryDetailView.as_view(),     name='je-detail'),
    path('journal-entries/<int:pk>/post/', views.PostJournalEntryView.as_view(),     name='je-post'),
    path('journal-entries/<int:pk>/void/', views.VoidJournalEntryView.as_view(),     name='je-void'),

    # Trial Balance
    path('trial-balance/',  views.TrialBalanceView.as_view(), name='trial-balance'),
]