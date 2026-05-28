# ProcureTech OS - Matriz Completa de Inteligencia Analítica (54 Preguntas Core)

Este documento contiene la especificación técnica, de base de datos y de negocio para las capas Descriptiva, Predictiva y Prescriptiva del sistema de auditoría automatizada.

---

## 📊 Capa Descriptiva: "La Verdad Contractual y Financiera" (24 Preguntas)

**Objetivo:** Consolidar la realidad factual de los documentos procesados para ofrecer visibilidad histórica y auditoría exacta.
**Procedimiento General:** Ingesta de PDFs → Extracción vía LLM Structured Outputs → Escritura y agregación en el ítem de estadísticas mensuales/anuales (`SUPPLIER#ID` / `STATS#YEAR`).

### I. Consumo, Gastos y Benchmarking (Finanzas y Eficiencia)

| # | Pregunta de Negocio | Alcance (Nivel de Filtro) | Atributo / Lógica DynamoDB | Procedimiento Técnico (Cálculo Dinámico) |
|---|---------------------|---------------------------|----------------------------|------------------------------------------|
| **1** | ¿Cuál es el desvío de precio por ítem/SKU? | Por Proveedor / Contrato | `price_discrepancy` | Mapeo directo: (Precio Factura - Precio Contrato Marco) por unidad de ítem. |
| **2** | ¿Gasto total fuera de contrato (Maverick Spend)? | Por Unidad de Negocio / Mensual | `SK: AUDIT#ID` | Sumatoria de los montos de ítems facturados que **no existen** en el tarifario del Contrato Base. |
| **3** | Benchmarking de Proveedores | Comparativo (Cross-Supplier) | `vendor_performance.score` | Ratio: Cantidad de auditorías exitosas sin errores / Total de documentos procesados en el año. |
| **4** | ¿Gasto por Categoría de Insumo? | Por Edificio / Periodo | `category_spend` | Agregación por categorías de compra (Materia Prima, Logística, IT) filtrada por `Entity_ID`. |
| **5** | ¿Costo de compras por metro cuadrado? | Por Edificio / Mes | `entity_specs.m2` | Gasto total de la ubicación / superficie operativa registrada en el maestro de la sede. |
| **6** | ¿Optimización Tarifaria Histórica? | Por Punto de Suministro | `tariff_structure` | Stress Test: Simular el historial de compras de la sede aplicando las reglas de otros proveedores del mercado. |
| **7** | ¿Ahorro Realizado Efectivo (Avoided Cost)? | Por Proyecto / Acumulado | `ai_analysis.savings` | Cálculo matemático: (Precio de Lista/Cotización Original - Precio Real Auditado y Pagado). |
| **8** | ¿Elasticidad Gasto/Volumen de Producción? | Por Planta / Lote | `production_logs` | Correlación estadística entre el output de la planta y el gasto devengado en órdenes de compra de insumos. |

### II. Operaciones y Cumplimiento de Procesos (Piso de Planta)

| # | Pregunta de Negocio | Alcance (Nivel de Filtro) | Atributo / Lógica DynamoDB | Procedimiento Técnico (Cálculo Dinámico) |
|---|---------------------|---------------------------|----------------------------|------------------------------------------|
| **9** | Error de Conciliación (3-Way Match Error) | Por Factura / Orden de Compra | `three_way_match_status` | Balance de Masas: Diferencial exacto entre Cantidad Facturada vs. Cantidad Recibida vs. Cantidad Pedida. |
| **10** | Cumplimiento de Plazos de Aprobación | Por Comprador / Turno | `operational_params.status` | Medición de horas/días en estado `PENDING` antes de pasar a `APPROVED` en el flujo de trabajo. |
| **11** | ¿Compras en Horario Crítico o Cierre? | Por Sucursal / Horas Cierre | `operational_params.hours` | Sumatoria de montos en Órdenes de Compra emitidas fuera del horario operativo estándar de la sucursal. |
| **12** | ¿Eficiencia en la Distribución de Órdenes? | Por Topología de Compras | `topology` (Nodos P/H) | Comparativa de pérdidas económicas por compras fragmentadas en sub-entidades en lugar de contratos corporativos. |
| **13** | Uso bajo Contrato Nominal | Por Proveedor / Contrato | `tech_specs.nominal_volume` | Divides el volumen de compra actual entre la capacidad nominal pactada. Evalúa sub-utilización de cupos. |
| **14** | Impacto de Variación en Términos comerciales | Por Contrato / Vida Útil | `contract_drift` | Conteo de modificaciones menores en adendas que degradan progresivamente el margen inicial del contrato. |
| **15** | ¿Costo de Procrastinación en Compras? | Por Gerencia / Semanal | `ai_analysis.pending` | Σ Ahorro perdido debido a alertas de sobrecosto detectadas por la IA que no fueron ejecutadas a tiempo. |
| **16** | Costo de Ineficiencia Logística No Aprovechada | Por Sede / Fuera de Horario | `logistics_params` | Monetización de penalizaciones por recepción de mercancía fuera de las ventanas horarias pactadas. |

### III. Sostenibilidad, Riesgo Legal y Calidad del Dato (ESG & Compliance)

| # | Pregunta de Negocio | Alcance (Nivel de Filtro) | Atributo / Lógica DynamoDB | Procedimiento Técnico (Cálculo Dinámico) |
|---|---------------------|---------------------------|----------------------------|------------------------------------------|
| **17** | Trazabilidad de Riesgo Legal | Por Contrato / Categoría | `legal_clause_risk.severity`| Conteo y clasificación de cláusulas abusivas o modificadas en texto libre extraídas por el LLM. |
| **18** | Trazabilidad ESG / Huella de Carbono del Gasto | Por Org / Año Fiscal | `factor_identity` | Monto de compra por categoría × factor de emisión de CO2e vigente para el tipo de insumo y proveedor. |
| **19** | ¿Intensidad de Carbono por Producto Adquirido?| Por Línea de Producción | `ghg_total_co2e_kg` | Emisiones totales de la cadena de suministro en el intervalo / Unidades finales reportadas en el log. |
| **20** | ¿Cumplimiento Normativo (Compliance)? | Por Jurisdicción / Anual | `regulatory_compliance` | Monitor de umbrales legales y contratos mínimos para cumplir con leyes locales de compras o cuotas de mercado. |
| **21** | ¿Brecha hacia Metas Net Zero Corporativas? | Por Corporativo / Anual | `sustainability_standards` | Gap Analysis: % de avance en la reducción de Scope 3 (proveedores) frente al presupuesto de carbono objetivo. |
| **22** | ¿Calidad e Integridad del Dato Extraído? | Por Fuente / Periodo | `audit_trail.reliability` | Reliability Score: % de confianza promedio devuelto por el LLM en el análisis estructurado de PDFs. |
| **23** | Análisis de Sensibilidad Macroeconómica | Por Región Geográfica | `location_context` | Normalización de tarifas: Ajuste automático del gasto real indexando inflación y fluctuación de divisas locales. |
| **24** | Integridad de la Cadena de Custodia del Gasto | Por Auditoría / Archivo | `audit_trail.validity` | Verificación de respaldo: % de registros respaldados por evidencia física inalterable (Hash criptográfico / API). |

---

## 📈 Capa Predictiva: "El Radar de Fugas y Riesgos" (20 Preguntas)

**Objetivo:** Anticipación de pasivos financieros, proyecciones de caja para el CFO y detección temprana de anomalías.
**Procedimiento General:** Extracción de series temporales de gastos (`STATS#YEAR`) + Historial de auditorías → Inferencia vía Lambda (`assistant_lambda` / AWS Bedrock) → Escritura en el objeto `predictive_engine`.

### I. Mantenimiento del Sourcing y Activos Contractuales (CAPEX Predictivo)

| # | Pregunta de Negocio | Horizonte de Valor | Atributo / Lógica DynamoDB | Procedimiento de Inferencia e IA |
|---|---------------------|--------------------|----------------------------|----------------------------------|
| **25** | Vida Útil Remanente del Contrato (RUL) | Cuatrimestral / Anual | `lifecycle` + `drift_score` | Algoritmo de degradación de márgenes comerciales: Estima cuándo el contrato dejará de ser rentable. |
| **26** | Predicción de Degradación de Eficiencia (Drift) | Plurianual | `energy_intensity` histórico | Modelado de Baselines: Predice cuándo un acuerdo de nivel de servicio (SLA) fallará por obsolescencia. |
| **27** | Valor de Reventa Proyectado de Activos / Stock | Estratégico (5+ años) | `lifecycle` + `technical_specs` | Inferencia de Valor Residual: Estima la depreciación de materiales almacenados según condiciones de la cadena. |
| **28** | Simulación de Escenarios "What-If" de Expansión | Estratégico | `topology` + `building_info` | Gemelo Digital (Digital Twin): Predice la huella de gasto y carbono de una nueva sede clonando sedes similares. |
| **29** | ROI Proyectado de Mejoras en Proveedores | Anual / Plurianual | `ai_analysis.savings` | Inferencia de Medición y Verificación (M&V): Predice el ahorro contractual futuro antes de firmar cambios de vendor. |

### II. Finanzas, Presupuesto y Cash Flow (OPEX)

| # | Pregunta de Negocio | Horizonte de Valor | Atributo / Lógica DynamoDB | Procedimiento de Inferencia e IA |
|---|---------------------|--------------------|----------------------------|----------------------------------|
| **30** | ¿Pronóstico de Cierre de Gasto (OPEX Forecast)? | Mensual / Cuatrimestral | `predictive_engine.forecast` | Modelos de Series Temporales (Prophet): Proyecta el gasto al cierre de mes según estacionalidad y OCs abiertas. |
| **31** | Simulación de Agotamiento Presupuestario | Mensual / Cuatrimestral | `budget_config` | Simulación Monte Carlo: 10,000 iteraciones para estimar la probabilidad (%) de quemar el presupuesto antes de tiempo. |
| **32** | Impacto Inflacionario en el OPEX de Compras | Estratégico (1-3 años) | `financials` / `historical_rates` | Series Temporales Exógenas: Proyección del impacto de índices de precios de commodities en el costo futuro. |
| **33** | Previsión de Flujo de Caja (Cash Flow Payouts) | Mensual (Táctico) | `trazabilidad_total_invoices` | Estimación de Pasivos: Predice la fecha exacta y monto probable de las próximas 3 facturas para tesorería. |
| **34** | Análisis de Sensibilidad de Producción y Suministro| Cuatrimestral | `production_logs` | Inferencia de Elasticidad: Predice el incremento del gasto en insumos si se añade un tercer turno de fabricación. |

### III. Operaciones, Riesgos Tácticos y ESG

| # | Pregunta de Negocio | Horizonte de Valor | Atributo / Lógica DynamoDB | Procedimiento de Inferencia e IA |
|---|---------------------|--------------------|----------------------------|----------------------------------|
| **35** | Prevención de Multas por Sobregasto de Cupos | Táctico (Horas) | `technical_constraints` | Peak Load Forecasting: Predice si las órdenes del día violarán los límites de crédito o volumen acordados. |
| **36** | Optimización de Arbitraje de Compras (VPP) | Mensual / Semanal | `tariff_structure` | Inferencia de Arbitraje: Predice ventanas de precio variable para recomendar emitir OCs en momentos óptimos. |
| **37** | Predicción de Recargos por Incumplimiento Logístico| Táctico (Mes) | `reactive_energy` logístico | Inferencia de Riesgo Operativo: Alerta temprana sobre la necesidad de diversificar transportistas para evitar multas. |
| **38** | Predicción de Riesgo de Auditoría Financiera | Anual / Cuatrimestral | `audit_trail` / `validity` | Detección de Anomalías en Integridad: IA que detecta discrepancias proyectadas entre facturas estimadas y reales. |
| **39** | Probabilidad de Incumplimiento de Metas ESG | Anual | `sustainability_standards` | Backtesting Predictivo: Evalúa si el ritmo de compra de insumos tradicionales impedirá alcanzar la meta anual. |
| **40** | Planificación de Reservas de Capital (P90) | Anual | `predictive_engine.p90` | Estadística Bayesiana: Determina el escenario de gasto "Casi Peor" para asegurar fondos en periodos de volatilidad. |
| **41** | Seguridad de Operación (Anomalías de Compra) | Táctico / Tiempo Real | `analytics.is_anomaly` | Unsupervised Learning: Identificación de solicitudes de compra fuera de patrón que predicen fraude o duplicación. |
| **42** | Valor en Riesgo de Carbono (VaR Financiero) | Estratégico (5+ años) | `ghg_total_co2e` | Shadow Pricing: Proyección del costo impositivo de emisiones futuras basado en curvas de bonos de carbono. |
| **43** | Optimización de Turnos de Abastecimiento | Cuatrimestral | `operational_context` | Optimización Multiobjetivo: Recomendar ventanas de suministro de menor costo y mayor velocidad logística. |
| **44** | Detección de Degradación de Eficiencia del Vendor | Plurianual | `energy_drift` del proveedor | Modelado de Baselines: Predice en qué punto un proveedor estratégico perderá competitividad frente al mercado. |

---

## 🛠️ Capa Prescriptiva: "Estrategia de Optimización y ROI" (10 Preguntas)

**Objetivo:** Generar acciones correctivas automáticas con impacto financiero directo.
**Procedimiento General:** Comparación de "Estado Actual" vs "Estado Ideal" (`Smart Thresholds`) → Inyección de recomendaciones en `ai_analysis` (`status: PENDING`).

### I. Tarjetas de Acción (Action Cards)

| # | Pregunta de Negocio (Prescriptiva) | Lógica DynamoDB | Recomendación de Acción (Output del Sistema) | Impacto / ROI |
|---|-----------------------------------|-----------------|---------------------------------------------|---------------|
| **45**| Optimización de Sourcing (Best Run) | `price_discrepancy` | *"Ajustar pedidos al Proveedor B; replica el perfil de costos del mejor mes histórico de la compañía."* | ↑ 15% Eficiencia de compra. |
| **46**| Prevención de Multas en Tiempo Real | `technical_constraints`| *"Bloquear emisión de la OC [X] durante las próximas 2 horas para mantener la demanda bajo el límite de crédito."*| Evita multa por sobregiro inmediata. |
| **47**| Costo de Inacción Contractual | `baseline_adj` | *"La discrepancia de precio en la línea 4 cuesta $150/hora. Aprobar la disputa hoy evita una pérdida acumulada mayor."*| Ahorro OPEX directo en la factura. |
| **48**| Acción de Oro: Pronto Pago | `early_payment_discount`| *"Liberar pago de Factura #102 antes del viernes. Aplica la cláusula de descuento del 3%, ahorrando $4,500 USD."* | Retorno financiero inmediato de tesorería. |
| **49**| Rebalanceo de Cargas de Compra | `vendor_performance` | *"Mover el 20% del volumen del insumo X de la Fase A a la C. El desbalance actual causa recargos logísticos del 5%."* | Protección del margen operativo. |
| **50**| Conversión de OPEX a CAPEX (Sourcing Largo Plazo) | `utility_bill` (Histórico) | *"Sustituir compras spot de material por un contrato de suministro a 3 años. El Payback estimado del acuerdo es de 1.2 años."*| Reducción drástica de costos variables. |

### II. Alertas Inmediatas de Mitigación (Tiempo Real)

| # | Alerta Crítica (Trigger) | Infraestructura de Disparo | Lógica Operativa del Backend | Objetivo de Negocio |
|---|---------------------------|----------------------------|------------------------------|---------------------|
| **51**| Fuga Crítica de Capital (Mismatch) | DynamoDB Streams → Lambda | Si en una auditoría el desvío supera el umbral máximo severo, se bloquea el estado de pago. | Mitigación inmediata de cobros indebidos. |
| **52**| Penalidad Inminente (SLA de Contrato) | EventBridge Scheduled Task | Monitoreo de fechas de entrega. Si un ítem clave entra en zona de retraso, se dispara alerta de penalización. | Ejecución proactiva de multas al vendor. |
| **53**| Seguimiento Excedido de Presupuesto ESG | DynamoDB Streams → AppSync | Comparación en tiempo real del acumulado de `ghg_total_co2e` contra el presupuesto de carbono anual. | Previene penalizaciones ambientales. |
| **54**| Anomalía Crítica Detectada por IA | Lambda Inference Engine | Un modelo de Unsupervised Learning detecta una factura con estructura o ítems ajenos a la firma comercial usual. | Bloqueo preventivo por sospecha de fraude. |