import codecs
import re

ts_path = r'c:\Saint\src\app\pages\proyectos\proyectos\proyectos.component.ts'
with codecs.open(ts_path, 'r', 'utf-8') as f:
    ts_content = f.read()

missing_methods = """
  // =========================================================
  // METODOS RE-AGREGADOS PARA LA VISTA MENSUAL (Seguimientos)
  // =========================================================
  segTareaForm: any = { titulo: '', descripcion: '', usuario_asignado_id: '', fecha_limite_entrega: '', estado: 'pendiente', notas: '' };
  selectedSegTarea: any = null;
  showAsignarSelect = false;
  showEstadoSelect = false;
  showFechaPicker = false;
  fechaTemp: string = '';
  horaTemp: string = '';
  
  showModalVerNotas = false;
  tareaSeleccionada: any = null;

  getNombreAsignado(id: any): string {
    if (!id || id === 'null' || id === '') return '';
    const uid = Number(id);
    if (this.usuarioId === uid) return 'Mí mismo';
    const p = this.vistaMes?.participantes_info?.find((x: any) => x.id === uid) || this.seguimientoActual?.participantes_info?.find((x: any) => x.id === uid);
    return p ? p.nombre : 'Usuario desconocido';
  }

  verNotasTarea(tarea: any) {
    this.tareaSeleccionada = tarea;
    this.showModalVerNotas = true;
  }

  toggleFechaPicker() { this.showFechaPicker = !this.showFechaPicker; }
  cerrarFechaPicker() { this.showFechaPicker = false; }
  quitarFecha() { this.segTareaForm.fecha_limite_entrega = ''; this.fechaTemp = ''; this.horaTemp = ''; this.showFechaPicker = false; }
  actualizarFecha() {
    if (!this.fechaTemp) return;
    this.segTareaForm.fecha_limite_entrega = `${this.fechaTemp}T${this.horaTemp || '12:00'}:00`;
  }
"""

# check if already added
if "METODOS RE-AGREGADOS PARA LA VISTA MENSUAL" not in ts_content:
    # insert before the last closing brace
    last_brace_index = ts_content.rfind('}')
    if last_brace_index != -1:
        ts_content = ts_content[:last_brace_index] + missing_methods + '\n' + ts_content[last_brace_index:]
        with codecs.open(ts_path, 'w', 'utf-8') as f:
            f.write(ts_content)
        print("Successfully injected missing methods into proyectos.component.ts")
    else:
        print("Error: Could not find closing brace in ts file")
else:
    print("Methods already exist!")
