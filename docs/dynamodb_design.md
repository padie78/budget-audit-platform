# ProcureTech OS - Especificación Completa de Tabla Única en DynamoDB

Este documento contiene el diseño físico y de datos NoSQL definitivo para la plataforma de **Auditoría de Presupuestos, Contratos y Gastos Corporativos**. Todas las entidades operativas y las vistas estadísticas materializadas coexisten en una única tabla de DynamoDB utilizando claves genéricas (`PK`, `SK`) y un Índice Secundario Global (`GSI1`).

---

## 🗺️ 1. Matriz Unificada de Claves (Single-Table Key Mapping)

| Entidad de Negocio | PK (Partition Key) | SK (Sort Key) | GSI1_PK (Filtro por Sede) | Propósito Técnico |
| :--- | :--- | :--- | :--- | :--- |
| **1. Proveedor (Maestro)** | `SUPPLIER#<SupplierID>` | `METADATA` | `ENTITY#<SedeID>` | Perfil core del vendor y configuración de umbrales. |
| **2. Contrato Base** | `SUPPLIER#<SupplierID>` | `CONTRACT#<ContractID>` | `ENTITY#<SedeID>` | Línea base legal, tarifario por SKU y cuotas de presupuesto. |
| **3. Auditoría Transaccional** | `SUPPLIER#<SupplierID>` | `AUDIT#<AuditID>` | `ENTITY#<SedeID>` | Resultados de 3-Way Match, desvíos y workflows de disputas. |
| **4. Estadísticas Diarias** | `SUPPLIER#<SupplierID>` | `STATS#DAILY#<YYYY-MM-DD>` | `ENTITY#<SedeID>` | Métricas de consumo inmediato y control de fraude/alertas. |
| **5. Estadísticas Semanales** | `SUPPLIER#<SupplierID>` | `STATS#WEEKLY#<YYYY>#W<01-53>` | `ENTITY#<SedeID>` | Previsión de flujo de caja y proyecciones de tesorería. |
| **6. Estadísticas Mensuales** | `SUPPLIER#<SupplierID>` | `STATS#MONTHLY#<YYYY>-<MM>` | `ENTITY#<SedeID>` | Apertura histórica mensual para gráficos del Dashboard. |
| **7. Estadísticas Trimestrales**| `SUPPLIER#<SupplierID>` | `STATS#QUARTERLY#<YYYY>#Q<1-4>` | `ENTITY#<SedeID>` | Reportes financieros trimestrales para control corporativo. |
| **8. Estadísticas Cuatrimestrales**| `SUPPLIER#<SupplierID>` | `STATS#FOUR_MONTH#<YYYY>#4M<1-3>`| `ENTITY#<SedeID>` | Análisis predictivo de agotamiento y comportamiento P90. |
| **9. Estadísticas Semestrales**| `SUPPLIER#<SupplierID>` | `STATS#SEMESTER#<YYYY>#S<1-2>` | `ENTITY#<SedeID>` | Evaluación de performance e indicadores de sourcing indexados. |
| **10. Estadísticas Anuales** | `SUPPLIER#<SupplierID>` | `STATS#ANNUAL#<YYYY>` | `ENTITY#<SedeID>` | Cierre fiscal consolidador e impacto ecológico Scope 3. |

---

## 📄 2. Esquemas JSON de Producción (100% Compatibles con Parsers)

### 2.1 Perfil del Proveedor (`SK: METADATA`)
```json
{
  "PK": "TENANT#11111111#SUPPLIER#SUP-9912",
  "SK": "METADATA",
  "GSI1_PK": "TENANT#11111111#ENTITY#BEER_SHEVA",
  "version_id": 5,                // <--- NUEVO: Control de concurrencia
  "s3_large_payload_ref": null,   // <--- NUEVO: Puntero a S3 si es necesario
  "tenant_id": "11111111",
  "supplier_name": "Aceros del Sur S.A.",
  "tax_id": "30-54321098-9",
  "contact_info": {
    "email": "ops@acerosdelsur.com",
    "phone": "+972-8-1234567",
    "address": "Gav Yam Park, Building 2, Be'er Sheva"
  },
  "strategic_intelligence": {
    "risk_profile": { "score": 85, "level": "LOW", "last_check": "2026-05-28" },
    "payment_strategy": { 
      "early_payment_preferred": true, 
      "discount_target_percentage": 2.0 
    },
    "diversity_status": ["SUSTAINABLE_CERTIFIED"],
    "criticality_index": "HIGH"
  },
  "vendor_performance": {
    "reliability_score": 0.86,
    "total_audited_docs": 142,
    "total_disputes_raised": 14,
    "average_dispute_resolution_days": 5.2,
    "sla_delivery_compliance_rate": 0.91,
    "trend": "IMPROVING" 
  },
  "smart_thresholds": {
    "default_tolerance_percentage": 2.5,
    "categories": {
      "RAW_MATERIALS": 1.5,
      "LOGISTICS": 5.0,
      "MAINTENANCE": 3.0,
      "IT_SERVICES": 2.0
    }
  },
  "metadata": {
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-05-28T12:00:00Z",
    "version": "1.1.0"
  }
}

{
  "PK": "TENANT#11111111#SUPPLIER#SUP-9912",
  "SK": "CONTRACT#CON-2026-X",
  "GSI1_PK": "TENANT#11111111#ENTITY#GLOBAL",
  "version_id": 5,                // <--- NUEVO: Control de concurrencia
  "s3_large_payload_ref": null,   // <--- NUEVO: Puntero a S3 si es necesario
  "tenant_id": "11111111",
  "contract_name": "Contrato Marco de Suministro de Acero v2",
  "status": "ACTIVE",
  "valid_from": "2026-01-01",
  "valid_to": "2026-12-31",
  "currency": "USD",
  "financial_limits": {
    "total_budget_limit": 500000.00,
    "current_burn_rate_usd": 125400.00,
    "allocated_opex_quota": 400000.00,
    "allocated_capex_quota": 100000.00,
    "utilization_percentage": 25.08, 
    "remaining_budget_usd": 374600.00
  },
  "price_book": {
    "SKU-AC-01": {
      "description": "Viga H de Alta Resistencia",
      "unit_price": 45.50,
      "unit": "KG",
      "category": "RAW_MATERIALS",
      "last_price_update": "2026-05-01"
    },
    "SKU-AC-02": {
      "description": "Placa de Acero Inoxidable 2mm",
      "unit_price": 120.00,
      "unit": "M2",
      "category": "RAW_MATERIALS",
      "last_price_update": "2026-05-01"
    },
    "SKU-LOG-01": {
      "description": "Flete de Carga Pesada Regional",
      "unit_price": 350.00,
      "unit": "TRIP",
      "category": "LOGISTICS",
      "last_price_update": "2026-05-01"
    }
  },
  "legal_baseline": {
    "payment_terms_days": 45,
    "early_payment_discount_percentage": 2.0,
    "early_payment_window_days": 10,
    "jurisdiction": "Tel Aviv Courts",
    "penalty_per_delay_day_percentage": 0.5,
    "governance_compliance_score": 0.98
  },
  "predictive_engine": {
    "estimated_depletion_date": "2026-10-14T00:00:00Z",
    "burn_rate_severity": "YELLOW",
    "inflation_adjustment_alert": "2026-11-30",
    "p90_worst_case_spend_usd": 542000.00,
    "contract_drift_risk": "LOW"
  },
  "sustainability_esg": {
    "carbon_budget_co2e_kg": 50000.00,
    "current_usage_co2e_kg": 14520.40,
    "compliance_status": "ON_TRACK"
  },
  "metadata": {
    "s3_signed_contract_pdf": "s3://procuretech-os-vault/contracts/2026/CON-2026-X_SIGNED.pdf",
    "uploaded_by": "diego.liascovich@procuretech.io",
    "timestamp": "2026-01-02T11:24:10Z",
    "last_amendment_date": "2026-05-28T12:00:00Z",
    "amendment_log": "Refactor de precios de transporte"
  }
}

{
  "PK": "TENANT#11111111#SUPPLIER#SUP-9912",
  "SK": "AUDIT#AUD-88319",
  "GSI1_PK": "TENANT#11111111#ENTITY#BEER_SHEVA",
  "version_id": 5,                // <--- NUEVO: Control de concurrencia
  "s3_large_payload_ref": null,   // <--- NUEVO: Puntero a S3 si es necesario
  "tenant_id": "11111111",
  "document_type": "INVOICE",
  "purchase_order_reference": "PO-2026-0041",
  "audit_status": "FLAGGED",
  "extracted_data": {
    "invoice_number": "FC-0004-99211",
    "issue_date": "2026-05-25",
    "due_date": "2026-07-10",
    "currency": "USD",
    "financials_net_amount": 4500.00,
    "financials_tax_amount": 765.00,
    "financials_total_spend": 5265.00,
    "line_items": [
      {
        "sku": "SKU-AC-01",
        "description": "Viga H de Alta Resistencia (Reforzada)",
        "qty": 100,
        "extracted_unit_price": 47.70,
        "total": 4770.00
      }
    ]
  },
  "three_way_matching": {
    "status": "MISMATCH",
    "price_check": "FAILED",
    "quantity_check": "PASSED",
    "po_validation": "PASSED",
    "match_timestamp": "2026-05-28T10:15:22Z"
  },
  "ai_analysis": {
    "price_discrepancy": {
      "detected_overcost_usd": 220.00,
      "deviation_percentage": 4.83,
      "severity_level": "RED",
      "market_benchmark_price": 45.50
    },
    "legal_clause_risk": [
      {
        "clause_type": "PAYMENT_TERMS",
        "baseline_value": "45 days",
        "extracted_value": "30 days",
        "severity": "YELLOW",
        "description": "El emisor alteró el plazo de vencimiento a 30 días, violando los 45 días del acuerdo maestro."
      }
    ],
    "dispute_workflow": {
      "status": "PENDING_REVIEW",
      "generated_email_draft_s3": "s3://procuretech-os-vault/disputes/drafts/AUD-88319_EMAIL.txt",
      "history": [
        { "timestamp": "2026-05-28T10:15:25Z", "action": "SYSTEM_FLAGGED", "user": "AI_ENGINE" }
      ],
      "assigned_to": "FINANCE_DEPT_BEER_SHEVA"
    }
  },
  "analytics": {
    "maverick_spend_flag": false,
    "early_payment_opportunity": true,
    "early_payment_discount_deadline": "2026-06-04T23:59:59Z",
    "potential_early_pay_savings_usd": 105.30,
    "data_integrity_score": 0.6,
    "llm_confidence_score": 0.98,
    "total_co2e_impact_kg": 210.50
  },
  "metadata": {
    "s3_raw_pdf_pointer": "s3://procuretech-os-vault/raw/2026/05/SUP-9912_AUD-88319.pdf",
    "processed_by_lambda": "budget_processor_lambda",
    "timestamp": "2026-05-28T10:15:22Z",
    "extraction_version": "v3.2.0"
  }
}

{
  "PK": "TENANT#11111111#SUPPLIER#SUP-9912",
  "SK": "STATS#DAILY#2026-05-28",
  "GSI1_PK": "TENANT#11111111#ENTITY#BEER_SHEVA",
  "version_id": 5,                // <--- NUEVO: Control de concurrencia
  "s3_large_payload_ref": null,   // <--- NUEVO: Puntero a S3 si es necesario
  "tenant_id": "11111111",
  "granularity": "DAILY",
  "period_id": "2026-05-28",
  "metrics": {
    "total_spend": 5265.00,
    "hard_savings": 220.00,
    "leakage_amount": 45.00,
    "document_count": 1,
    "budget_utilization_rate": 25.08,
    "maverick_spend_total": 0.00
  },
  "audit_control": {
    "unusual_hour_purchase_detected": false,
    "credit_limit_violation_risk": false,
    "three_way_mismatch_count": 1,
    "pending_dispute_value": 220.00,
    "approval_delay_risk": "LOW"
  },
  "budget_allocation": {
    "opex_spent": 5265.00,
    "capex_spent": 0.00,
    "variance_vs_budget": -120.50
  },
  "metadata": {
    "last_updated": "2026-05-28T10:16:00Z",
    "processed_by": "budget_audit_lambda_v2"
  }
}

{
  "PK": "TENANT#11111111#SUPPLIER#SUP-9912",
  "SK": "STATS#WEEKLY#2026#W22",
  "GSI1_PK": "TENANT#11111111#ENTITY#BEER_SHEVA",
  "version_id": 5,                // <--- NUEVO: Control de concurrencia
  "s3_large_payload_ref": null,   // <--- NUEVO: Puntero a S3 si es necesario
  "tenant_id": "11111111",
  "granularity": "WEEKLY",
  "period_id": "2026-W22",
  "metrics": {
    "total_spend": 18450.00,
    "hard_savings": 1400.00,
    "leakage_amount": 120.00,
    "document_count": 3,
    "maverick_spend_total": 0.00,
    "avg_processing_time_days": 1.2
  },
  "cash_flow_projection": {
    "payout_forecast_next_7_days": 12500.00,
    "early_payment_discounts_available": 315.90,
    "total_disputed_amount": 220.00,
    "outstanding_liabilities": 18450.00
  },
  "budget_control": {
    "variance_vs_budget": -450.00,
    "opex_vs_capex_ratio": 0.85,
    "burn_rate_status": "STABLE"
  },
  "metadata": {
    "last_updated": "2026-05-28T12:00:00Z",
    "processed_by": "budget_audit_lambda_v2"
  }
}

{
  "PK": "TENANT#11111111#SUPPLIER#SUP-9912",
  "SK": "STATS#MONTHLY#2026-05",
  "GSI1_PK": "TENANT#11111111#ENTITY#BEER_SHEVA",
  "version_id": 5,                // <--- NUEVO: Control de concurrencia
  "s3_large_payload_ref": null,   // <--- NUEVO: Puntero a S3 si es necesario
  "tenant_id": "11111111",
  "granularity": "MONTHLY",
  "period_id": "2026-05",
  "metrics": {
    "total_spend": 12500.00,
    "hard_savings": 220.00,
    "leakage_amount": 45.00,
    "document_count": 5,
    "maverick_spend_total": 0.00,
    "average_price_deviation": 1.25
  },
  "budget_performance": {
    "variance_vs_budget": -850.50,
    "opex_capex_split": { "opex": 10000.00, "capex": 2500.00 },
    "utilization_trend": "STABLE"
  },
  "audit_summary": {
    "total_disputed_value": 220.00,
    "three_way_mismatch_rate": 0.20,
    "compliance_incidents": 0
  },
  "category_breakdown": {
    "RAW_MATERIALS": { "spend": 9500.00, "count": 3 },
    "LOGISTICS": { "spend": 3000.00, "count": 2 }
  },
  "metadata": {
    "last_updated": "2026-05-28T12:00:00Z",
    "processed_by": "budget_audit_lambda_v2"
  }
}

{
  "PK": "TENANT#11111111#SUPPLIER#SUP-9912",
  "SK": "STATS#QUARTERLY#2026#Q2",
  "GSI1_PK": "TENANT#11111111#ENTITY#BEER_SHEVA",
  "version_id": 5,                // <--- NUEVO: Control de concurrencia
  "s3_large_payload_ref": null,   // <--- NUEVO: Puntero a S3 si es necesario
  "tenant_id": "11111111",
  "granularity": "QUARTERLY",
  "period_id": "2026-Q2",
  "metrics": {
    "total_spend": 134500.00,
    "hard_savings": 8600.00,
    "leakage_amount": 545.00,
    "document_count": 46,
    "avg_invoice_value": 2923.91,
    "maverick_spend_total": 120.00
  },
  "financial_compliance": {
    "budget_burn_rate_percentage": 26.9,
    "approved_vs_disputed_ratio": 0.91,
    "audit_success_rate": 0.94,
    "compliance_risk_score": "LOW"
  },
  "capital_allocation": {
    "opex_total": 105000.00,
    "capex_total": 29500.00,
    "roi_on_savings": 0.064 // Hard savings / Total spend
  },
  "predictive_outlook": {
    "q3_forecast_spend": 142000.00,
    "budget_headroom": 28000.00,
    "trend_analysis": "STABLE"
  },
  "metadata": {
    "last_updated": "2026-05-28T12:00:00Z",
    "auditor_summary": "Q2 within variance limits; no major leakage identified.",
    "processed_by": "budget_audit_lambda_v2"
  }
}

{
  "PK": "TENANT#11111111#SUPPLIER#SUP-9912",
  "SK": "STATS#FOUR_MONTH#2026#4M2",
  "GSI1_PK": "TENANT#11111111#ENTITY#BEER_SHEVA",
  "version_id": 5,                // <--- NUEVO: Control de concurrencia
  "s3_large_payload_ref": null,   // <--- NUEVO: Puntero a S3 si es necesario
  "tenant_id": "11111111",
  "granularity": "FOUR_MONTH",
  "period_id": "2026-4M2",
  "metrics": {
    "total_spend": 134500.00,
    "hard_savings": 8600.00,
    "leakage_amount": 545.00,
    "document_count": 46,
    "spend_acceleration_factor": 1.05,
    "avg_cost_per_document": 2923.91
  },
  "predictive_forecasting": {
    "estimated_depletion_date": "2026-10-14T00:00:00Z",
    "burn_rate_severity": "YELLOW",
    "p90_worst_case_spend_usd": 542000.00,
    "projection_confidence_score": 0.88
  },
  "financial_health": {
    "budget_headroom_remaining": 365500.00,
    "savings_to_spend_ratio": 0.063,
    "contract_viability_status": "HIGH"
  },
  "metadata": {
    "last_updated": "2026-05-28T12:00:00Z",
    "executive_summary": "Cuatrimestre estable; el ritmo de gasto actual sugiere un agotamiento del presupuesto antes del cierre fiscal. Se recomienda revisión de adenda en Q3.",
    "processed_by": "budget_audit_lambda_v2"
  }
}

{
  "PK": "TENANT#11111111#SUPPLIER#SUP-9912",
  "SK": "STATS#SEMESTER#2026#S1",
  "GSI1_PK": "TENANT#11111111#ENTITY#BEER_SHEVA",
  "version_id": 5,                // <--- NUEVO: Control de concurrencia
  "s3_large_payload_ref": null,   // <--- NUEVO: Puntero a S3 si es necesario
  "tenant_id": "11111111",
  "granularity": "SEMESTER",
  "period_id": "2026-S1",
  "metrics": {
    "total_spend": 224000.00,
    "hard_savings": 12800.00,
    "leakage_amount": 1030.00,
    "document_count": 92,
    "avg_savings_rate": 5.71,
    "maverick_spend_total": 450.00
  },
  "sourcing_evaluation": {
    "average_vendor_score": 0.85,
    "contract_drift_percentage": 1.2,
    "compliance_incidents_total": 2,
    "performance_trend": "STABLE"
  },
  "audit_governance": {
    "audit_coverage_percentage": 100,
    "total_disputed_value": 850.00,
    "resolution_efficiency": 0.92
  },
  "financial_outlook": {
    "s2_forecast_spend": 235000.00,
    "budget_variance": -1200.00,
    "contract_renew_recommendation": "PROCEED"
  },
  "metadata": {
    "last_updated": "2026-05-28T12:00:00Z",
    "executive_summary": "S1 finalizado con ahorro del 5.7%. Drift de contrato bajo control. Se recomienda mantener el proveedor para S2 con revisión de SLA trimestral.",
    "processed_by": "budget_audit_lambda_v2"
  }
}