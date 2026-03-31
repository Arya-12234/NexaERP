from django.urls import path
from . import views

urlpatterns = [
    # Departments
    path('departments/',          views.DepartmentListCreateView.as_view(), name='dept-list'),
    path('departments/<int:pk>/', views.DepartmentDetailView.as_view(),     name='dept-detail'),

    # Employees
    path('employees/',            views.EmployeeListCreateView.as_view(),   name='emp-list'),
    path('employees/<int:pk>/',   views.EmployeeDetailView.as_view(),       name='emp-detail'),

    # Payroll Runs — CRUD
    path('runs/',            views.PayrollRunListCreateView.as_view(), name='run-list'),
    path('runs/<int:pk>/',   views.PayrollRunDetailView.as_view(),     name='run-detail'),

    # Payroll Workflow
    path('runs/<int:pk>/calculate/',       views.CalculatePayrollView.as_view(),  name='run-calculate'),
    path('runs/<int:pk>/submit/',          views.SubmitPayrollView.as_view(),      name='run-submit'),
    path('runs/<int:pk>/approve-hr/',      views.ApproveHRView.as_view(),          name='run-approve-hr'),
    path('runs/<int:pk>/approve-finance/', views.ApproveFinanceView.as_view(),     name='run-approve-finance'),
    path('runs/<int:pk>/reject/',          views.RejectPayrollView.as_view(),      name='run-reject'),
    path('runs/<int:pk>/mark-paid/',       views.MarkPaidView.as_view(),           name='run-mark-paid'),

    # Payslips
    path('runs/<int:pk>/payslips/', views.PayrollRunPayslipsView.as_view(), name='run-payslips'),
    path('runs/<int:pk>/summary/',  views.PayrollSummaryView.as_view(),     name='run-summary'),
    path('payslips/<int:pk>/',      views.PayslipDetailView.as_view(),      name='payslip-detail'),

    # Payment & Statutory Reports (CSV downloads)
    path('runs/<int:pk>/payment-file/',   views.PaymentFileView.as_view(),    name='run-payment-file'),
    path('runs/<int:pk>/p10/',            views.P10ReportView.as_view(),       name='run-p10'),
    path('runs/<int:pk>/nssf/',           views.NSSFRemittanceView.as_view(),  name='run-nssf'),
    path('runs/<int:pk>/shif/',           views.SHIFRemittanceView.as_view(),  name='run-shif'),
    path('runs/<int:pk>/housing-levy/',   views.HousingLevyView.as_view(),     name='run-housing'),
]