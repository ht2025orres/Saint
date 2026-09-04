import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { DocumentoFirmaService, DocumentoFirmaEtiqueta } from 'src/app/services/documento-firma.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-gestion-etiquetas',
  templateUrl: './modal-gestion-etiquetas.component.html',
  styleUrls: ['./modal-gestion-etiquetas.component.css']
})
export class ModalGestionEtiquetasComponent implements OnInit, OnChanges {
  @Input() visible: boolean = false;
  @Output() cerrar = new EventEmitter<void>();
  @Output() etiquetasCambiada = new EventEmitter<void>();

  etiquetas: DocumentoFirmaEtiqueta[] = [];
  procesos: any[] = [];
  loading: boolean = false;
  submitting: boolean = false;
  searchFilter: string = '';

  // Form properties for Create / Edit
  editingId: number | null = null;
  nombre: string = '';
  procesoId: number | null = null;
  color: string = '#2563eb';

  // Palette colors
  readonly colorPalette: string[] = [
    '#2563eb', // Blue
    '#059669', // Emerald
    '#d97706', // Amber
    '#e11d48', // Rose
    '#7c3aed', // Purple
    '#0284c7', // Sky
    '#0d9488', // Teal
    '#475569'  // Slate
  ];

  constructor(private docFirmaService: DocumentoFirmaService) {}

  ngOnInit(): void {
    if (this.visible) {
      this.cargarDatos();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.cargarDatos();
    }
  }

  cargarDatos(): void {
    this.loading = true;
    this.docFirmaService.getEtiquetas().subscribe({
      next: (res: any) => {
        this.etiquetas = res.data ?? [];
        this.loading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.loading = false;
      }
    });

    this.docFirmaService.getProcesos().subscribe({
      next: (res: any) => {
        this.procesos = res.data ?? [];
      },
      error: (err: any) => console.error(err)
    });
  }

  get etiquetasFiltradas(): DocumentoFirmaEtiqueta[] {
    if (!this.searchFilter.trim()) return this.etiquetas;
    const term = this.searchFilter.toLowerCase();
    return this.etiquetas.filter(e => 
      e.nombre.toLowerCase().includes(term) ||
      (e.proceso && e.proceso.nombre.toLowerCase().includes(term))
    );
  }

  guardar(): void {
    if (!this.nombre.trim()) {
      Swal.fire('Atención', 'Ingresa el nombre de la etiqueta.', 'warning');
      return;
    }

    this.submitting = true;
    if (this.editingId) {
      this.docFirmaService.actualizarEtiqueta(this.editingId, this.nombre, this.procesoId || undefined, this.color).subscribe({
        next: (res: any) => {
          this.submitting = false;
          Swal.fire('Actualizado', 'Etiqueta actualizada con éxito.', 'success');
          this.resetForm();
          this.cargarDatos();
          this.etiquetasCambiada.emit();
        },
        error: (err: any) => {
          this.submitting = false;
          Swal.fire('Error', err.error?.message || 'No fue posible actualizar la etiqueta.', 'error');
        }
      });
    } else {
      this.docFirmaService.crearEtiqueta(this.nombre, this.procesoId || undefined, this.color).subscribe({
        next: (res: any) => {
          this.submitting = false;
          Swal.fire('Creada', 'Etiqueta creada con éxito.', 'success');
          this.resetForm();
          this.cargarDatos();
          this.etiquetasCambiada.emit();
        },
        error: (err: any) => {
          this.submitting = false;
          Swal.fire('Error', err.error?.message || 'No fue posible crear la etiqueta.', 'error');
        }
      });
    }
  }

  editar(etiq: DocumentoFirmaEtiqueta): void {
    this.editingId = etiq.id || null;
    this.nombre = etiq.nombre;
    this.procesoId = etiq.proceso_id || null;
    this.color = etiq.color || '#2563eb';
  }

  eliminar(id: number): void {
    Swal.fire({
      title: '¿Eliminar Etiqueta?',
      text: 'La etiqueta se desvinculará de los documentos asociados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e11d48'
    }).then((result) => {
      if (result.isConfirmed) {
        this.docFirmaService.eliminarEtiqueta(id).subscribe({
          next: () => {
            Swal.fire('Eliminada', 'La etiqueta ha sido eliminada.', 'success');
            this.cargarDatos();
            this.etiquetasCambiada.emit();
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar la etiqueta', 'error');
          }
        });
      }
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.nombre = '';
    this.procesoId = null;
    this.color = '#2563eb';
  }
}
