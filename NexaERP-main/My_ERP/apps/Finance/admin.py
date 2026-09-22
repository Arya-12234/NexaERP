from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Account, JournalEntry, JournalLine


class JournalLineInline(admin.TabularInline):
    model  = JournalLine
    extra  = 2
    fields = ['account', 'description', 'debit', 'credit']


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display  = ['code', 'name', 'account_type', 'is_active']
    list_filter   = ['account_type', 'is_active']
    search_fields = ['code', 'name']
    ordering      = ['code']


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display  = ['reference', 'date', 'description', 'source', 'status', 'created_at']
    list_filter   = ['status', 'source']
    search_fields = ['reference', 'description']
    ordering      = ['-date']
    inlines       = [JournalLineInline]
    readonly_fields = ['reference', 'created_at', 'posted_at']