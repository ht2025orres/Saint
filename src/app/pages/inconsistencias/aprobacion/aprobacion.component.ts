import { PaginationService, FilterFunction } from '../../../shared/pagination/pagination.service';
import { InconsistenciaService } from '../../../services/inconsistencia.service';
import { AuthService } from '../../../services/auth.service';
import { Subscription, tap, switchMap } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { getDetallesHtml } from '../../../shared/templates/detalles-popup.template';

@Component({
  selector: 'app-aprobacion-inconsistencias',
  templateUrl: './aprobacion.component.html',
  styleUrls: ['./aprobacion.component.css']
})
export class AprobacionComponent implements OnInit {
  title = 'Inconsistencias Pendientes de Aprobación';
  paginatorId = 'inconsistencias-aprobar-paginator';
  tipos_inco: { [key: string]: string } = {};

  inconsistencias: any[] = [];
  currentData: any[] = [];

  filters = {
    busqueda: ''
  };

  mostrarAccionTomar = false;

  private subscription = new Subscription();

  mostrarDepartamento = true;
  mostrarEstado = true;
  esLider = false;

  loading: boolean = false;

  constructor(
    private inconsistenciasService: InconsistenciaService,
    public authService: AuthService,
    public paginationService: PaginationService
  ) { }


  ngOnInit(): void {
    this.cargarInconsistencias();
    this.obtenerTipos();
    this.verificarRolLogistica(); // 👈 Agregar esta línea
    this.verificarMostrarDepartamento(); // 👈 Verificar si se debe mostrar el departamento

    // Registrar callbacks globales llamados desde el popup.
    // Reciben todos los valores ya recolectados en el popup, sin abrir Swal adicional.
    (window as any).aprobarDesdePopup = (id: number, accion: string, estadoOrden: string) => {
      const inco = this.inconsistencias.find(i => i.id === id);
      if (!inco) return;
      this.loading = true;
      this.inconsistenciasService.aprobarInconsistencia(inco.id, accion || null, estadoOrden || null).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            Swal.fire('Aprobada ✅', 'La inconsistencia ha sido aprobada correctamente.', 'success');
            this.inconsistencias = this.inconsistencias.filter(i => i.id !== inco.id);
            this.applyFilters();
          } else {
            Swal.fire('Error', res.message || 'No se pudo aprobar la inconsistencia.', 'error');
          }
        },
        error: () => { this.loading = false; Swal.fire('Error', 'Ocurrió un error al aprobar.', 'error'); }
      });
    };
    (window as any).denegarDesdePopup = (id: number, motivo: string) => {
      const inco = this.inconsistencias.find(i => i.id === id);
      if (!inco) return;
      this.loading = true;
      this.inconsistenciasService.denegarInconsistencia(inco.id, motivo).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            Swal.fire('Rechazada ❌', 'La inconsistencia fue rechazada correctamente.', 'success');
            this.inconsistencias = this.inconsistencias.filter(i => i.id !== inco.id);
            this.applyFilters();
          } else {
            Swal.fire('Error', res.message || 'No se pudo rechazar la inconsistencia.', 'error');
          }
        },
        error: () => { this.loading = false; Swal.fire('Error', 'Ocurrió un error al rechazar.', 'error'); }
      });
    };
    (window as any).esperarDesdePopup = (id: number, motivo: string) => {
      const inco = this.inconsistencias.find(i => i.id === id);
      if (!inco) return;
      this.loading = true;
      this.inconsistenciasService.ponerEnEspera(inco.id, motivo).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            Swal.fire('En Espera ⏳', 'La inconsistencia ha sido puesta en espera.', 'success');
            this.cargarInconsistencias();
          } else {
            Swal.fire('Error', res.message || 'No se pudo poner en espera.', 'error');
          }
        },
        error: () => { this.loading = false; Swal.fire('Error', 'Ocurrió un error al poner en espera.', 'error'); }
      });
    };
  }

  verificarMostrarDepartamento(): void {
    // IDs de permisos para Líder:
    // 7 - Lider Aprobador (inconsistencias)
    // 8 - Matriz de reemplazo (inconsistencias)
    this.esLider = this.authService.hasAnyPermission([7, 8]);
    
    // Si el usuario es Líder, SIEMPRE mostrar la tabla operativa de líder (OP, Item, etc)
    // aunque tenga otros roles como Contabilidad o Calidad.
    this.mostrarDepartamento = !this.esLider;
  }

  obtenerTipos() {
    fetch('/assets/config/config.json')
      .then(r => r.json())
      .then(json => this.tipos_inco = json);
  }

cargarInconsistencias(): void {
  this.loading = true;

  // ✅ 1. Obtener y filtrar los roles del usuario relacionados con inconsistencias
  // const permisosUsuario: string[] = (this.authService.user.permissions || []).map((permisos: any) => String(permisos));
  // const rolesInconsistencias = permisosUsuario.filter(permisos => {
  //   const lower = permisos.toLowerCase();
  //   return lower.includes('(inconsistencias)') || lower.startsWith('aprobar inconsistencia');
  // }); 

  // // Si no tiene ningún rol de inconsistencias, detener la carga
  // if (rolesInconsistencias.length === 0) {
  //   console.warn('El usuario no tiene roles asociados a inconsistencias.');
  //   this.loading = false;
  //   this.inconsistencias = [];
  //   this.currentData = [];
  //   return;
  // }

  // // ✅ 2. Tomar el primer rol de inconsistencias
  // const rolInconsistencia = rolesInconsistencias[0];

  // ✅ 3. Llamar al servicio SIN id_departamento
  this.subscription.add(
    this.inconsistenciasService
      .listarInconsistenciasPorDepartamento() // 👈 Quitamos el envío explícito del departamento
      .subscribe({
        next: (res: any) => {
          // console.log(rolInconsistencia);
          // console.log('Respuesta del backend:', res); // 👈 DEBUG

          if (res && res.success && Array.isArray(res.data)) {
            this.inconsistencias = res.data;
          } else if (Array.isArray(res)) {
            this.inconsistencias = res;
          } else {
            this.inconsistencias = [];
          }

          this.loading = false;

          this.paginationService.initializePaginator(
            this.paginatorId,
            this.inconsistencias,
            10
          ).subscribe({
            next: (state) => {
              this.currentData = state.currentData;
            },
            error: (err) => {
              this.currentData = [];
            }
          });
        },
        error: (err) => {
          this.loading = false;
          this.inconsistencias = [];
          this.currentData = [];
        }
      })
  );
}



verificarRolLogistica(): void {
  // IDs de permisos para Logística (Aprobación):
  // 11 - Logística (inconsistencias)
  this.mostrarAccionTomar = this.authService.hasAnyPermission([11]);
}

estaEnEspera(inco: any): boolean {
  // Verificar múltiples campos que pueden indicar que está en espera
  return (
    inco.etapa === 'espera' ||
    inco.etapa === 'En espera' ||
    inco.fecha_espera != null ||
    inco.estado_inconsistencia === 'En espera' ||
    inco.estado_inconsistencia === 'en_espera' ||
    (inco.estado_inconsistencia && inco.estado_inconsistencia.toLowerCase().includes('espera'))
  );
}


traducirEtapa(etapa: string): string {
  const etapas: { [key: string]: string } = {
    'lider': 'Aprobación Líder',
    'calidad': 'Aprobación Calidad',
    'logistica': 'Aprobación Logística',
    'trazo': 'Aprobación Trazo',
    'patronaje': 'Aprobación Patronaje',
    'contabilidad': 'Aprobación Contabilidad',
    'cartera': 'Aprobación Cartera',
    'finalizacion': 'Finalización'
  };
  return etapas[etapa] || etapa;
}

abrirModalDetalles(inconsistencia: any): void {
  // Obtener URLs de evidencias
  let archivos: string[] = [];
  if (Array.isArray(inconsistencia.evidencias_urls) && inconsistencia.evidencias_urls.length > 0) {
    archivos = inconsistencia.evidencias_urls;
  } else if (Array.isArray(inconsistencia.evidencias) && inconsistencia.evidencias.length > 0) {
    archivos = inconsistencia.evidencias;
  }

  const evidenciasHtml = archivos.length > 0 ? archivos.map((url: string, i: number) => {
    const ext = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return `<div style="text-align: center; margin-bottom: 10px;">
                <span style="display:block;font-size:12px;color:#888;">Evidencia ${i + 1}</span>
                <img src="${url}" style="max-width:100%; max-height: 400px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;" onclick="window.open('${url}', '_blank')">
              </div>`;
    }
    return `<div style="margin-bottom: 10px;">
              <a href="${url}" target="_blank" style="background:#72BE44; color:white; padding: 6px 12px; text-decoration:none; border-radius: 4px; font-size:12px; display:inline-block;">Abrir Archivo Adjunto ${i + 1}</a>
            </div>`;
  }).join('') : '<p style="color:#888; font-size:13px; font-style:italic; text-align:center;">No hay evidencias adjuntas.</p>';

  const win = window.open('', '_blank', 'width=900,height=750,scrollbars=yes,resizable=yes');
  if (win) {
    win.document.write('<p style="font-family:sans-serif;text-align:center;padding:20px;">Cargando detalles...</p>');
  }

  this.inconsistenciasService.obtenerTiemposProceso(inconsistencia.id_inconsistencia || inconsistencia.id).subscribe({
    next: (res: any) => {
      let tiemposHtml = '<p style="color:#888; font-size:13px; font-style:italic;">No se registraron tiempos.</p>';
      if (res.tiempos) {
        const debugInco = res.debug_inco || {};
        let rows = '';
        let index = 1;
        Object.entries(res.tiempos)
          .filter(([key]) => key !== 'total' && key !== 'finalizacion')
          .forEach(([etapa, tiempo]: [string, any]) => {
            if (tiempo) {
              const nombreCampo = etapa === 'finalizacion' ? 'nombre_consumo' : `nombre_${etapa}`;
              const responsable = debugInco[nombreCampo] || 'Sin asignar';
              const duracionStr = tiempo.dias ? `${Math.floor(tiempo.dias)}d ${tiempo.horas}h ${tiempo.minutos}m` : `${tiempo.horas || 0}h ${tiempo.minutos || 0}m`;
              rows += `
                <tr>
                  <td style="padding:8px; border-bottom:1px solid #eee;">${index++}</td>
                  <td style="padding:8px; border-bottom:1px solid #eee;">${this.traducirEtapa(etapa)}</td>
                  <td style="padding:8px; border-bottom:1px solid #eee;">${responsable}</td>
                  <td style="padding:8px; border-bottom:1px solid #eee; color:#000; font-weight:500;">${duracionStr}</td>
                </tr>
              `;
            }
          });

        if (rows) {
          tiemposHtml = `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:12px; width:100%; text-align:center; border:1px solid #E2E8F0;">
              <thead style="background:#F8FAFC;">
                <tr>
                  <th style="font-weight:600; padding:8px; width:50px; border-bottom:1px solid #E2E8F0;">#</th>
                  <th style="font-weight:600; padding:8px; border-bottom:1px solid #E2E8F0;">Etapa</th>
                  <th style="font-weight:600; padding:8px; border-bottom:1px solid #E2E8F0;">Responsable</th>
                  <th style="font-weight:600; padding:8px; border-bottom:1px solid #E2E8F0;">Duración</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          `;
        }
      }

      // ── Generar panel de acciones con formularios inline dentro del popup ──
      let botonesAccionHtml = '';
      const estado = inconsistencia.estado_inconsistencia || '';
      const terminada = inconsistencia.etapa === 'terminada';
      const inactiva = estado === 'Denegada' || estado === 'Aprobada' || inconsistencia.fecha_anulacion;
      const esEtapaCalidad = inconsistencia.etapa === 'calidad';
      const tieneAccionPrevia = inconsistencia.accion_inconsistencia && inconsistencia.accion_inconsistencia.trim() !== '';
      const estadoOrdenInvalido = !inconsistencia.estado_orden || inconsistencia.estado_orden.trim() === '' || inconsistencia.estado_orden.toLowerCase() === 'pendiente';
      // Mostrar "En Espera" si: (a) el rol del usuario es logística, O (b) la inconsistencia está en etapa 'logistica'
      const esEtapaLogistica = inconsistencia.etapa === 'logistica' || inconsistencia.etapa === 'logística';
      const mostrarEspera = (this.mostrarAccionTomar || esEtapaLogistica) && !this.estaEnEspera(inconsistencia);
      
      // Validar si el usuario tiene algún permiso de aprobación de inconsistencias
      const esAprobador = this.authService.hasAnyPermission([7, 8, 9, 10, 11, 12, 13, 28, 29, 30]);

      if (!terminada && !inactiva && esAprobador) {
        // ── Campos condicionales para Aprobar ──
        const camposAprobar = (esEtapaCalidad && (!tieneAccionPrevia || estadoOrdenInvalido)) ? `
          ${!tieneAccionPrevia ? `
          <div style="margin-bottom:12px; text-align:left;">
            <label style="display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:4px;">Acción a tomar <span style="color:red;">*</span></label>
            <textarea id="pop-accion" rows="3"
              style="width:100%; border:1px solid #D1D5DB; border-radius:6px; padding:8px; font-size:12px; resize:vertical; box-sizing:border-box;"
              placeholder="Describe la acción correctiva o preventiva..."></textarea>
          </div>` : ''}
          ${estadoOrdenInvalido ? `
          <div style="margin-bottom:12px; text-align:left;">
            <label style="display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:4px;">Estado de la OP <span style="color:red;">*</span></label>
            <select id="pop-estado-orden"
              style="width:100%; border:1px solid #D1D5DB; border-radius:6px; padding:8px; font-size:12px; background:white; box-sizing:border-box;">
              <option value="">Seleccione el estado...</option>
              <option value="Abierta">Abierta</option>
              <option value="Cerrada">Cerrada</option>
            </select>
          </div>` : ''}
        ` : '';

        botonesAccionHtml = `
          <div style="margin-top:30px; padding-top:20px; border-top:2px solid #E5E7EB;">
            <div style="display:inline-block; border-left:3px solid #72BE44; padding:4px 10px; margin-bottom:16px;">
              <span style="font-size:11px; font-weight:600; color:#002A3F; letter-spacing:0.07em; text-transform:uppercase;">Acciones de Aprobación</span>
            </div>

            <!-- Botones principales -->
            <div id="pop-botones" style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-bottom:16px;">
              <button onclick="toggleSeccion('pop-form-aprobar')" style="background:#16a34a; color:white; border:none; padding:10px 22px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
                ✅ Aprobar
              </button>
              <button onclick="toggleSeccion('pop-form-rechazar')" style="background:#dc2626; color:white; border:none; padding:10px 22px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
                ❌ Rechazar
              </button>
              ${mostrarEspera ? `
              <button onclick="toggleSeccion('pop-form-espera')" style="background:#d97706; color:white; border:none; padding:10px 22px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
                ⏳ Poner en Espera
              </button>` : ''}
            </div>

            <!-- Formulario: Aprobar -->
            <div id="pop-form-aprobar" style="display:none; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; padding:16px; margin-bottom:12px;">
              <h4 style="margin:0 0 12px; font-size:13px; color:#15803D;">✅ Confirmar Aprobación</h4>
              ${camposAprobar}
              <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px;">
                <button onclick="document.getElementById('pop-form-aprobar').style.display='none';"
                  style="background:#E5E7EB; color:#374151; border:none; padding:8px 16px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Cancelar</button>
                <button onclick="
                  var accion = (document.getElementById('pop-accion') ? document.getElementById('pop-accion').value : '${tieneAccionPrevia ? inconsistencia.accion_inconsistencia : ''}').trim();
                  var estadoOrden = (document.getElementById('pop-estado-orden') ? document.getElementById('pop-estado-orden').value : '${!estadoOrdenInvalido ? inconsistencia.estado_orden : ''}').trim();
                  ${esEtapaCalidad && !tieneAccionPrevia ? `if (!accion) { alert('La acción a tomar es obligatoria.'); return; }` : ''}
                  ${esEtapaCalidad && estadoOrdenInvalido ? `if (!estadoOrden) { alert('El estado de la OP es obligatorio.'); return; }` : ''}
                  window.opener.aprobarDesdePopup(${inconsistencia.id}, accion, estadoOrden);
                  window.close();
                " style="background:#16a34a; color:white; border:none; padding:8px 20px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Confirmar Aprobación</button>
              </div>
            </div>

            <!-- Formulario: Rechazar -->
            <div id="pop-form-rechazar" style="display:none; background:#FEF2F2; border:1px solid #FECACA; border-radius:8px; padding:16px; margin-bottom:12px;">
              <h4 style="margin:0 0 12px; font-size:13px; color:#991B1B;">❌ Motivo de Rechazo</h4>
              <div style="margin-bottom:12px;">
                <label style="display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:4px;">Motivo <span style="color:red;">*</span></label>
                <textarea id="pop-motivo-rechazo" rows="3"
                  style="width:100%; border:1px solid #FECACA; border-radius:6px; padding:8px; font-size:12px; resize:vertical; box-sizing:border-box;"
                  placeholder="Describe el motivo del rechazo..."></textarea>
              </div>
              <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button onclick="document.getElementById('pop-form-rechazar').style.display='none';"
                  style="background:#E5E7EB; color:#374151; border:none; padding:8px 16px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Cancelar</button>
                <button onclick="
                  var motivo = document.getElementById('pop-motivo-rechazo').value.trim();
                  if (!motivo) { alert('El motivo de rechazo es obligatorio.'); return; }
                  window.opener.denegarDesdePopup(${inconsistencia.id}, motivo);
                  window.close();
                " style="background:#dc2626; color:white; border:none; padding:8px 20px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Confirmar Rechazo</button>
              </div>
            </div>

            ${mostrarEspera ? `
            <!-- Formulario: En Espera -->
            <div id="pop-form-espera" style="display:none; background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:16px; margin-bottom:12px;">
              <h4 style="margin:0 0 12px; font-size:13px; color:#92400E;">⏳ Motivo de Espera</h4>
              <div style="margin-bottom:12px;">
                <label style="display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:4px;">Motivo <span style="color:red;">*</span></label>
                <textarea id="pop-motivo-espera" rows="3"
                  style="width:100%; border:1px solid #FDE68A; border-radius:6px; padding:8px; font-size:12px; resize:vertical; box-sizing:border-box;"
                  placeholder="Describe el motivo por el cual se pone en espera..."></textarea>
              </div>
              <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button onclick="document.getElementById('pop-form-espera').style.display='none';"
                  style="background:#E5E7EB; color:#374151; border:none; padding:8px 16px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Cancelar</button>
                <button onclick="
                  var motivo = document.getElementById('pop-motivo-espera').value.trim();
                  if (!motivo) { alert('El motivo de espera es obligatorio.'); return; }
                  window.opener.esperarDesdePopup(${inconsistencia.id}, motivo);
                  window.close();
                " style="background:#d97706; color:white; border:none; padding:8px 20px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Confirmar Espera</button>
              </div>
            </div>` : ''}

          </div>
          <script>
            function toggleSeccion(id) {
              var secciones = ['pop-form-aprobar','pop-form-rechazar','pop-form-espera'];
              secciones.forEach(function(s) {
                var el = document.getElementById(s);
                if (el) el.style.display = (s === id && el.style.display === 'none') ? 'block' : 'none';
              });
            }
          <\/script>`;
      }

      const htmlContent = getDetallesHtml(
        inconsistencia,
        tiemposHtml,
        evidenciasHtml,
        botonesAccionHtml,
        this.tipos_inco,
        this.traducirEtapa.bind(this)
      );

      if (win) {
        win.document.open();
        win.document.write(htmlContent);
        win.document.close();
      }
    },
    error: (err) => {
      if (win) {
        win.document.open();
        win.document.write('<p style="color:red; text-align:center; padding:20px;">Error al cargar los detalles de la inconsistencia.</p>');
        win.document.close();
      }
    }
  });
}

aprobarInconsistencia(inco: any): void {
  // Determinar si la inconsistencia está actualmente en la etapa de calidad
  const esEtapaCalidad = inco.etapa === 'calidad';

  // Verificar si la inconsistencia YA tiene una acción registrada (por ejemplo, porque la ingresaron al generar)
  const tieneAccionPrevia = inco.accion_inconsistencia && inco.accion_inconsistencia.trim() !== '';
  const estadoOrdenInvalido = !inco.estado_orden || inco.estado_orden.trim() === '' || inco.estado_orden.toLowerCase() === 'pendiente';

  // Si está en etapa Calidad y la inconsistencia NO tiene acción o el estado de OP no es válido
  const solicitarDatosCalidad = esEtapaCalidad && (!tieneAccionPrevia || estadoOrdenInvalido);

  // Configurar el modal según el rol
  const modalConfig: any = {
    title: '¿Aprobar inconsistencia?',
    text: `¿Deseas aprobar la inconsistencia #${inco.id_inconsistencia}?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, aprobar',
    cancelButtonText: 'Cancelar'
  };

  // Si requiere solicitar datos de calidad
  if (solicitarDatosCalidad) {
    let htmlForm = `<p>¿Deseas aprobar la inconsistencia #${inco.id_inconsistencia}?</p>`;
    
    if (!tieneAccionPrevia) {
        htmlForm += `
          <div class="mt-3">
            <label for="accion-tomar" class="form-label fw-bold">Acción a tomar:</label>
            <textarea 
              id="accion-tomar" 
              class="form-control" 
              rows="4" 
              placeholder="Describe la acción correctiva o preventiva a implementar..."
            ></textarea>
          </div>
        `;
    }

    if (estadoOrdenInvalido) {
        htmlForm += `
          <div class="mt-3">
            <label for="estado-orden" class="form-label fw-bold">Estado de la OP:</label>
            <select id="estado-orden" class="form-select">
                <option value="">Seleccione el estado de la OP...</option>
                <option value="Abierta">Abierta</option>
                <option value="Cerrada">Cerrada</option>
            </select>
          </div>
        `;
    }

    modalConfig.html = htmlForm;
    delete modalConfig.text;

    modalConfig.preConfirm = () => {
      let accionTomar = inco.accion_inconsistencia;
      let estadoOrden = inco.estado_orden;

      if (!tieneAccionPrevia) {
          const accionInput = (document.getElementById('accion-tomar') as HTMLTextAreaElement)?.value;
          if (!accionInput || accionInput.trim() === '') {
            Swal.showValidationMessage('La acción a tomar es obligatoria');
            return false;
          }
          accionTomar = accionInput;
      }

      if (estadoOrdenInvalido) {
          const estadoInput = (document.getElementById('estado-orden') as HTMLSelectElement)?.value;
          if (!estadoInput || estadoInput.trim() === '') {
            Swal.showValidationMessage('El estado de la OP es obligatorio');
            return false;
          }
          estadoOrden = estadoInput;
      }

      return { accionTomar, estadoOrden };
    };
  }

  Swal.fire(modalConfig).then(result => {
    if (result.isConfirmed) {
      this.loading = true;

      const accionTomar = solicitarDatosCalidad && result.value ? result.value.accionTomar : null;
      const estadoOrden = solicitarDatosCalidad && result.value ? result.value.estadoOrden : null;

      this.inconsistenciasService.aprobarInconsistencia(
        inco.id,
        accionTomar,
        estadoOrden
      ).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            Swal.fire('Aprobada', 'La inconsistencia ha sido aprobada correctamente.', 'success');
            this.inconsistencias = this.inconsistencias.filter(i => i.id !== inco.id);
            this.applyFilters();
          } else {
            Swal.fire('Error', res.message || 'No se pudo aprobar la inconsistencia.', 'error');
          }
        },
        error: (err) => {
          this.loading = false;
          Swal.fire('Error', 'Ocurrió un error al aprobar.', 'error');
        }
      });
    }
  });
}

// Método para poner inconsistencia en espera
ponerEnEspera(inco: any): void {
  // 1. Verificar que el usuario tiene el acceso de Logística (permiso ID 11)
  const esRolLogistica = this.authService.hasAnyPermission([11]);

  if (!esRolLogistica) {
    Swal.fire({
      icon: 'warning',
      title: 'Acceso denegado',
      text: 'Solo el departamento de Logística puede poner inconsistencias en espera.',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  // 2. Mostrar modal de confirmación con motivo
  Swal.fire({
    title: 'Poner en espera',
    html: `
      <p>¿Deseas poner en espera la inconsistencia #${inco.id_inconsistencia}?</p>
      <div class="mt-3">
        <label for="motivo-espera" class="form-label fw-bold">Motivo de espera:</label>
        <textarea 
          id="motivo-espera" 
          class="form-control" 
          rows="4" 
          placeholder="Describe el motivo por el cual se pone en espera..."
        ></textarea>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, poner en espera',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const motivo = (document.getElementById('motivo-espera') as HTMLTextAreaElement)?.value;
      if (!motivo || motivo.trim() === '') {
        Swal.showValidationMessage('El motivo es obligatorio');
        return false;
      }
      return motivo;
    }
  }).then(result => {
    if (result.isConfirmed) {
      const motivo = result.value;
      this.loading = true;

      // 3. Llamar al servicio ponerEnEspera
      this.inconsistenciasService.ponerEnEspera(
        inco.id,
        motivo
      ).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            Swal.fire('En Espera', 'La inconsistencia ha sido puesta en espera correctamente.', 'success');
            // Recargar la lista para obtener el estado actualizado desde el backend
            this.cargarInconsistencias();
          } else {
            Swal.fire('Error', res.message || 'No se pudo poner en espera la inconsistencia.', 'error');
          }
        },
        error: (err) => {
          this.loading = false;
          Swal.fire('Error', 'Ocurrió un error al poner en espera.', 'error');
        }
      });
    }
  });
}

  denegarInconsistencia(inco: any): void {
    Swal.fire({
      title: 'Motivo de denegación',
      input: 'textarea',
      inputPlaceholder: 'Escribe el motivo...',
      showCancelButton: true,
      confirmButtonText: 'Denegar',
      cancelButtonText: 'Cancelar',
      preConfirm: (motivo) => {
        if (!motivo) {
          Swal.showValidationMessage('El motivo es obligatorio');
          return false;
        }
        return motivo;
      }
    }).then(result => {
      if (result.isConfirmed) {
        const motivo = result.value;
        this.loading = true;
        this.inconsistenciasService.denegarInconsistencia(
          inco.id,
          motivo
        ).subscribe({
          next: (res: any) => {
            this.loading = false;
            if (res.success) {
              Swal.fire('Denegada', 'La inconsistencia fue denegada correctamente.', 'success');
              this.inconsistencias = this.inconsistencias.filter(i => i.id !== inco.id);
              this.applyFilters();
            } else {
              Swal.fire('Error', res.message || 'No se pudo denegar la inconsistencia.', 'error');
            }
          },
          error: (err) => {
            this.loading = false;
            Swal.fire('Error', 'Ocurrió un error al denegar.', 'error');
          }
        });
      }
    });
  }
  filterFunction: FilterFunction = (item, filtros) => {
    const texto = filtros.busqueda.toLowerCase();

    const coincideBusqueda =
      !texto ||
      Object.values(item).some(valor =>
        valor?.toString().toLowerCase().includes(texto)
      );

    return coincideBusqueda;
  };

  applyFilters() {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.inconsistencias,
      undefined,
      this.filters,
      this.filterFunction
    );
    const state = this.paginationService.getPaginatorState(this.paginatorId);
    this.currentData = state?.currentData || [];
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}