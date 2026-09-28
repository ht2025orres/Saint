import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import { MoldService } from '../../../services/mold.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-costeo-detail',
  templateUrl: './costeo-detail.component.html',
  styleUrls: ['./costeo-detail.component.css']
})
export class CosteoDetailComponent implements OnInit {
  solicitudId!: number;
  costeo: Solicitud | null = null;
  isLoading = false;

  activeTab: 'items' | 'versiones' = 'items';

  // ─── Modal OPM (Consulta Ficha / Figurín) ───
  selectedOpmItem: any = null;
  opmActiveView: 'front' | 'back' = 'front';
  selectedZone: any = null;
  expandedSidebarZoneKey: string | null = null;

  constructor(
    private comercialService: ComercialService,
    private moldService: MoldService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSolicitud();
  }

  loadSolicitud(): void {
    this.isLoading = true;
    this.comercialService.detalleSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        this.costeo = res.data;
        if (this.costeo?.items) {
          // By default expand the first item if there are items
          this.costeo.items = this.costeo.items.map((it: any, idx: number) => ({
            ...it,
            expanded: idx === 0
          }));
        }
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar la solicitud', 'error');
        this.isLoading = false;
      }
    });
  }

  toggleItem(item: any): void {
    item.expanded = !item.expanded;
  }

  toggleAllItems(expand: boolean): void {
    if (this.costeo?.items) {
      this.costeo.items.forEach((it: any) => it.expanded = expand);
    }
  }

  editCosteo(): void {
    this.router.navigate(['/comerciales/solicitud', this.solicitudId, 'editar']);
  }

  goToClient(): void {
    if (this.costeo) {
      this.router.navigate(['/comerciales/cliente', this.costeo.cliente_id], {
        queryParams: { nombre: this.costeo.cliente_nombre, nit: this.costeo.cliente_nit }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/comerciales']);
  }

  puedeVolverABorrador(sol: any): boolean {
    if (!sol || sol.estado === 'BORRADOR') return false;
    const costeoIniciado = !!sol.fecha_inicio_costeo || ['EN_PROCESO', 'COMPLETADO'].includes(sol.estado_costeo);
    const muestraIniciada = !!sol.fecha_inicio_muestra || ['EN_PROCESO', 'COMPLETADO'].includes(sol.estado_muestra);
    return !costeoIniciado && !muestraIniciada;
  }

  cambiarEstado(estado: string): void {
    Swal.fire({
      title: '¿Cambiar estado?',
      text: `La solicitud pasará a estado: ${this.getEstadoLabel(estado)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.cambiarEstado(this.solicitudId, estado).subscribe({
          next: () => {
            if (this.costeo) {
              this.costeo.estado = estado;
              if (estado === 'BORRADOR') {
                if (this.costeo.requiere_costeo) this.costeo.estado_costeo = 'PENDIENTE';
                if (this.costeo.requiere_muestra) this.costeo.estado_muestra = 'PENDIENTE';
              }
            }
            Swal.fire({ title: 'Actualizado', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: (err) => {
            const msg = err.error?.message || 'No se pudo cambiar el estado';
            Swal.fire('Atención', msg, 'error');
          }
        });
      }
    });
  }

  crearVersion(): void {
    Swal.fire({
      title: 'Nueva Versión',
      input: 'textarea',
      inputLabel: 'Notas (opcional)',
      inputPlaceholder: 'Descripción de los cambios...',
      showCancelButton: true,
      confirmButtonText: 'Crear versión',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.crearVersion(this.solicitudId, result.value).subscribe({
          next: () => {
            this.loadSolicitud();
            Swal.fire({ title: 'Versión creada', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo crear la versión', 'error')
        });
      }
    });
  }

  eliminarCosteo(): void {
    Swal.fire({
      title: '¿Eliminar solicitud?',
      text: `Se eliminará ${this.costeo?.codigo} permanentemente`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.eliminarSolicitud(this.solicitudId).subscribe({
          next: () => {
            Swal.fire({ title: 'Eliminado', icon: 'success', timer: 1500, showConfirmButton: false });
            setTimeout(() => this.router.navigate(['/comerciales']), 1200);
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  getEstadoBadge(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'badge-borrador', 'ENVIADO': 'badge-enviado',
      'EN_COSTEO': 'badge-en-costeo', 'COSTEADO': 'badge-costeado',
      'APROBADO': 'badge-aprobado', 'RECHAZADO': 'badge-rechazado',
    };
    return map[estado] || 'badge-default';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'Borrador', 'ENVIADO': 'Enviado', 'EN_COSTEO': 'En Costeo',
      'COSTEADO': 'Costeado', 'APROBADO': 'Aprobado', 'RECHAZADO': 'Rechazado',
    };
    return map[estado] || estado;
  }

  cambiarEstadoCosteo(estado: string): void {
    Swal.fire({
      title: '¿Cambiar estado de costeo?',
      text: `El proceso de costeo pasará a: ${this.getProcesoLabel(estado)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.cambiarEstadoCosteo(this.solicitudId, estado).subscribe({
          next: (res) => {
            if (this.costeo) {
              this.costeo.estado_costeo = estado as any;
              if (res.data) {
                this.costeo.fecha_inicio_costeo = res.data.fecha_inicio_costeo;
                this.costeo.fecha_fin_costeo = res.data.fecha_fin_costeo;
              }
            }
            Swal.fire({ title: 'Costeo Actualizado', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo cambiar el estado de costeo', 'error')
        });
      }
    });
  }

  cambiarEstadoMuestra(estado: string): void {
    Swal.fire({
      title: '¿Cambiar estado de muestra?',
      text: `El proceso de desarrollo de muestra pasará a: ${this.getProcesoLabel(estado)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.cambiarEstadoMuestra(this.solicitudId, estado).subscribe({
          next: (res) => {
            if (this.costeo) {
              this.costeo.estado_muestra = estado as any;
              if (res.data) {
                this.costeo.fecha_inicio_muestra = res.data.fecha_inicio_muestra;
                this.costeo.fecha_fin_muestra = res.data.fecha_fin_muestra;
              }
            }
            Swal.fire({ title: 'Muestra Actualizada', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo cambiar el estado de muestra', 'error')
        });
      }
    });
  }

  getProcesoLabel(estado: string | undefined, requiere: boolean = false): string {
    if (requiere && (!estado || estado === 'NO_REQUERIDO')) {
      return 'Sin Iniciar';
    }
    const map: Record<string, string> = {
      'PENDIENTE': 'Sin Iniciar',
      'EN_PROCESO': 'En Proceso',
      'COMPLETADO': 'Completado',
      'RECHAZADO': 'Rechazado',
      'NO_REQUERIDO': 'No Requerido',
    };
    return map[estado || 'PENDIENTE'] || (estado || 'Sin Iniciar');
  }

  getProcesoBadgeClass(estado: string | undefined, requiere: boolean = false): string {
    if (requiere && (!estado || estado === 'NO_REQUERIDO')) {
      return 'badge-en-costeo';
    }
    const map: Record<string, string> = {
      'PENDIENTE': 'badge-en-costeo',
      'EN_PROCESO': 'badge-enviado',
      'COMPLETADO': 'badge-costeado',
      'RECHAZADO': 'badge-rechazado',
      'NO_REQUERIDO': 'badge-borrador',
    };
    return map[estado || 'PENDIENTE'] || 'badge-borrador';
  }

  getTotalUnidades(): number {
    return (this.costeo?.items || []).reduce((sum, it) => {
      return sum + this.getItemTotal(it);
    }, 0);
  }

  getItemTotal(item: any): number {
    if (!item?.tallas) return 0;
    return item.tallas.reduce((sum: number, t: any) => sum + (Number(t.cantidad) || 0), 0);
  }

  // ══════════════════════════════════════════════════════════════
  // OPM MODAL & CONSULTATION STATE (MIRROR OF SPEC-GENERATOR)
  // ══════════════════════════════════════════════════════════════

  private readonly ZONE_METADATA: Record<string, { label: string; icon: string; bgClass: string; color: string }> = {
    'cuello': { label: 'Cuello / Solapa', icon: 'bi-border-outer', bgClass: 'bg-blue-500', color: '#3b82f6' },
    'manga': { label: 'Mangas y Puños', icon: 'bi-layers-fill', bgClass: 'bg-purple-500', color: '#8b5cf6' },
    'pecho': { label: 'Pechera y Delantero', icon: 'bi-columns', bgClass: 'bg-emerald-500', color: '#10b981' },
    'espalda': { label: 'Espalda y Almilla', icon: 'bi-border-all', bgClass: 'bg-pink-500', color: '#ec4899' },
    'pretina': { label: 'Cintura y Pretina', icon: 'bi-bounding-box-circles', bgClass: 'bg-cyan-500', color: '#06b6d4' },
    'pierna_bota': { label: 'Piernas y Bota', icon: 'bi-arrows-vertical', bgClass: 'bg-slate-500', color: '#64748b' },
    'general': { label: 'General / Acabados', icon: 'bi-gem', bgClass: 'bg-amber-500', color: '#f59e0b' }
  };

  openOpmModal(item: any): void {
    this.selectedOpmItem = item;
    this.opmActiveView = 'front';
    this.selectedZone = null;
    this.expandedSidebarZoneKey = null;

    const initialMoldParts = item.mold?.parts || [];
    const initialRawParts = item.technical_spec?.parts || item.draftComponents || [];

    const initialEnriched = this.enrichAndConsolidateComponents(initialRawParts, initialMoldParts);
    if (!this.selectedOpmItem.technical_spec) this.selectedOpmItem.technical_spec = {};
    this.selectedOpmItem.technical_spec.parts = initialEnriched;

    const moldId = item.mold?.id || item.mold_id || item.moldId;
    const specId = item.technical_spec_id || item.technicalSpecId || item.technical_spec?.id;

    if (moldId) {
      this.moldService.getMold(moldId).subscribe({
        next: (res: any) => {
          const fullMold = res.data || res;
          if (fullMold && this.selectedOpmItem) {
            this.selectedOpmItem.mold = {
              ...this.selectedOpmItem.mold,
              ...fullMold
            };
            this.loadAndEnrichTechnicalSpec(specId);
          }
        },
        error: () => {
          this.loadAndEnrichTechnicalSpec(specId);
        }
      });
    } else {
      this.loadAndEnrichTechnicalSpec(specId);
    }
  }

  private loadAndEnrichTechnicalSpec(specId?: number): void {
    const moldParts = this.selectedOpmItem?.mold?.parts || [];

    if (specId) {
      this.moldService.getTechnicalSpec(specId).subscribe({
        next: (specRes: any) => {
          const spec = specRes?.data || specRes;
          if (spec && this.selectedOpmItem) {
            this.selectedOpmItem.technical_spec = spec;
            const rawParts = (spec.parts && spec.parts.length > 0)
              ? spec.parts
              : (this.selectedOpmItem.draftComponents || []);
            const enriched = this.enrichAndConsolidateComponents(rawParts, moldParts);
            this.selectedOpmItem.technical_spec.parts = enriched;
          }
        },
        error: () => {
          if (this.selectedOpmItem) {
            const rawParts = this.selectedOpmItem.technical_spec?.parts || this.selectedOpmItem.draftComponents || [];
            const enriched = this.enrichAndConsolidateComponents(rawParts, moldParts);
            if (!this.selectedOpmItem.technical_spec) this.selectedOpmItem.technical_spec = {};
            this.selectedOpmItem.technical_spec.parts = enriched;
          }
        }
      });
    } else {
      if (this.selectedOpmItem) {
        const rawParts = this.selectedOpmItem.technical_spec?.parts || this.selectedOpmItem.draftComponents || [];
        const enriched = this.enrichAndConsolidateComponents(rawParts, moldParts);
        if (!this.selectedOpmItem.technical_spec) this.selectedOpmItem.technical_spec = {};
        this.selectedOpmItem.technical_spec.parts = enriched;
      }
    }
  }

  getCanonicalOptionalParts(): any[] {
    return [
      {
        id: 9100,
        code: 'BRG_FIG',
        name: 'Bragueta y Figurado',
        icon: 'bi-layout-sidebar',
        description: 'Bragueta delantera con aletilla, aletillón, cremallera o botones.',
        types: [
          { id: 9101, name: 'Bragueta con Cremallera y Aletilla Sencilla', technical_description: 'Bragueta con cremallera de nylon / metálica y aletilla reforzada', total_time: 1.85, is_default: true },
          { id: 9102, name: 'Bragueta con Botones y Aletillón Completo', technical_description: 'Bragueta tradicional con botones ocultos y aletillón protector', total_time: 2.20 }
        ]
      },
      {
        id: 9200,
        code: 'REF_ALTA_VIS',
        name: 'Cintas Reflectivas de Alta Visibilidad',
        icon: 'bi-stars',
        description: 'Cintas reflectivas de 2.5cm y 5cm de alta visibilidad en torso, espalda, mangas o botas.',
        types: [
          { id: 9201, name: 'Reflectivo Tipo Chaleco (Torso Delantero y Espalda 5cm)', technical_description: 'Cinta reflectiva de 5cm cosida horizontalmente en contorno de pecho y espalda', total_time: 1.25, is_default: true },
          { id: 9202, name: 'Reflectivo Tipo Chaleco Doble (Doble Banda Torso)', technical_description: 'Dos bandas reflectivas horizontales paralelas en pecho y espalda', total_time: 1.90 },
          { id: 9203, name: 'Reflectivo Tipo Chaleco y Mangas (Brazos y Torso)', technical_description: 'Bandas reflectivas completas en contorno de torso y en ambas mangas', total_time: 2.10 },
          { id: 9204, name: 'Reflectivo en Botas (Contorno Piernas)', technical_description: 'Cintas reflectivas perimetrales de seguridad en la bota de ambas piernas', total_time: 1.00 }
        ]
      },
      {
        id: 9300,
        code: 'LOG_BOR',
        name: 'Logos, Bordados y Marquillas',
        icon: 'bi-gem',
        description: 'Bordados corporativos, termofijados, estampados y marquillas de identificación.',
        types: [
          { id: 9301, name: 'Bordado Pecho Izquierdo y Marquilla Cuello', technical_description: 'Logo corporativo bordado en delantero izquierdo y marquilla de talla/marca', total_time: 1.80, is_default: true },
          { id: 9302, name: 'Estampado DTF / Vinilo Textil Espalda y Pecho', technical_description: 'Estampado termotransferible en delantero y espalda', total_time: 1.40 },
          { id: 9303, name: 'Marquilla Tejida en Manga / Bota', technical_description: 'Marquilla corporativa sobrepuesta', total_time: 0.80 }
        ]
      },
      {
        id: 9400,
        code: 'VIV_CON',
        name: 'Vivos y Contrastes Decorativos',
        icon: 'bi-palette',
        description: 'Detalles en contraste de color en cuello, carteras, sangrías o costados.',
        types: [
          { id: 9401, name: 'Vivos en Contraste Cuello y Carteras', technical_description: 'Insertos de tela en color de contraste en solapa y carteras', total_time: 1.10, is_default: true },
          { id: 9402, name: 'Sesgo Doble Doblado en Bordes y Puños', technical_description: 'Sesgo sobrepuesto decorativo en perfiles', total_time: 1.30 }
        ]
      }
    ];
  }

  private enrichAndConsolidateComponents(rawParts: any[], moldParts: any[]): any[] {
    let sourceParts: any[] = [];
    if (rawParts && rawParts.length > 0) {
      sourceParts = [...rawParts];
    } else {
      sourceParts = [...(moldParts || [])];
    }

    const canonicalOptionals = this.getCanonicalOptionalParts();
    const moldZones = this.selectedOpmItem?.mold?.zones || [];

    const enrichedList: any[] = sourceParts.map((raw: any): any => {
      const rawName = (raw.name || raw.garment_part?.name || '').toLowerCase().trim();
      const rawGpId = raw.garment_part_id || raw.garment_part?.id;
      const rawMoldPartId = raw.mold_part_id || (raw.is_from_mold ? raw.id : null);

      const matchedMoldPart = moldParts.find((mp: any) => {
        if (rawMoldPartId && Number(mp.id) === Number(rawMoldPartId)) return true;
        if (rawGpId && Number(mp.garment_part_id) === Number(rawGpId)) return true;
        const mpName = (mp.name || mp.garment_part?.name || '').toLowerCase().trim();
        if (rawName && mpName && (rawName === mpName || rawName.includes(mpName) || mpName.includes(rawName))) return true;
        return false;
      }) || (raw.is_from_mold ? raw : null);

      const matchedOptional = !matchedMoldPart 
        ? canonicalOptionals.find((c: any) => c.name.toLowerCase().trim() === rawName || rawName.includes(c.name.toLowerCase().trim()) || c.name.toLowerCase().trim().includes(rawName))
        : null;

      const typesFromMp = matchedMoldPart?.types || matchedMoldPart?.garment_part?.types || matchedMoldPart?.garmentPart?.types || matchedOptional?.types || [];
      const rawTypes = raw.types || [];
      const allTypes = (typesFromMp.length > 0 ? typesFromMp : rawTypes).filter((t: any) => !t.is_disabled);

      let selectedTypeId: number | null = null;
      let selectedTypeName = '';
      let technicalSpec = raw.technical_spec || '';
      let clientSpec = raw.client_spec || '';

      const targetId = Number(raw.selected_type_id || raw.mold_part_type_id || 0);
      const targetName = (raw.selected_type_name || raw.part_type?.name || raw.partType?.name || raw.inventory_description || '').toLowerCase().trim();
      const targetTech = (raw.technical_spec || '').toLowerCase().trim();

      let found = allTypes.find((t: any) => 
        (targetId && Number(t.id) === targetId) ||
        (targetName && (t.name || '').toLowerCase().trim() === targetName) ||
        (targetTech && (t.technical_description || '').toLowerCase().trim() === targetTech) ||
        (targetTech && (t.name || '').toLowerCase().trim() === targetTech)
      );

      if (!found && targetTech) {
        found = allTypes.find((t: any) => 
          (t.technical_description && targetTech.includes(t.technical_description.toLowerCase().trim())) ||
          (t.name && targetTech.includes(t.name.toLowerCase().trim()))
        );
      }

      if (!found && targetName) {
        found = allTypes.find((t: any) => 
          (t.name && (t.name.toLowerCase().includes(targetName) || targetName.includes(t.name.toLowerCase()))) ||
          (t.technical_description && (t.technical_description.toLowerCase().includes(targetName) || targetName.includes(t.technical_description.toLowerCase())))
        );
      }

      if (found) {
        selectedTypeId = found.id;
        selectedTypeName = found.name;
        technicalSpec = raw.technical_spec || found.technical_description || '';
      } else if (raw.selected_type_name || raw.technical_spec || targetId) {
        selectedTypeId = targetId || raw.selected_type_id || null;
        selectedTypeName = raw.selected_type_name || raw.part_type?.name || raw.inventory_description || raw.technical_spec || '';
        technicalSpec = raw.technical_spec || '';
      }

      let zoneObj = matchedMoldPart?.zone || raw.zone;
      let zoneId = matchedMoldPart?.mold_zone_id || raw.mold_zone_id || null;
      let zoneName = zoneObj?.name || matchedMoldPart?.zone_name || raw.zone_name || raw.inventory_reference || '';
      let zoneType = zoneObj?.zone_type || matchedMoldPart?.zone_type || raw.zone_type || '';

      if (moldZones.length) {
        const matchingZone = moldZones.find((z: any) => {
          const zName = (z.name || '').toLowerCase().trim();
          const zType = (z.zone_type || '').toLowerCase().trim();
          const targetZName = (zoneName || '').toLowerCase().trim();
          if (zoneId && Number(z.id) === Number(zoneId)) return true;
          if (targetZName && (zName === targetZName || targetZName.includes(zName) || zName.includes(targetZName))) return true;
          if (targetZName && zType && (zType === targetZName || targetZName.includes(zType) || zType.includes(targetZName))) return true;
          if (zName && (rawName.includes(zName) || zName.includes(rawName))) return true;
          if (zType && (rawName.includes(zType) || zType.includes(rawName))) return true;
          return false;
        });
        if (matchingZone) {
          if (!zoneId) zoneId = matchingZone.id;
          if (!zoneName) zoneName = matchingZone.name;
          if (!zoneType) zoneType = matchingZone.zone_type;
        }
      }

      const isMandatory = raw.is_mandatory !== undefined 
        ? raw.is_mandatory 
        : (matchedMoldPart ? matchedMoldPart.is_mandatory !== false : (matchedOptional ? false : true));

      return {
        mold_part_id: matchedMoldPart?.id || rawMoldPartId || null,
        mold_zone_id: zoneId,
        zone_name: zoneName,
        zone_type: zoneType,
        garment_part_id: matchedMoldPart?.garment_part_id || rawGpId || null,
        name: matchedMoldPart?.garment_part?.name || matchedMoldPart?.name || matchedOptional?.name || raw.name || 'Componente',
        item_type: raw.item_type || matchedMoldPart?.item_type || (matchedOptional ? 'parte' : 'parte'),
        view: raw.view || matchedMoldPart?.view || 'front',
        position_x: raw.position_x ?? matchedMoldPart?.position_x ?? null,
        position_y: raw.position_y ?? matchedMoldPart?.position_y ?? null,
        width: raw.width ?? matchedMoldPart?.width ?? 22,
        height: raw.height ?? matchedMoldPart?.height ?? 18,
        is_mandatory: isMandatory,
        client_spec: clientSpec,
        technical_spec: technicalSpec,
        material_exception: raw.material_exception || raw.technical_material_exception || null,
        client_material_exception: raw.client_material_exception || null,
        is_from_mold: raw.is_from_mold !== undefined ? raw.is_from_mold : !!matchedMoldPart,
        types: allTypes,
        selected_type_id: selectedTypeId,
        selected_type_name: selectedTypeName,
        icon: matchedMoldPart?.icon || matchedMoldPart?.garment_part?.icon || matchedOptional?.icon || raw.icon || 'bi-layers',
        exception_comment: raw.exception_comment || null
      };
    });

    const consolidatedMap = new Map<string, any>();
    for (const comp of enrichedList) {
      const cName = (comp.name || '').toLowerCase().trim();
      const key = comp.mold_part_id
        ? `mp_${comp.mold_part_id}`
        : `${cName}__${comp.mold_zone_id || comp.zone_name || 'no-zone'}__${comp.garment_part_id || 'no-gp'}`;

      if (consolidatedMap.has(key)) {
        const existing = consolidatedMap.get(key)!;
        if (!existing.exception_comment && comp.exception_comment) {
          existing.exception_comment = comp.exception_comment;
        }
        if (!existing._all_zone_ids) {
          existing._all_zone_ids = existing.mold_zone_id ? [existing.mold_zone_id] : [];
        }
        if (comp.mold_zone_id && !existing._all_zone_ids.includes(comp.mold_zone_id)) {
          existing._all_zone_ids.push(comp.mold_zone_id);
        }
        if (comp.selected_type_id || comp.selected_type_name) {
          existing.selected_type_id = comp.selected_type_id;
          existing.selected_type_name = comp.selected_type_name;
          existing.technical_spec = comp.technical_spec;
        }
      } else {
        comp._all_zone_ids = comp.mold_zone_id ? [comp.mold_zone_id] : [];
        consolidatedMap.set(key, comp);
      }
    }

    return Array.from(consolidatedMap.values());
  }

  closeOpmModal(): void {
    this.selectedOpmItem = null;
    this.selectedZone = null;
    this.expandedSidebarZoneKey = null;
  }

  toggleOpmView(view?: 'front' | 'back'): void {
    if (view) {
      this.opmActiveView = view;
    } else {
      this.opmActiveView = this.opmActiveView === 'front' ? 'back' : 'front';
    }
    this.selectedZone = null;
  }

  get hasOpmBackView(): boolean {
    const mold = this.selectedOpmItem?.mold;
    if (!mold) return false;
    return !!mold.back_image_signed_url || 
           !!mold.back_image_url || 
           !!this.getFallbackBackImage(mold) ||
           (mold.zones || []).some((z: any) => (z.view || '').toLowerCase() === 'back');
  }

  getFallbackFrontImage(mold?: any): string | null {
    if (!mold) return null;
    const name = (mold.name || '').toLowerCase();
    if (name.includes('camisa')) return 'assets/garments/camisa_front.png';
    if (name.includes('chaqueta')) return 'assets/garments/chaqueta_front.png';
    if (name.includes('pantalon') || name.includes('pantalón')) return 'assets/garments/pantalon_front.png';
    if (name.includes('overol')) return 'assets/garments/overol_front.png';
    if (name.includes('polo')) return 'assets/garments/polo_front.png';
    if (name.includes('buzo')) return 'assets/garments/buzo_front.png';
    if (name.includes('camiseta')) return 'assets/garments/camiseta_front.png';
    if (name.includes('chaleco')) return 'assets/garments/chaleco_front.png';
    if (name.includes('delantal')) return 'assets/garments/delantal_front.png';
    if (name.includes('gorra')) return 'assets/garments/gorra_front.png';
    return null;
  }

  getFallbackBackImage(mold?: any): string | null {
    if (!mold) return null;
    const name = (mold.name || '').toLowerCase();
    if (name.includes('camisa')) return 'assets/garments/camisa_back.png';
    if (name.includes('chaqueta')) return 'assets/garments/chaqueta_back.png';
    if (name.includes('pantalon') || name.includes('pantalón')) return 'assets/garments/pantalon_back.png';
    if (name.includes('overol')) return 'assets/garments/overol_back.png';
    if (name.includes('polo')) return 'assets/garments/polo_back.png';
    if (name.includes('buzo')) return 'assets/garments/buzo_back.png';
    if (name.includes('camiseta')) return 'assets/garments/camiseta_back.png';
    if (name.includes('chaleco')) return 'assets/garments/chaleco_back.png';
    if (name.includes('delantal')) return 'assets/garments/delantal_back.png';
    if (name.includes('gorra')) return 'assets/garments/gorra_back.png';
    return null;
  }

  getActiveOpmImage(): string {
    const mold = this.selectedOpmItem?.mold;
    if (!mold) return '';
    if (this.opmActiveView === 'back') {
      return mold.back_image_signed_url || 
             mold.back_image_url || 
             this.getFallbackBackImage(mold) || 
             mold.image_signed_url || 
             mold.image_url || 
             '';
    }
    return mold.image_signed_url || 
           mold.image_url || 
           this.getFallbackFrontImage(mold) || 
           '';
  }

  getAllItemParts(item: any): any[] {
    if (!item) return [];
    const parts = item.technical_spec?.parts || item.mold?.parts || [];
    return parts.filter((p: any) => this.isPartIncluded(p));
  }

  getZoneKey(zone: any): string {
    return (zone?.name || zone?.zone_type || String(zone?.id || '')).toLowerCase().trim();
  }

  getZoneIcon(zoneType?: string): string {
    const key = (zoneType || '').toLowerCase().trim();
    return this.ZONE_METADATA[key]?.icon || 'bi-bounding-box-circles';
  }

  getZoneColor(zoneType?: string): string {
    const key = (zoneType || '').toLowerCase().trim();
    return this.ZONE_METADATA[key]?.color || '#64748b';
  }

  getZoneLabel(zoneType?: string): string {
    const key = (zoneType || '').toLowerCase().trim();
    return this.ZONE_METADATA[key]?.label || (zoneType ? zoneType.toUpperCase() : 'ZONA');
  }

  isSidebarZoneExpanded(zone: any): boolean {
    const key = this.getZoneKey(zone);
    return this.expandedSidebarZoneKey === key;
  }

  toggleSidebarZone(zone: any, event?: Event): void {
    if (event) event.stopPropagation();
    const key = this.getZoneKey(zone);
    this.expandedSidebarZoneKey = this.expandedSidebarZoneKey === key ? null : key;
  }

  selectZone(zone: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isZoneSelected(zone)) {
      this.selectedZone = null;
    } else {
      this.selectedZone = zone;
    }
  }

  clearSelectedZone(event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedZone = null;
  }

  isZoneSelected(zone: any): boolean {
    if (!this.selectedZone || !zone) return false;
    if (this.selectedZone === zone) return true;

    if (this.selectedZone.id && zone.id && Number(this.selectedZone.id) === Number(zone.id)) {
      return true;
    }

    const selKey = this.getZoneKey(this.selectedZone);
    const zoneKey = this.getZoneKey(zone);
    if (selKey && zoneKey && selKey === zoneKey) return true;

    const selType = (this.selectedZone.zone_type || '').toLowerCase().trim();
    const zType = (zone.zone_type || '').toLowerCase().trim();
    if (selType && zType && selType === zType && selType !== 'general') return true;

    const selName = (this.selectedZone.name || '').toLowerCase().trim();
    const zName = (zone.name || '').toLowerCase().trim();
    if (selName && zName && selName === zName) return true;

    return false;
  }

  getZonePopoverLeft(zone: any): number {
    if (!zone) return 50;
    const center = this.getZoneCenter(zone);
    return Math.min(65, Math.max(35, center.x));
  }

  getZonePopoverTop(zone: any): number {
    if (!zone) return 50;
    const center = this.getZoneCenter(zone);
    return Math.min(68, Math.max(22, center.y));
  }

  getConfiguredPartsForZoneObj(zone: any): any[] {
    if (!zone) return [];
    return this.getPartsForZone(zone).filter(p => this.isPartIncluded(p));
  }

  // Zone types that belong to each view (used for fallback and unassigned part filtering)
  private readonly FRONT_ZONE_TYPES = new Set(['cuello', 'pecho', 'manga', 'pretina', 'pierna_bota', 'general']);
  private readonly BACK_ZONE_TYPES = new Set(['espalda']);

  private isZoneTypeForView(zoneType: string, view: string): boolean {
    if (view === 'back') {
      // Back view shows: espalda, manga (shared), pretina (shared), pierna_bota (shared), general
      return this.BACK_ZONE_TYPES.has(zoneType) || 
             ['manga', 'pretina', 'pierna_bota', 'general'].includes(zoneType);
    }
    // Front view shows everything except espalda
    return this.FRONT_ZONE_TYPES.has(zoneType);
  }

  getActiveZones(): any[] {
    if (!this.selectedOpmItem?.mold) return [];
    const zones = this.selectedOpmItem.mold.zones || [];
    const currentView = this.opmActiveView;

    // Strict filter matching spec-generator: (z.view || 'front') === currentView
    const filtered = zones.filter((z: any) => {
      const v = (z.view || 'front').toLowerCase();
      return v === currentView;
    });

    // Only fall back to inferred zones if mold has NO zones at all
    if (zones.length === 0) {
      return this.getFallbackZonesFromParts();
    }

    return filtered;
  }

  private getFallbackZonesFromParts(): any[] {
    const currentView = this.opmActiveView;
    const allParts = this.getAllItemParts(this.selectedOpmItem);
    const detectedTypes = new Set<string>();
    allParts.forEach(p => {
      if (!this.isTransversalPart(p)) {
        const zt = (p.zone_type || this.inferZoneFromPartName(p.name || '')).toLowerCase();
        // Only include zone types that belong to the current view
        if (this.isZoneTypeForView(zt, currentView)) {
          detectedTypes.add(zt);
        }
      }
    });

    const defaultCoords: Record<string, { x: number; y: number; name: string; view: string }> = {
      'cuello': { x: 50, y: 18, name: 'CUELLO / SOLAPA', view: 'front' },
      'pecho': { x: 50, y: 35, name: 'PECHERA Y DELANTERO', view: 'front' },
      'manga': { x: 38, y: 55, name: 'MANGAS Y PUÑOS', view: 'front' },
      'espalda': { x: 50, y: 30, name: 'ESPALDA Y ALMILLA', view: 'back' },
      'pretina': { x: 50, y: 80, name: 'CINTURA Y PRETINA', view: 'front' },
      'pierna_bota': { x: 50, y: 75, name: 'PIERNAS Y BOTA', view: 'front' },
      'general': { x: 50, y: 50, name: 'ACABADOS GENERALES', view: 'front' }
    };

    const zones: any[] = [];
    detectedTypes.forEach(zt => {
      const meta = this.ZONE_METADATA[zt] || this.ZONE_METADATA['general'];
      const coord = defaultCoords[zt] || { x: 50, y: 50, name: zt.toUpperCase(), view: 'front' };
      zones.push({
        id: zt,
        name: coord.name,
        zone_type: zt,
        view: currentView,
        position_x: coord.x - 10,
        position_y: coord.y - 5,
        width: 20,
        height: 10,
        color: meta.color
      });
    });

    return zones;
  }

  getZonesWithParts(): { zone: any; parts: any[]; allZoneIds: any[] }[] {
    const activeZones = this.getActiveZones();
    const allParts = this.getAllItemParts(this.selectedOpmItem);
    const currentView = this.opmActiveView;
    const allMoldZones = this.selectedOpmItem?.mold?.zones || [];
    const grouped = new Map<string, { zone: any; parts: any[]; allZoneIds: any[] }>();

    for (const zone of activeZones) {
      const key = this.getZoneKey(zone);
      const parts = this.getPartsForZone(zone, allParts);
      if (!grouped.has(key)) {
        grouped.set(key, {
          zone,
          parts: [...parts],
          allZoneIds: zone.id ? [zone.id] : []
        });
      } else {
        const existing = grouped.get(key)!;
        if (zone.id && !existing.allZoneIds.includes(zone.id)) {
          existing.allZoneIds.push(zone.id);
        }
        parts.forEach(p => {
          if (!existing.parts.includes(p)) existing.parts.push(p);
        });
      }
    }

    // Include unassigned parts ONLY if their inferred zone type belongs to the current view
    for (const part of allParts) {
      if (this.isTransversalPart(part)) continue;

      // If part has explicit view and it doesn't match current view, skip
      if (part.view && part.view !== currentView) continue;

      // If part is assigned to a mold zone that belongs to the other view, skip
      if (part.mold_zone_id && allMoldZones.length > 0) {
        const assignedZone = allMoldZones.find((z: any) => Number(z.id) === Number(part.mold_zone_id));
        if (assignedZone) {
          const zoneView = (assignedZone.view || 'front').toLowerCase();
          if (zoneView !== currentView) continue;
        }
      }

      const isAssigned = Array.from(grouped.values()).some(g => g.parts.includes(part));
      if (!isAssigned) {
        const zt = (part.zone_type || this.inferZoneFromPartName(part.name || '')).toLowerCase();
        // Skip parts whose zone type doesn't belong to the current view
        if (!this.isZoneTypeForView(zt, currentView)) continue;
        const meta = this.ZONE_METADATA[zt] || this.ZONE_METADATA['general'];
        const key = zt;
        if (!grouped.has(key)) {
          grouped.set(key, {
            zone: {
              id: null,
              name: meta.label,
              zone_type: zt,
              color: meta.color
            },
            parts: [part],
            allZoneIds: []
          });
        } else {
          grouped.get(key)!.parts.push(part);
        }
      }
    }

    return Array.from(grouped.values());
  }

  getPartsForZone(zone: any, allPartsList?: any[]): any[] {
    const list = allPartsList || this.getAllItemParts(this.selectedOpmItem);
    if (!zone) return [];
    const zoneId = Number(zone.id);
    const zName = (zone.name || '').toLowerCase().trim();
    const zType = (zone.zone_type || '').toLowerCase().trim();

    return list.filter(p => {
      if (p.mold_zone_id && Number(p.mold_zone_id) === zoneId) return true;
      if (p._all_zone_ids?.some((zid: any) => Number(zid) === zoneId)) return true;
      if (p.zone_name && zName && p.zone_name.toLowerCase().trim() === zName) return true;
      const pZoneType = (p.zone_type || '').toLowerCase().trim();
      if (zType && pZoneType && zType === pZoneType) return true;
      const pName = (p.name || '').toLowerCase().trim();
      return !!(zType && (pName.includes(zType) || zType.includes(pName)));
    });
  }

  isPartIncluded(part: any): boolean {
    if (!part) return false;
    return !!part.selected_type_id || 
           !!part.selected_type_name || 
           (typeof part.technical_spec === 'string' && part.technical_spec.trim().length > 0) || 
           (typeof part.client_spec === 'string' && part.client_spec.trim().length > 0) ||
           !!part.material_exception ||
           !!part.client_material_exception;
  }

  isPartConfigured(part: any): boolean {
    return this.isPartIncluded(part);
  }

  getConfiguredPartsForZone(zp: { zone: any; parts: any[] }): any[] {
    return (zp?.parts || []).filter(p => this.isPartIncluded(p));
  }

  getZoneCenter(zone: any): { x: number; y: number } {
    let pts = zone.path_data;
    if (typeof pts === 'string') {
      try { pts = JSON.parse(pts); } catch (e) { pts = null; }
    }
    if (Array.isArray(pts) && pts.length > 0) {
      const sumX = pts.reduce((acc: number, p: any) => acc + (p.x || 0), 0);
      const sumY = pts.reduce((acc: number, p: any) => acc + (p.y || 0), 0);
      return {
        x: Math.round((sumX / pts.length) * 100) / 100,
        y: Math.round((sumY / pts.length) * 100) / 100
      };
    }
    return {
      x: Math.round(((parseFloat(zone.position_x as any) || 0) + ((parseFloat(zone.width as any) || 20) / 2)) * 100) / 100,
      y: Math.round(((parseFloat(zone.position_y as any) || 0) + ((parseFloat(zone.height as any) || 20) / 2)) * 100) / 100
    };
  }

  getPolygonPoints(points?: any): string {
    let pts = points;
    if (typeof pts === 'string') {
      try { pts = JSON.parse(pts); } catch (e) { pts = []; }
    }
    if (!Array.isArray(pts) || pts.length === 0) return '';
    return pts.map((p: any) => `${p.x},${p.y}`).join(' ');
  }

  isZoneConfigured(zone: any): boolean {
    const parts = this.getPartsForZone(zone);
    return parts.some(p => this.isPartIncluded(p));
  }

  getConfiguredPartsCount(parts: any[]): number {
    return (parts || []).filter(p => this.isPartIncluded(p)).length;
  }

  getTransversalOptionals(): any[] {
    if (!this.selectedOpmItem) return [];
    const allParts = this.getAllItemParts(this.selectedOpmItem);
    const moldZones = this.selectedOpmItem?.mold?.zones || [];
    const zonesWithParts = this.getZonesWithParts();

    return allParts
      .filter(p => p.is_mandatory === false && (!!p.selected_type_id || !!p.selected_type_name || !!p.technical_spec || !!p.client_spec || this.isTransversalPart(p)))
      .map(p => {
        let zoneLabel = p.zone_name || (p.zone?.name) || '';
        if (!zoneLabel && p.mold_zone_id && moldZones.length > 0) {
          const matchedZ = moldZones.find((z: any) => Number(z.id) === Number(p.mold_zone_id));
          if (matchedZ?.name) zoneLabel = matchedZ.name;
        }
        if (!zoneLabel && p.zone_type) {
          zoneLabel = this.getZoneLabel(p.zone_type);
        }
        if (!zoneLabel) {
          const foundGroup = zonesWithParts.find(g => g.parts.some(pt => pt === p || pt.name === p.name));
          if (foundGroup?.zone?.name) {
            zoneLabel = foundGroup.zone.name;
          }
        }
        if (!zoneLabel) {
          zoneLabel = 'General / Acabados';
        }

        return {
          name: p.name || 'Aplique / Opcional',
          variant: this.extractVariantName(p),
          clientSpec: p.client_spec || '',
          technicalSpec: p.technical_spec || '',
          exceptionComment: p.exception_comment || '',
          material: p.material_exception || p.client_material_exception || null,
          icon: this.getOptionalIcon(p.name || ''),
          zoneName: zoneLabel
        };
      });
  }

  getConsolidatedMaterials(): any[] {
    if (!this.selectedOpmItem) return [];
    const map = new Map<string, {
      name: string;
      type: 'tela' | 'insumo';
      sourceParts: Set<string>;
      siesaRef?: string;
      siesaDesc?: string;
      color?: string;
      comment?: string;
    }>();

    const addMat = (name: string, partLabel: string, type: 'tela' | 'insumo', siesaRef?: string, siesaDesc?: string, color?: string, comment?: string) => {
      const raw = (name || '').trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: raw,
          type: type,
          sourceParts: new Set<string>(),
          siesaRef,
          siesaDesc,
          color,
          comment
        });
      }
      map.get(key)!.sourceParts.add(partLabel);
      if (siesaRef && !map.get(key)!.siesaRef) map.get(key)!.siesaRef = siesaRef;
      if (siesaDesc && !map.get(key)!.siesaDesc) map.get(key)!.siesaDesc = siesaDesc;
      if (color && !map.get(key)!.color) map.get(key)!.color = color;
      if (comment && !map.get(key)!.comment) map.get(key)!.comment = comment;
    };

    const allParts = this.getAllItemParts(this.selectedOpmItem);

    allParts.forEach((part) => {
      const partName = part.name || 'Parte';
      const variantName = this.extractVariantName(part);
      const partLabel = `${partName} (${variantName})`;
      const matExc = part.material_exception || part.client_material_exception;
      const comment = part.exception_comment || part.client_spec || '';

      // Standard base materials
      addMat('Tela Principal', partLabel, 'tela', this.selectedOpmItem.ref_siesa_referencia, this.selectedOpmItem.ref_siesa_descripcion, undefined, undefined);
      addMat('Hilo de Confección', partLabel, 'insumo');

      if (matExc) {
        addMat(
          matExc.descripcion || matExc.referencia || 'Material Asignado',
          partLabel,
          matExc.is_fabric ? 'tela' : 'insumo',
          matExc.referencia,
          matExc.descripcion,
          matExc.color,
          comment
        );
      }

      const corpus = `${part.name || ''} ${variantName} ${part.technical_spec || ''} ${part.client_spec || ''}`.toLowerCase();
      if (corpus.includes('botón') || corpus.includes('boton') || corpus.includes('ojal') || corpus.includes('pechera') || corpus.includes('camisa')) {
        addMat('Botones', partLabel, 'insumo');
      }
      if (corpus.includes('cremallera') || corpus.includes('cierre') || corpus.includes('zipper')) {
        addMat('Cremallera / Cierre', partLabel, 'insumo');
      }
      if (corpus.includes('velcro') || corpus.includes('contacto')) {
        addMat('Velcro / Contacto', partLabel, 'insumo');
      }
      if (corpus.includes('entretela') || corpus.includes('cuello') || corpus.includes('puño')) {
        addMat('Entretela Fusionable', partLabel, 'tela');
      }
      if (corpus.includes('reflectiv') || corpus.includes('cinta')) {
        addMat('Cinta Reflectiva', partLabel, 'insumo');
      }
      if (corpus.includes('elástico') || corpus.includes('elastico') || corpus.includes('resorte')) {
        addMat('Elástico', partLabel, 'insumo');
      }
      if (corpus.includes('forro') || corpus.includes('bolsillo')) {
        addMat('Tela Forro', partLabel, 'tela');
      }
    });

    return Array.from(map.values()).map(item => ({
      name: item.name,
      type: item.type,
      sourceParts: Array.from(item.sourceParts).sort(),
      siesaRef: item.siesaRef,
      siesaDesc: item.siesaDesc,
      color: item.color,
      comment: item.comment
    }));
  }

  private isTransversalPart(part: any): boolean {
    const name = (part.name || '').toLowerCase();
    const zone = (part.zone_type || part.zone_name || '').toLowerCase();
    return zone === 'opcional' || 
           name.includes('reflectiv') || 
           name.includes('bordad') || 
           name.includes('estampad') || 
           name.includes('logo') || 
           name.includes('transfer') || 
           name.includes('cinta');
  }

  private getOptionalIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('reflectiv') || n.includes('cinta')) return 'bi-stars';
    if (n.includes('bordad')) return 'bi-patch-check-fill';
    if (n.includes('estampad') || n.includes('transfer') || n.includes('logo')) return 'bi-brush-fill';
    return 'bi-gem';
  }

  extractVariantName(part: any): string {
    if (!part) return 'Estándar';
    if (part.selected_type_name) return part.selected_type_name;
    if (part.part_type?.name) return part.part_type.name;
    if (part.partType?.name) return part.partType.name;
    if (part.technical_spec && part.technical_spec.length < 60) return part.technical_spec;
    if (part.types && part.types.length > 0 && part.selected_type_id) {
      const t = part.types.find((x: any) => Number(x.id) === Number(part.selected_type_id));
      if (t?.name) return t.name;
    }
    return '';
  }

  private inferZoneFromPartName(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('cuello') || n.includes('solapa') || n.includes('pie de cuello')) return 'cuello';
    if (n.includes('manga') || n.includes('puño') || n.includes('sisa')) return 'manga';
    if (n.includes('pecho') || n.includes('delantero') || n.includes('bolsillo') || n.includes('cartera') || n.includes('pechera')) return 'pecho';
    if (n.includes('espalda') || n.includes('almilla') || n.includes('canesu') || n.includes('canesú')) return 'espalda';
    if (n.includes('pretina') || n.includes('cintura') || n.includes('pasador')) return 'pretina';
    if (n.includes('pierna') || n.includes('bota') || n.includes('tiro') || n.includes('rodilla')) return 'pierna_bota';
    return 'general';
  }

  getOpmState(item: any): 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETO' {
    if (!item) return 'PENDIENTE';
    const spec = item.technical_spec;
    if (spec?.status === 'COMPLETADO' || spec?.status === 'PUBLICADO' || spec?.status === 'APROBADO') {
      return 'COMPLETO';
    }
    if (spec?.status === 'EN_PROCESO') {
      return 'EN_PROCESO';
    }

    const parts = spec?.parts || item.mold?.parts || [];
    if (!parts || parts.length === 0) return 'PENDIENTE';

    let filledCount = 0;
    for (const p of parts) {
      if (!!p.technical_spec || !!p.inventory_reference || !!p.inventory_description) {
        filledCount++;
      }
    }

    if (filledCount >= parts.length) {
      return 'COMPLETO';
    } else if (filledCount > 0) {
      return 'EN_PROCESO';
    }

    return 'PENDIENTE';
  }

  esOpmTecnicaCompleta(item: any): boolean {
    return this.getOpmState(item) === 'COMPLETO';
  }

  getSolicitudObservaciones(): string {
    return this.costeo?.observaciones || '';
  }

  getOpmBadgeInfo(item: any): { label: string; bgClass: string; icon: string } {
    const state = this.getOpmState(item);
    if (state === 'COMPLETO') {
      return {
        label: 'Especificación Completa',
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'bi-check-circle-fill'
      };
    } else if (state === 'EN_PROCESO') {
      return {
        label: 'Especificación en Proceso',
        bgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        icon: 'bi-gear-fill'
      };
    }
    return {
      label: 'Borrador Comercial',
      bgClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: 'bi-clock-history'
    };
  }
}

