# ProcureTech OS - Glosario de Auditoría de Presupuestos y Contratos

### 🔍 Control y Conciliación Financiera (Auditing Core)
* **Three-Way Matching (Conciliación de 3 Vías):** Proceso de control automatizado que cruza de forma exacta tres documentos clave del ciclo de compras antes de autorizar un pago: el Contrato Base o Tarifario (precios pactados), la Orden de Compra (cantidades solicitadas) y la Factura o Presupuesto final emitido por el proveedor.
* **Maverick Spend (Gasto Fuera de Contrato):** Compras de bienes, insumos o servicios realizadas por empleados o sucursales fuera de los acuerdos corporativos, tarifas negociadas o proveedores homologados vigentes, generando pérdidas por falta de economías de escala.
* **Price Discrepancy (Desvío de Precio):** La diferencia financiera exacta (porcentual o monetaria) entre el precio unitario de un SKU cobrado en la factura/presupuesto actual y el precio de referencia previamente pactado en el Contrato Marco.
* **Smart Thresholds (Umbrales de Tolerancia):** Reglas de negocio paramétricas configuradas por categoría de compra. Definen los márgenes aceptables para desvíos de precios, clasificándolos automáticamente en niveles:
    * *Verde:* Sin desvíos o dentro del margen óptimo.
    * *Amarillo:* Desvío mínimo; activa pre-aprobación autónoma para no detener la operación.
    * *Rojo:* Desvío crítico; bloquea el documento y requiere intervención o disputa.
* **Leakage Rate (Índice de Fuga de Capital):** Porcentaje de dinero que se "pisa" o se pierde en aprobaciones que, aunque están dentro de los umbrales permitidos (alertas amarillas), representan un gasto extra acumulado por encima de la tarifa base óptima.
* **Hard Savings (Ahorro Realizado Efectivo):** El monto total en USD que el sistema detectó como sobrecosto factual y que fue frenado, rechazado o renegociado exitosamente gracias a la aplicación de las alertas de auditoría.
* **CFO Cash Flow Forecast (Previsión de Flujo de Caja):** Proyección matemática y predictiva basada en los plazos contractuales (`payment_terms`) y las órdenes de compra abiertas, calculando la fecha exacta y el monto probable de los próximos desembolsos para optimizar la tesorería.

### 📜 Cumplimiento y Gestión Legal (Contract Compliance)
* **Baseline Contract (Contrato Línea Base):** El documento contractual maestro indexado en el sistema que contiene los términos legales originales, penalizaciones por incumplimiento de SLA, condiciones de pago y el tarifario inicial acordado con el proveedor.
* **Contract Drift (Degradación Contractual):** La pérdida progresiva de margen económico o la adición silenciosa de riesgos legales debido a pequeñas modificaciones aplicadas de forma acumulativa en adendas, anexos o cotizaciones en texto libre.
* **Legal Clause Risk (Riesgo de Cláusula Legal):** Alerta emitida por el motor de IA cuando detecta que el texto de un presupuesto o contrato actual altera las responsabilidades de indemnización, los plazos de garantía o la jurisdicción legal acordada en el documento base.
* **AI Dispute Workflow (Flujo de Disputa Automatizado):** Orquestación digital que se activa ante un sobrecosto no tolerable. El sistema redacta de forma autónoma el correo formal de reclamo administrativo para el proveedor, adjuntando la evidencia de las discrepancias en un reporte PDF.
* **Early Payment Discount (Descuento por Pronto Pago):** Cláusula contractual que estipula una reducción porcentual en el costo total de la factura si el pago se libera antes de una fecha determinada (ej. 3% de descuento si se paga en los primeros 10 días).

### 🛠️ Integridad y Estructura de Datos (Data Architecture)
* **Structured Outputs (Salidas Estructuradas de IA):** Tecnología de integración con LLMs (como Claude o GPT vía Bedrock) que obliga al modelo a extraer los ítems y cláusulas del PDF bajo un esquema JSON estricto y tipado, garantizando que los datos ingresen al backend sin errores de formato.
* **Single-Table Design (Diseño de Tabla Única):** Patrón de modelado NoSQL en DynamoDB donde proveedores, contratos y auditorías coexisten en la misma tabla. Utiliza claves compuestas (`PK: SUPPLIER#ID` y `SK: AUDIT#ID`) para consolidar todo el historial de compras con un rendimiento constante de $O(1)$.
* **Data Integrity Score (Ponderación de Confianza):** Índice automatizado que mide la confiabilidad del origen de un dato para auditoría legal:
    * *Confianza 1.0:* Conexión directa vía API con el ERP (SAP/Oracle).
    * *Confianza 0.8:* Documentos firmados digitalmente.
    * *Confianza 0.6:* PDFs escaneados o subidos de forma manual que requieren validación por IA.