import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, map } from 'rxjs';
import { BudgetService } from './budget.service';

export interface UploadResult {
  s3Url: string;
  key: string;
}

/**
 * Orquesta el flujo:
 *  1. Pedir pre-signed URL al `signer_lambda` vía AppSync.
 *  2. Subir el PDF directo a S3 (PUT) usando la URL firmada.
 *  3. Devolver el `s3Url` para usar luego en la mutation `auditBudget`.
 */
@Injectable({ providedIn: 'root' })
export class BudgetUploadService {
  private readonly budgetService = inject(BudgetService);
  private readonly http = inject(HttpClient);

  uploadPdf(supplierId: string, file: File): Observable<UploadResult> {
    return this.budgetService
      .signUpload({
        supplierId,
        fileName: file.name,
        contentType: file.type || 'application/pdf',
      })
      .pipe(
        switchMap((signed) =>
          this.http
            .put(signed.uploadUrl, file, {
              headers: { 'Content-Type': file.type || 'application/pdf' },
              observe: 'response',
            })
            .pipe(map(() => ({ s3Url: signed.s3Url, key: signed.key }))),
        ),
      );
  }
}
