import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { LocalItem, ItemArchivo } from '../../costeo-form/costeo-form.component';
import { FileService } from '../../../../services/file.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-item-notes-modal',
  templateUrl: './item-notes-modal.component.html',
  styleUrls: ['./item-notes-modal.component.css']
})
export class ItemNotesModalComponent implements OnInit {
  @Input() item: LocalItem | null = null;
  @Output() onClose = new EventEmitter<void>();
  @Output() onSave = new EventEmitter<void>();

  isUploading = false;

  constructor(private fileService: FileService) { }

  ngOnInit(): void {
    if (this.item) {
      if (this.item.observaciones === undefined) {
        this.item.observaciones = '';
      }
      if (!this.item.archivos) {
        this.item.archivos = [];
      }
    }
  }

  close(): void {
    this.onSave.emit();
    this.onClose.emit();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    this.uploadFilesSequentially(files, 0);
    input.value = '';
  }

  private uploadFilesSequentially(files: File[], index: number): void {
    if (index >= files.length) {
      this.isUploading = false;
      this.onSave.emit();
      return;
    }

    const file = files[index];
    this.isUploading = true;

    if (file.size > 50 * 1024 * 1024) {
      Swal.fire('Archivo muy pesado', `El archivo "${file.name}" supera el límite de 50MB`, 'warning');
      this.uploadFilesSequentially(files, index + 1);
      return;
    }

    const path = 'comerciales/solicitudes/items';
    this.fileService.uploadFile(file, path).subscribe({
      next: (res) => {
        if (this.item) {
          if (!this.item.archivos) this.item.archivos = [];
          this.item.archivos.push({
            nombre: file.name,
            path: res.url,
            tipo: file.type || 'application/octet-stream',
            size: file.size,
            url_descarga: res.temporary_url || undefined,
          });
        }
        this.uploadFilesSequentially(files, index + 1);
      },
      error: (err) => {
        console.error('Error subiendo archivo', err);
        Swal.fire('Error', `No se pudo subir "${file.name}" al bucket`, 'error');
        this.uploadFilesSequentially(files, index + 1);
      }
    });
  }

  removeFile(fileIndex: number): void {
    if (!this.item || !this.item.archivos || !this.item.archivos[fileIndex]) return;

    const file = this.item.archivos[fileIndex];
    Swal.fire({
      title: '¿Eliminar archivo?',
      text: `Se eliminará "${file.nombre}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (result.isConfirmed) {
        this.item!.archivos!.splice(fileIndex, 1);
        this.onSave.emit();
        if (file.path) {
          this.fileService.deleteFile(file.path).subscribe({
            error: () => { }
          });
        }
      }
    });
  }

  formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  isImageFile(tipo?: string, nombre?: string): boolean {
    if (tipo && tipo.startsWith('image/')) return true;
    if (nombre && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(nombre)) return true;
    return false;
  }

  getFileIconClass(tipo?: string, nombre?: string): string {
    const ext = nombre ? nombre.split('.').pop()?.toLowerCase() : '';
    if (this.isImageFile(tipo, nombre)) return 'bi-file-earmark-image text-blue-500';
    if (tipo === 'application/pdf' || ext === 'pdf') return 'bi-file-earmark-pdf-fill text-rose-500';
    if (ext === 'doc' || ext === 'docx') return 'bi-file-earmark-word-fill text-blue-600';
    if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'bi-file-earmark-excel-fill text-emerald-600';
    if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'bi-file-earmark-zip-fill text-amber-600';
    return 'bi-file-earmark-text text-slate-500';
  }
}

