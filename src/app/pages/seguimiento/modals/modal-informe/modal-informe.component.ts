import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Informe, TipoInforme, NivelImpacto, ProyectoService } from 'src/app/services/proyectos.service';
import { SeguimientoStateService } from '../../seguimiento-state.service';
import Swal from 'sweetalert2';

export interface InformeForm {
  titulo:               string;
  descripcion_hallazgo: string;
  tipo:                 TipoInforme;
  tipo_accion?:         string | null;
  nivel_impacto:        NivelImpacto;
  nivel_riesgo:         'Bajo' | 'Medio' | 'Alto' | 'Crítico';
  proceso_id?:          number | null;
  fecha_evento:         string;
  causa_raiz?:          string;
  sistemas_afectados?:  string;
  impacto_negocio?:     string;
  accion_correctiva?:   string;
  accion_preventiva?:   string;
  control_tecnologico?: string;
  fecha_implementacion?: string;
  archivos?:            File[];
}

@Component({
  selector: 'app-modal-informe',
  templateUrl: './modal-informe.component.html',
})
export class ModalInformeComponent implements OnChanges, OnDestroy {
  @Input() show = false;
  @Input() informe: Informe | null = null;
  @Input() saving = false;
  @Input() procesos: { id: number; nombre: string }[] = [];
  @Input() usuarioId = 0;
  @Input() esAdmin = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<InformeForm>();

  form: FormGroup;
  activeTab: 'general' | 'analisis' | 'evidencias' = 'general';
  private editorInstance: any = null;

  // Evidencias (Edición)
  evidencias: any[] = [];
  loadingEvidencias = false;
  verHistoricoEvidencias = false;

  // Archivos pendientes (Creación)
  archivosSeleccionados: File[] = [];

  readonly tipos: TipoInforme[] = [
    'Incidente', 'Hallazgo de Auditoría', 'Riesgo Tecnológico', 
    'Vulnerabilidad de Seguridad', 'Mejora del Proceso'
  ];

  readonly niveles: NivelImpacto[] = ['Crítico', 'Alto', 'Medio', 'Bajo'];

  readonly tiposAccion: string[] = ['ACCIÓN CORRECTIVA', 'CORRECCIÓN', 'ACCIÓN DE MEJORA'];

  constructor(
    private fb: FormBuilder,
    private _proyectoService: ProyectoService,
    public state: SeguimientoStateService
  ) {
    this.form = this.fb.group({
      titulo:               ['', [Validators.required]],
      descripcion_hallazgo: ['', [Validators.required]],
      tipo:                 ['Incidente', [Validators.required]],
      tipo_accion:          [null],
      nivel_impacto:        ['Medio', [Validators.required]],
      nivel_riesgo:         ['Medio', [Validators.required]],
      proceso_id:           [null],
      fecha_evento:         [new Date().toISOString().split('T')[0], [Validators.required]],
      causa_raiz:           [''],
      sistemas_afectados:   [''],
      impacto_negocio:      [''],
      accion_correctiva:    [''],
      accion_preventiva:    [''],
      control_tecnologico:  [''],
      fecha_implementacion: [''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue) {
      this.activeTab = 'general';
      this.archivosSeleccionados = [];
      this.verHistoricoEvidencias = false;

      if (this.informe) {
        this.form.patchValue({
          titulo:               this.informe.titulo,
          descripcion_hallazgo: this.informe.descripcion_hallazgo,
          tipo:                 this.informe.tipo,
          tipo_accion:          this.informe.tipo_accion || null,
          nivel_impacto:        this.informe.nivel_impacto,
          nivel_riesgo:         this.informe.nivel_riesgo || 'Medio',
          proceso_id:           this.informe.proceso_id || null,
          fecha_evento:         this.informe.fecha_evento,
          causa_raiz:           this.informe.causa_raiz || '',
          sistemas_afectados:   this.informe.sistemas_afectados || '',
          impacto_negocio:      this.informe.impacto_negocio || '',
          accion_correctiva:    this.informe.accion_correctiva || '',
          accion_preventiva:    this.informe.accion_preventiva || '',
          control_tecnologico:  this.informe.control_tecnologico || '',
          fecha_implementacion: this.informe.fecha_implementacion || '',
        });
        
        if (this.editorInstance) {
          this.editorInstance.setContent(this.informe.descripcion_hallazgo || '');
        }

        this.cargarEvidencias();
      } else {
        this.evidencias = [];
        this.form.reset({
          titulo: '', descripcion_hallazgo: '', tipo: 'Incidente', tipo_accion: null,
          nivel_impacto: 'Medio', nivel_riesgo: 'Medio', proceso_id: null,
          fecha_evento: new Date().toISOString().split('T')[0],
          causa_raiz: '', sistemas_afectados: '', impacto_negocio: '',
          accion_correctiva: '', accion_preventiva: '', control_tecnologico: '',
          fecha_implementacion: ''
        });
        
        if (this.editorInstance) {
          this.editorInstance.setContent('');
        }
      }

      // Inicializa TinyMCE después de que el elemento textarea se dibuje en el DOM
      setTimeout(() => {
        this.initTinyMCE();
      }, 100);

    } else if (changes['show'] && !changes['show'].currentValue) {
      this.destroyTinyMCE();
    }
  }

  ngOnDestroy(): void {
    this.destroyTinyMCE();
  }

  private initTinyMCE(): void {
    if ((window as any).tinymce) {
      this.setupTinyMCE();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/5.10.9/tinymce.min.js';
      script.onload = () => {
        this.setupTinyMCE();
      };
      document.head.appendChild(script);
    }
  }

  private setupTinyMCE(): void {
    this.destroyTinyMCE();

    (window as any).tinymce.init({
      selector: '#descripcion-hallazgo-editor',
      plugins: 'table code lists link wordcount',
      toolbar: 'undo redo | styleselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table tabledelete | tableprops tablerowprops tablecellprops | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | code removeformat',
      height: 400,
      menubar: 'table edit insert view format tools',
      branding: false,
      setup: (editor: any) => {
        this.editorInstance = editor;
        
        editor.on('init', () => {
          editor.setContent(this.form.get('descripcion_hallazgo')?.value || '');
        });

        editor.on('change keyup undo redo', () => {
          const content = editor.getContent();
          this.form.get('descripcion_hallazgo')?.setValue(content);
          this.form.get('descripcion_hallazgo')?.markAsDirty();
          this.form.get('descripcion_hallazgo')?.markAsTouched();
        });
      }
    });
  }

  private destroyTinyMCE(): void {
    if (this.editorInstance) {
      (window as any).tinymce?.remove(this.editorInstance);
      this.editorInstance = null;
    }
  }

  // ── GESTIÓN DE EVIDENCIAS ────────────────────────────────────────

  cargarEvidencias(): void {
    if (!this.informe) return;
    this.loadingEvidencias = true;
    this._proyectoService.getEvidencias('informe', this.informe.id, this.verHistoricoEvidencias, this.usuarioId).subscribe({
      next: (res) => {
        this.evidencias = res.data || [];
        this.loadingEvidencias = false;
      },
      error: () => {
        this.loadingEvidencias = false;
      }
    });
  }

  onSubirArchivoEdicion(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.informe) return;

    const file = input.files[0];
    this.loadingEvidencias = true;

    this._proyectoService.subirEvidencia('informe', this.informe.id, file, this.usuarioId).subscribe({
      next: () => {
        this.state.showToast('Archivo adjuntado correctamente');
        this.cargarEvidencias();
        input.value = '';
      },
      error: (err) => {
        this.loadingEvidencias = false;
        const msg = err.error?.message || 'Error al subir archivo';
        this.state.showToast(msg, 'error');
        input.value = '';
      }
    });
  }

  onSeleccionarArchivos(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    for (let i = 0; i < input.files.length; i++) {
      this.archivosSeleccionados.push(input.files[i]);
    }
    input.value = '';
  }

  quitarArchivo(index: number): void {
    this.archivosSeleccionados.splice(index, 1);
  }

  verEvidencia(ev: any): void {
    this._proyectoService.getUrlEvidencia(ev.id).subscribe({
      next: (res) => {
        if (res.url) {
          window.open(res.url, '_blank');
        } else {
          this.state.showToast('Archivo no disponible', 'error');
        }
      },
      error: () => this.state.showToast('Error al obtener URL del archivo', 'error')
    });
  }

  deshabilitarEvidencia(ev: any): void {
    Swal.fire({
      title: '¿Deshabilitar archivo?',
      text: 'El archivo permanecerá en el histórico pero se ocultará del listado activo.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, deshabilitar',
      cancelButtonText: 'Cancelar'
    }).then((r) => {
      if (r.isConfirmed) {
        this._proyectoService.eliminarEvidencia(ev.id, this.usuarioId).subscribe({
          next: () => {
            this.state.showToast('Archivo deshabilitado');
            this.cargarEvidencias();
          },
          error: (err) => {
            const msg = err.error?.message || 'No se pudo deshabilitar';
            this.state.showToast(msg, 'error');
          }
        });
      }
    });
  }

  restaurarEvidencia(ev: any): void {
    this._proyectoService.restaurarEvidencia(ev.id, this.usuarioId).subscribe({
      next: () => {
        this.state.showToast('Archivo restaurado');
        this.cargarEvidencias();
      },
      error: (err) => {
        const msg = err.error?.message || 'No se pudo restaurar';
        this.state.showToast(msg, 'error');
      }
    });
  }

  getIconoArchivo(mime?: string): string {
    if (!mime) return 'bi bi-file-earmark text-gray-500';
    if (mime.includes('image')) return 'bi bi-file-earmark-image text-purple-600';
    if (mime.includes('pdf')) return 'bi bi-file-earmark-pdf text-red-600';
    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet') || mime.includes('csv')) return 'bi bi-file-earmark-excel text-emerald-600';
    if (mime.includes('word') || mime.includes('document')) return 'bi bi-file-earmark-word text-blue-600';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('compressed')) return 'bi bi-file-earmark-zip text-amber-600';
    return 'bi bi-file-earmark-text text-gray-600';
  }

  submit(): void {
    if (this.form.invalid || this.saving) return;
    const value: InformeForm = {
      ...this.form.value,
      archivos: this.archivosSeleccionados
    };
    this.onGuardar.emit(value);
  }
}
