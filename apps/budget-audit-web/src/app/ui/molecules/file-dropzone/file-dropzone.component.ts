import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * MOLECULE — Dropzone puro. Recibe el archivo seleccionado por drag&drop o
 * clic y lo emite hacia el padre. No conoce S3 ni AppSync: es agnóstico
 * al destino del archivo.
 */
@Component({
  selector: 'app-file-dropzone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-dropzone.component.html',
  styleUrl: './file-dropzone.component.scss',
})
export class FileDropzoneComponent {
  readonly accept = input<string>('application/pdf,image/png,image/jpeg');
  readonly disabled = input<boolean>(false);
  readonly maxSizeMb = input<number>(15);
  readonly hint = input<string>('PDF, PNG o JPG · hasta 15 MB');

  readonly fileSelected = output<File>();
  readonly fileRejected = output<{ file: File; reason: string }>();

  protected readonly isDragging = signal(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly fileName = computed(() => this.selectedFile()?.name ?? null);
  protected readonly fileSize = computed(() => {
    const f = this.selectedFile();
    if (!f) return null;
    return `${(f.size / 1024 / 1024).toFixed(2)} MB`;
  });

  protected openPicker(): void {
    if (this.disabled()) return;
    this.inputRef().nativeElement.click();
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
    input.value = '';
  }

  @HostListener('dragover', ['$event'])
  protected onDragOver(event: DragEvent): void {
    if (this.disabled()) return;
    event.preventDefault();
    this.isDragging.set(true);
  }

  @HostListener('dragleave', ['$event'])
  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  @HostListener('drop', ['$event'])
  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (this.disabled()) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
  }

  private handleFile(file: File): void {
    const sizeMb = file.size / 1024 / 1024;
    if (sizeMb > this.maxSizeMb()) {
      this.fileRejected.emit({
        file,
        reason: `Archivo demasiado grande (${sizeMb.toFixed(2)} MB). Máximo ${this.maxSizeMb()} MB.`,
      });
      return;
    }

    const acceptedTypes = this.accept().split(',').map((t) => t.trim());
    if (file.type && !acceptedTypes.includes(file.type)) {
      this.fileRejected.emit({
        file,
        reason: `Tipo de archivo no permitido: ${file.type}`,
      });
      return;
    }

    this.selectedFile.set(file);
    this.fileSelected.emit(file);
  }
}
