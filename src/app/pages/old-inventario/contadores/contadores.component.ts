import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, switchMap, map } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { InventarioOldService } from 'src/app/services/inventario-old.service';
import { AuthService } from 'src/app/services/auth.service';

// 🔹 INTERFACES
interface Contador {
  id?: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  usuario_id?: string;
  activo?: boolean;
  fecha_registro?: Date;
}

interface Lider {
  id: number;
  nombre_completo: string;
  hojas_asignadas?: HojaConteo[];
  contadores_asignados?: Contador[];
}

interface HojaConteo {
  id: number;
  numero_hoja: string;
  bodega: string;
  zona: string;
  estado: 'pendiente' | 'en_proceso' | 'completada';
  fecha_creacion: Date;
}

interface Usuario {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  cargo?: string;
}

@Component({
  selector: 'app-contadores',
  templateUrl: './contadores.component.html',
  styleUrl: './contadores.component.css'
})

export class ContadoresComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // 📊 DATOS PRINCIPALES
  lideres: Lider[] = [];
  contadores: Contador[] = [];
  hojasDisponibles: HojaConteo[] = [];
  
  // 🎯 LÍDER SELECCIONADO
  liderSeleccionado: Lider | null = null;
  
  // 📝 FORMULARIOS
  contadorForm!: FormGroup;
  asignacionForm!: FormGroup;
  
  // 🔍 BÚSQUEDA DE USUARIOS
  usuariosBuscados: Usuario[] = [];
  buscandoUsuario = false;
  
  // 📋 TABLA TEMPORAL DE CONTADORES
  contadoresTemporales: Contador[] = [];
  
  // 🔄 ESTADOS DE CARGA
  isLoadingLideres = false;
  isLoadingContadores = false;
  guardandoContadores = false;
  
  // 🎨 VISTA ACTIVA
  vistaActiva: 'lideres' | 'contadores' = 'lideres';

  constructor(
    private fb: FormBuilder,
    private inventarioService: InventarioOldService,
    private authService: AuthService
  ) {
    this.inicializarFormularios();
  }

  ngOnInit(): void {
    this.cargarLideres();
    this.cargarContadores();
    this.cargarHojasDisponibles();
    this.configurarBusquedaUsuarios();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 🎬 INICIALIZACIÓN
  private inicializarFormularios(): void {
    this.contadorForm = this.fb.group({
      busquedaUsuario: ['', Validators.required]
    });

    this.asignacionForm = this.fb.group({
      liderId: [null, Validators.required],
      hojasIds: [[]],
      contadoresIds: [[]]
    });
  }

  private configurarBusquedaUsuarios(): void {
    this.contadorForm.get('busquedaUsuario')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap(termino => {
          if (termino && termino.length >= 3) {
            this.buscandoUsuario = true;
            return this.inventarioService.buscarUsuariosExternos(termino).pipe(
              map(res => res.data || [])
            );
          }
          this.buscandoUsuario = false;
          return of([]);
        })
      )
      .subscribe({
        next: (usuarios: Usuario[]) => {
          this.usuariosBuscados = usuarios;
          this.buscandoUsuario = false;
        },
        error: (err) => {
          console.error('Error buscando usuarios:', err);
          this.buscandoUsuario = false;
          this.usuariosBuscados = [];
        }
      });
  }

  // 📥 CARGA DE DATOS
  cargarLideres(): void {
    this.isLoadingLideres = true;
    this.inventarioService.obtenerLideresConteo().subscribe({
      next: (res) => {
        this.lideres = res['data'] || [];
      },
      error: (err) => {
        console.error('Error al cargar líderes:', err);
        Swal.fire('Error', 'No se pudieron cargar los líderes', 'error');
      },
      complete: () => {
        this.isLoadingLideres = false;
      }
    });
  }

  cargarContadores(): void {
    this.isLoadingContadores = true;
    this.inventarioService.obtenerContadores().subscribe({
      next: (res) => {
        this.contadores = res['data'] || [];
      },
      error: (err) => {
        console.error('Error al cargar contadores:', err);
        Swal.fire('Error', 'No se pudieron cargar los contadores', 'error');
      },
      complete: () => {
        this.isLoadingContadores = false;
      }
    });
  }

  cargarHojasDisponibles(): void {
    this.inventarioService.obtenerHojasConteoDisponibles().subscribe({
      next: (res) => {
        this.hojasDisponibles = res['data'] || [];
      },
      error: (err) => {
        console.error('Error al cargar hojas:', err);
      }
    });
  }

  // 👥 GESTIÓN DE CONTADORES TEMPORALES
  agregarContadorTemporal(usuario: Usuario): void {
    // Validar que no esté duplicado por cédula
    const existe = this.contadoresTemporales.some(c => c.cedula === usuario.cedula);
    
    if (existe) {
      Swal.fire({
        icon: 'warning',
        title: 'Contador duplicado',
        text: 'Este contador ya está en la lista',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    const nuevoContador: Contador = {
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      cedula: usuario.cedula,
      usuario_id: usuario.id
    };

    this.contadoresTemporales.push(nuevoContador);
    this.contadorForm.reset();
    this.usuariosBuscados = [];

    Swal.fire({
      icon: 'success',
      title: 'Agregado',
      text: `${usuario.nombres} ${usuario.apellidos} agregado a la lista`,
      timer: 1500,
      showConfirmButton: false
    });
  }

  eliminarContadorTemporal(index: number): void {
    this.contadoresTemporales.splice(index, 1);
  }

  guardarContadores(): void {
    if (this.contadoresTemporales.length === 0) {
      Swal.fire('Atención', 'No hay contadores para guardar', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Guardar contadores?',
      text: `Se registrarán ${this.contadoresTemporales.length} contador(es)`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.guardandoContadores = true;

        this.inventarioService.registrarContadores(this.contadoresTemporales).subscribe({
          next: (res) => {
            Swal.fire({
              icon: 'success',
              title: '¡Guardado!',
              text: 'Contadores registrados exitosamente',
              timer: 2000,
              showConfirmButton: false
            });
            
            this.contadoresTemporales = [];
            this.cargarContadores();
          },
          error: (err) => {
            console.error('Error guardando contadores:', err);
            Swal.fire('Error', 'No se pudieron guardar los contadores', 'error');
          },
          complete: () => {
            this.guardandoContadores = false;
          }
        });
      }
    });
  }

  // 👨‍💼 GESTIÓN DE LÍDERES
  seleccionarLider(lider: Lider): void {
    this.liderSeleccionado = lider;
    this.asignacionForm.patchValue({
      liderId: lider.id,
      hojasIds: lider.hojas_asignadas?.map(h => h.id) || [],
      contadoresIds: lider.contadores_asignados?.map(c => c.id) || []
    });
  }

  asignarHojasALider(hojasIds: number[]): void {
    if (!this.liderSeleccionado || !hojasIds?.length) return;

    const payload = {
      lider_id: this.liderSeleccionado.id,
      hojas_ids: hojasIds
    };

    this.inventarioService.asignarHojasALider(payload).subscribe({
      next: () => {
        Swal.fire('¡Éxito!', 'Hojas asignadas correctamente', 'success');
        this.cargarLideres();
        this.cargarHojasDisponibles();
        this.liderSeleccionado = null;
      },
      error: (err) => {
        console.error('Error:', err);
        Swal.fire('Error', 'No se pudieron asignar las hojas', 'error');
      }
    });
  }

  asignarContadoresALider(contadoresIds: number[]): void {
    if (!this.liderSeleccionado || !contadoresIds?.length) return;

    const payload = {
      lider_id: this.liderSeleccionado.id,
      contadores_ids: contadoresIds
    };

    this.inventarioService.asignarContadoresALider(payload).subscribe({
      next: () => {
        Swal.fire('¡Éxito!', 'Contadores asignados correctamente', 'success');
        this.cargarLideres();
        this.liderSeleccionado = null;
      },
      error: (err) => {
        console.error('Error:', err);
        Swal.fire('Error', 'No se pudieron asignar los contadores', 'error');
      }
    });
  }

  desasignarHoja(liderId: number, hojaId: number): void {
    Swal.fire({
      title: '¿Desasignar hoja?',
      text: 'Esta acción quitará la hoja del líder',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desasignar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventarioService.desasignarHojaLider(liderId, hojaId).subscribe({
          next: () => {
            Swal.fire('¡Desasignado!', 'Hoja eliminada del líder', 'success');
            this.cargarLideres();
          },
          error: () => {
            Swal.fire('Error', 'No se pudo desasignar la hoja', 'error');
          }
        });
      }
    });
  }

  desasignarContador(liderId: number, contadorId: number): void {
    Swal.fire({
      title: '¿Desasignar contador?',
      text: 'Esta acción quitará el contador del líder',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desasignar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.inventarioService.desasignarContadorLider(liderId, contadorId).subscribe({
          next: () => {
            Swal.fire('¡Desasignado!', 'Contador eliminado del líder', 'success');
            this.cargarLideres();
          },
          error: () => {
            Swal.fire('Error', 'No se pudo desasignar el contador', 'error');
          }
        });
      }
    });
  }

  // 🎨 UTILIDADES
  cambiarVista(vista: 'lideres' | 'contadores'): void {
    this.vistaActiva = vista;
    this.liderSeleccionado = null;
  }

  getEstadoBadgeClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'pendiente': 'bg-warning',
      'en_proceso': 'bg-primary',
      'completada': 'bg-success'
    };
    return clases[estado] || 'bg-secondary';
  }

  getEstadoTexto(estado: string): string {
    const textos: { [key: string]: string } = {
      'pendiente': 'Pendiente',
      'en_proceso': 'En Proceso',
      'completada': 'Completada'
    };
    return textos[estado] || estado;
  }

  // 🔄 TOGGLE SELECCIONES PARA MODALES
  toggleHojaSeleccion(event: any, hojaId: number): void {
    const hojasActuales = this.asignacionForm.get('hojasIds')?.value || [];
    
    if (event.target.checked) {
      if (!hojasActuales.includes(hojaId)) {
        this.asignacionForm.patchValue({
          hojasIds: [...hojasActuales, hojaId]
        });
      }
    } else {
      this.asignacionForm.patchValue({
        hojasIds: hojasActuales.filter((id: number) => id !== hojaId)
      });
    }
  }

  toggleContadorSeleccion(event: any, contadorId: number): void {
    const contadoresActuales = this.asignacionForm.get('contadoresIds')?.value || [];
    
    if (event.target.checked) {
      if (!contadoresActuales.includes(contadorId)) {
        this.asignacionForm.patchValue({
          contadoresIds: [...contadoresActuales, contadorId]
        });
      }
    } else {
      this.asignacionForm.patchValue({
        contadoresIds: contadoresActuales.filter((id: number) => id !== contadorId)
      });
    }
  }
}