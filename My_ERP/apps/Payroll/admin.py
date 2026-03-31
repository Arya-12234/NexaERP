from django.contrib import admin
from .models import Department, Employee, PayrollRun, Payslip


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display  = ['name', 'description']
    search_fields = ['name']


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display  = ['employee_number', 'full_name', 'job_title', 'department',
                     'employment_type', 'status', 'basic_salary']
    list_filter   = ['status', 'employment_type', 'department']
    search_fields = ['first_name', 'last_name', 'employee_number', 'email', 'national_id']
    readonly_fields = ['employee_number', 'created_at', 'updated_at']


class PayslipInline(admin.TabularInline):
    model   = Payslip
    extra   = 0
    fields  = ['employee', 'gross_salary', 'paye', 'nssf_total', 'shif',
                'housing_levy', 'net_pay', 'status']
    readonly_fields = ['employee', 'gross_salary', 'paye', 'nssf_total', 'shif',
                       'housing_levy', 'net_pay', 'status']

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display  = ['reference', 'period_label', 'status', 'created_at',
                     'submitted_at', 'hr_approved_at', 'finance_approved_at']
    list_filter   = ['status']
    readonly_fields = ['reference', 'created_at', 'submitted_at',
                       'hr_approved_at', 'finance_approved_at',
                       'rejected_at', 'paid_at']
    inlines       = [PayslipInline]


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display  = ['run', 'employee', 'gross_salary', 'paye', 'nssf_total',
                     'shif', 'housing_levy', 'net_pay', 'status']
    list_filter   = ['status', 'run']
    search_fields = ['employee__first_name', 'employee__last_name']