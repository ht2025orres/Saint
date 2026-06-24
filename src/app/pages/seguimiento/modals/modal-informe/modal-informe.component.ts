import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Informe, TipoInforme, NivelImpacto } from 'src/app/services/proyectos.service';

export interface InformeForm {
  titulo:               string;
  descripcion_hallazgo: string;
  tipo:                 TipoInforme;
  nivel_impacto:        NivelImpacto;
  fecha_evento:         string;
  causa_raiz?:          string;
  sistemas_afectados?:  string;
  impacto_negocio?:     string;
  accion_correctiva?:   string;
  accion_preventiva?:   string;
  control_tecnologico?: string;
  fecha_implementacion?: string;
}

@Component({
  selector: 'app-modal-informe',
  templateUrl: './modal-informe.component.html',
})
export class ModalInformeComponent implements OnChanges, OnDestroy {
  @Input() show = false;
  @Input() informe: Informe | null = null;
  @Input() saving = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardar = new EventEmitter<InformeForm>();

  form: FormGroup;
  activeTab: 'general' | 'analisis' = 'general';
  private editorInstance: any = null;

  readonly tipos: TipoInforme[] = [
    'Incidente', 'Hallazgo de Auditoría', 'Riesgo Tecnológico', 
    'Vulnerabilidad de Seguridad', 'Mejora del Proceso'
  ];

  readonly niveles: NivelImpacto[] = ['Crítico', 'Alto', 'Medio', 'Bajo'];

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      titulo:               ['', [Validators.required]],
      descripcion_hallazgo: ['', [Validators.required]],
      tipo:                 ['Incidente', [Validators.required]],
      nivel_impacto:        ['Medio', [Validators.required]],
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
      if (this.informe) {
        this.form.patchValue({
          titulo:               this.informe.titulo,
          descripcion_hallazgo: this.informe.descripcion_hallazgo,
          tipo:                 this.informe.tipo,
          nivel_impacto:        this.informe.nivel_impacto,
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
      } else {
        this.form.reset({
          titulo: '', descripcion_hallazgo: '', tipo: 'Incidente', 
          nivel_impacto: 'Medio', fecha_evento: new Date().toISOString().split('T')[0],
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

  submit(): void {
    if (this.form.invalid || this.saving) return;
    this.onGuardar.emit(this.form.value);
  }
}
