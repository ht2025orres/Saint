import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowAdminService } from 'src/app/services/workflow-admin.service';
import Swal from 'sweetalert2';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-workflow-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './workflow-manager.component.html',
  styleUrls: ['./workflow-manager.component.css']
})
export class WorkflowManagerComponent implements OnInit {

  pasos: any[] = [];
  permisosModulo: any[] = [];
  allData: any[] = [];

  selectedModulo: any = null;
  selectedTipo: any = null;
  selectedVersion: any = null;

  activeTab: 'designer' | 'instances' = 'designer';
  instances: any[] = [];
  loadingInstances = false;
  selectedInstanceForHistory: any = null;
  searchTermInstances = '';
  statusFilterInstances = 'todos';

  searchTerm: string = '';
  activePermissionStepIndex: number | null = null; // Para saber qué buscador de permiso está abierto
  permissionSearchTerm: string = '';

  showModuloModal = false;
  showTipoModal = false;
  showVersionModal = false;

  // Caché para evitar re-consultas innecesarias
  private cachePermisos = new Map<number, any[]>();
  private cacheCampos = new Map<string, any[]>();

  get modulosFiltrados() {
    if (!this.searchTerm) return this.allData;
    const term = this.searchTerm.toLowerCase();
    return this.allData.filter(m =>
      m.nombre.toLowerCase().includes(term) ||
      m.codigo.toLowerCase().includes(term) ||
      m.tipos.some((t: any) => t.nombre.toLowerCase().includes(term) || t.codigo.toLowerCase().includes(term))
    );
  }



  newModulo = { codigo: '', nombre: '', descripcion: '', activo: true };
  newTipo = { workflow_modulo_id: 0, codigo: '', nombre: '', descripcion: '', activo: true };
  newVersion = { workflow_tipo_id: 0, version: '', descripcion: '' };

  constructor(private workflowService: WorkflowAdminService) { }

  ngOnInit(): void {
    this.cargarTodo();
  }

  cargarTodo() {
    this.workflowService.fullStructure().subscribe(res => {
      this.allData = res;
      if (this.selectedModulo) {
        this.selectedModulo = this.allData.find(m => m.id === this.selectedModulo.id);
        if (this.selectedTipo && this.selectedModulo) {
          this.selectedTipo = this.selectedModulo.tipos.find((t: any) => t.id === this.selectedTipo.id);
          if (this.selectedVersion && this.selectedTipo) {
            this.selectedVersion = this.selectedTipo.versiones.find((v: any) => v.id === this.selectedVersion.id);
            this.pasos = this.selectedVersion.pasos || [];
          }
        }
      }
    });
  }

  selectModulo(modulo: any) {
    if (this.selectedModulo?.id === modulo.id) return; // Evitar recarga si es el mismo
    
    this.selectedModulo = modulo;
    this.selectedTipo = null;
    this.selectedVersion = null;
    
    // Carga con Caché de Permisos
    if (this.cachePermisos.has(modulo.id)) {
      this.permisosModulo = this.cachePermisos.get(modulo.id)!;
    } else {
      this.workflowService.listPermissions(modulo.id).subscribe(res => {
        this.permisosModulo = res;
        this.cachePermisos.set(modulo.id, res);
      });
    }
    
    // Carga con Caché de Campos Dinámicos
    if (this.cacheCampos.has(modulo.codigo)) {
      this.entidadesDisponibles = this.cacheCampos.get(modulo.codigo)!;
    } else {
      this.workflowService.getCamposModulo(modulo.codigo).subscribe(res => {
        this.entidadesDisponibles = res;
        this.cacheCampos.set(modulo.codigo, res);
      });
    }
  }

  selectTipo(tipo: any) {
    this.selectedTipo = tipo;
    this.selectedVersion = null;
  }

  selectVersion(version: any) {
    this.selectedVersion = version;
    this.pasos = JSON.parse(JSON.stringify(version.pasos || []));
    this.updateGrupos();
    if (this.activeTab === 'instances') {
      this.cargarInstancias();
    }
  }

  // MÉTODOS DE CREACIÓN
  guardarModulo() {
    this.workflowService.storeModulo(this.newModulo).subscribe(() => {
      this.cargarTodo();
      this.showModuloModal = false;
      Swal.fire('Éxito', 'Módulo creado', 'success');
    });
  }

  guardarTipo() {
    this.newTipo.workflow_modulo_id = this.selectedModulo.id;
    this.workflowService.storeTipo(this.newTipo).subscribe((tipo) => {
      // Inserción local instantánea para UX fluida
      if (!this.selectedModulo.tipos) this.selectedModulo.tipos = [];
      this.selectedModulo.tipos.push(tipo);
      this.selectTipo(tipo);
      
      this.showTipoModal = false;
      Swal.fire('Éxito', 'Tipo de flujo creado', 'success');
      this.cargarTodo(); // Sincronización de fondo
    });
  }

  prepararNuevaVersion() {
    if (!this.selectedTipo) return;
    
    // Calcular sugerencia de versión (máxima actual + 1)
    const versionesExistentes = this.selectedTipo.versiones || [];
    let sugerencia = 1;
    if (versionesExistentes.length > 0) {
      const maxVer = Math.max(...versionesExistentes.map((v: any) => parseFloat(v.version) || 0));
      sugerencia = Math.floor(maxVer) + 1;
    }
    
    this.newVersion = { 
      workflow_tipo_id: this.selectedTipo.id, 
      version: sugerencia.toString(), 
      descripcion: '' 
    };
    this.showVersionModal = true;
  }

  guardarVersion() {
    this.newVersion.workflow_tipo_id = this.selectedTipo.id;
    this.workflowService.storeVersion(this.newVersion).subscribe({
      next: (version) => {
        // Inserción local instantánea
        if (!this.selectedTipo.versiones) this.selectedTipo.versiones = [];
        this.selectedTipo.versiones.push(version);
        this.selectVersion(version);

        this.showVersionModal = false;
        Swal.fire('Éxito', 'Versión creada', 'success');
        this.cargarTodo(); // Sincronización de fondo
      },
      error: (err) => {
        console.error(err);
        const errorMsg = err.error?.errors?.version?.[0] || err.error?.message || 'No se pudo crear la versión';
        Swal.fire('Error', errorMsg, 'error');
      }
    });
  }

  publicarVersion(version: any) {
    this.workflowService.publicarVersion(version.id).subscribe(() => {
      this.cargarTodo(); // Refrescar para ver el cambio de estado
      Swal.fire('Éxito', 'Versión publicada', 'success');
    });
  }

  // GESTIÓN DE PASOS
  agregarPaso() {
    const nuevoPaso = {
      nombre: 'NUEVA ETAPA',
      codigo: '',
      orden: this.pasos.length > 0 ? Math.max(...this.pasos.map(p => p.orden)) + 1 : 1,
      permiso_requerido: null,
      es_paralelo: false,
      es_final: false,
      permite_omitir: false,
      regla: { 
        entidad_origen: '', 
        campo_origen: '', 
        operador: '==', 
        tipo_destino: 'valor', 
        valor_destino: '',
        entidad_destino: '',
        campo_destino: ''
      }
    };
    this.pasos.push(nuevoPaso);
    this.updateGrupos();
  }

  eliminarPaso(index: number) {
    this.pasos.splice(index, 1);
    this.reordenarPasos();
  }

  reordenarPasos() {
    let currentOrden = 0;
    let lastWasParallel = false;

    this.pasos.forEach((p, i) => {
      // Incrementamos el orden si:
      // 1. Es el primer paso (i === 0)
      // 2. El paso NO es paralelo
      // 3. El paso anterior NO era paralelo
      // 4. Se ha marcado explícitamente "romper enlace" para este paso
      if (i === 0 || !p.es_paralelo || !lastWasParallel || p.romper_enlace) {
        currentOrden++;
      }

      p.orden = currentOrden;
      lastWasParallel = p.es_paralelo;
    });

    this.updateGrupos();
  }

  toggleEnlace(index: number) {
    if (index === 0) return;
    this.pasos[index].romper_enlace = !this.pasos[index].romper_enlace;
    this.reordenarPasos();
  }

  onEsFinalChange(index: number) {
    if (this.pasos[index].es_final) {
      // Desactivar otros pasos finales
      this.pasos.forEach((p, i) => {
        if (i !== index) {
          p.es_final = false;
        }
      });

      // Mover a la última posición
      const finalStep = this.pasos.splice(index, 1)[0];
      this.pasos.push(finalStep);

      // Reordenar todos los pasos
      this.reordenarPasos();
    }
  }

  selectPermission(index: number, permission: any) {
    this.pasos[index].permiso_requerido = permission.name;
    this.activePermissionStepIndex = null;
    this.permissionSearchTerm = '';
  }

  getNombrePermiso(name: string) {
    return name ? name : 'Seleccionar Permiso';
  }

  get permisosFiltrados() {
    if (!this.permissionSearchTerm) return this.permisosModulo;
    const term = this.permissionSearchTerm.toLowerCase();
    return this.permisosModulo.filter(p => p.name.toLowerCase().includes(term));
  }

  drop(event: CdkDragDrop<any[]>) {
    if (event.previousIndex === event.currentIndex) return;

    // Trabajamos sobre una copia de los grupos actuales
    const gruposTmp = [...this.grupos];
    moveItemInArray(gruposTmp, event.previousIndex, event.currentIndex);
    
    const nuevosPasos: any[] = [];
    gruposTmp.forEach((grupo, index) => {
      grupo.forEach((paso: any) => {
        paso.orden = index + 1;
        nuevosPasos.push(paso);
      });
    });

    this.pasos = nuevosPasos;
    this.updateGrupos();
  }

  grupos: any[][] = [];

  /**
   * Agrupa los pasos por su número de orden y actualiza la propiedad reactiva.
   * Se llama solo cuando hay cambios estructurales para evitar bucles infinitos.
   */
  updateGrupos() {
    const gruposMap = new Map();
    this.pasos.forEach(p => {
      if (!gruposMap.has(p.orden)) {
        gruposMap.set(p.orden, []);
      }
      gruposMap.get(p.orden).push(p);
    });
    this.grupos = Array.from(gruposMap.values());
  }

  // GESTIÓN DE CONDICIONES (Safe Builder Dinámico)
  selectedPasoParaCondicion: any = null;
  showCondicionModal = false;
  entidadesDisponibles: any[] = []; // Se llena dinámicamente al seleccionar módulo

  operadores = [
    { id: '==', nombre: 'Igual a' },
    { id: '!=', nombre: 'Diferente de' },
    { id: '>', nombre: 'Mayor que' },
    { id: '<', nombre: 'Menor que' },
    { id: 'contains', nombre: 'Contiene' },
    { id: 'is_true', nombre: 'Es Verdadero' },
    { id: 'is_false', nombre: 'Es Falso' },
    { id: 'is_empty', nombre: 'Está Vacío' }
  ];

  abrirCondiciones(paso: any) {
    this.selectedPasoParaCondicion = paso;
    // Inicializar regla única si no existe
    if (!this.selectedPasoParaCondicion.regla || !this.selectedPasoParaCondicion.regla.tipo_destino) {
      this.selectedPasoParaCondicion.regla = { 
        entidad_origen: '', 
        campo_origen: '', 
        operador: '==', 
        tipo_destino: 'valor', 
        valor_destino: '',
        entidad_destino: '',
        campo_destino: ''
      };
    }
    this.showCondicionModal = true;
  }

  getCamposDeEntidad(codigoEntidad: string): any[] {
    const entidad = this.entidadesDisponibles.find(e => e.entidad === codigoEntidad);
    return entidad ? entidad.campos : [];
  }

  limpiarRegla() {
    this.selectedPasoParaCondicion.regla = { 
      entidad_origen: '', 
      campo_origen: '', 
      operador: '==', 
      tipo_destino: 'valor', 
      valor_destino: '',
      entidad_destino: '',
      campo_destino: ''
    };
    this.showCondicionModal = false;
  }

  guardarPasos() {
    if (!this.selectedVersion) return;
    this.workflowService.storePasos(this.selectedVersion.id, this.pasos).subscribe(() => {
      Swal.fire('Éxito', 'Pasos actualizados', 'success');
    });
  }

  changeTab(tab: 'designer' | 'instances') {
    this.activeTab = tab;
    if (tab === 'instances') {
      this.cargarInstancias();
    }
  }

  cargarInstancias() {
    if (!this.selectedVersion) return;
    this.loadingInstances = true;
    this.workflowService.listInstancias(this.selectedVersion.id).subscribe({
      next: (res) => {
        this.instances = res;
        this.loadingInstances = false;
      },
      error: (err) => {
        console.error(err);
        this.loadingInstances = false;
        Swal.fire('Error', 'No se pudieron cargar las instancias de flujo', 'error');
      }
    });
  }

  get instancesFiltradas() {
    let filtered = this.instances;
    
    // Filtro de estado
    if (this.statusFilterInstances !== 'todos') {
      filtered = filtered.filter(i => i.estado === this.statusFilterInstances);
    }
    
    // Filtro de búsqueda
    if (this.searchTermInstances) {
      const term = this.searchTermInstances.toLowerCase();
      filtered = filtered.filter(i => 
        i.identificador?.toString().toLowerCase().includes(term) ||
        i.detalles?.toLowerCase().includes(term) ||
        i.paso_actual?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }

  showInstanceHistory(instance: any) {
    this.selectedInstanceForHistory = instance;
  }

  traducirEstadoInstancia(estado: string): string {
    const estados: { [key: string]: string } = {
      'en_proceso': 'En Proceso',
      'completada': 'Completada',
      'denegada': 'Rechazada',
      'anulada': 'Anulada',
    };
    return estados[estado] || estado;
  }
}
