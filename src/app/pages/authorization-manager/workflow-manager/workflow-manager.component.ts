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

  searchTerm: string = '';
  activePermissionStepIndex: number | null = null; // Para saber qué buscador de permiso está abierto
  permissionSearchTerm: string = '';

  showModuloModal = false;
  showTipoModal = false;
  showVersionModal = false;

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
  newVersion = { workflow_tipo_id: 0, version: 1, descripcion: '' };

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
    this.selectedModulo = modulo;
    this.selectedTipo = null;
    this.selectedVersion = null;
    this.workflowService.listPermissions(modulo.id).subscribe(res => this.permisosModulo = res);
  }

  selectTipo(tipo: any) {
    this.selectedTipo = tipo;
    this.selectedVersion = null;
  }

  selectVersion(version: any) {
    this.selectedVersion = version;
    this.pasos = version.pasos || [];
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
    this.workflowService.storeTipo(this.newTipo).subscribe(() => {
      this.selectModulo(this.selectedModulo);
      this.showTipoModal = false;
      Swal.fire('Éxito', 'Tipo de flujo creado', 'success');
    });
  }

  guardarVersion() {
    this.newVersion.workflow_tipo_id = this.selectedTipo.id;
    this.workflowService.storeVersion(this.newVersion).subscribe(() => {
      this.selectTipo(this.selectedTipo);
      this.showVersionModal = false;
      Swal.fire('Éxito', 'Versión creada', 'success');
    });
  }

  publicarVersion(version: any) {
    this.workflowService.publicarVersion(version.id).subscribe(() => {
      this.selectTipo(this.selectedTipo);
      Swal.fire('Éxito', 'Versión publicada', 'success');
    });
  }

  // GESTIÓN DE PASOS
  agregarPaso() {
    this.pasos.push({
      nombre: '',
      orden: this.pasos.length + 1,
      permiso_requerido: '',
      es_final: false,
      es_paralelo: false
    });
  }

  eliminarPaso(index: number) {
    this.pasos.splice(index, 1);
    this.reordenarPasos();
  }

  reordenarPasos() {
    let currentOrden = 0;
    let lastWasParallel = false;

    this.pasos.forEach((p, i) => {
      if (i > 0 && p.es_paralelo && lastWasParallel) {
        // Si este es paralelo y el anterior también, heredamos el orden (mismo grupo)
        p.orden = this.pasos[i - 1].orden;
      } else {
        // Si no es paralelo, o es el primer paso paralelo del grupo, incrementamos
        currentOrden++;
        p.orden = currentOrden;
      }
      lastWasParallel = p.es_paralelo;
    });
  }

  getNombrePermiso(id: any) {
    const p = this.permisosModulo.find(p => p.id == id);
    return p ? p.name : 'Seleccionar Permiso';
  }

  get permisosFiltrados() {
    if (!this.permissionSearchTerm) return this.permisosModulo;
    const term = this.permissionSearchTerm.toLowerCase();
    return this.permisosModulo.filter(p => p.name.toLowerCase().includes(term));
  }

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.pasos, event.previousIndex, event.currentIndex);
    this.reordenarPasos();
  }

  guardarPasos() {
    if (!this.selectedVersion) return;
    this.workflowService.storePasos(this.selectedVersion.id, this.pasos).subscribe(() => {
      Swal.fire('Éxito', 'Pasos actualizados', 'success');
    });
  }
}
