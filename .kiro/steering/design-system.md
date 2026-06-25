---
inclusion: auto
---

# Saint Design System — Guía de Estilo Visual

## Paleta de Colores

| Token | Valor | Uso |
|-------|-------|-----|
| Primary | `rgb(41, 54, 129)` / `blue-900` | Títulos, texto principal bold, estados importantes |
| Secondary | `rgb(66, 116, 217)` / `blue-600` | Botones activos, links, tabs activos, iconos |
| Accent | `rgb(149, 204, 221)` | Bordes decorativos, badges info, scrollbars |
| Light | `rgb(208, 231, 230)` | Fondos hover, separadores, backgrounds sutiles |
| Background | `#f8f9fc` | Fondo de página |
| Surface | `#ffffff` | Cards, modales, sidebars |

## Tipografía (Inter)

| Elemento | Clases Tailwind |
|----------|----------------|
| Título de página | `text-lg font-bold text-gray-900 tracking-tight` |
| Subtítulo / section header | `text-sm font-semibold text-gray-900` |
| Labels de filtros | `text-[10px] font-black uppercase tracking-wider` |
| Texto de body / tabla | `text-xs` o `text-sm` |
| Text muted | `text-slate-400` o `text-gray-500` |
| Valores numéricos grandes | `text-xl font-bold text-gray-900` |

## Componentes Base

### Contenedores de filtros
```html
<div class="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
```

### Botón de filtro activo/inactivo
```html
<!-- Activo -->
<button class="px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-blue-600 text-white shadow-sm">
<!-- Inactivo -->
<button class="px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50">
```

### Input de búsqueda
```html
<input class="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors" />
```

### Cards
```html
<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
```

### Tabs estilo pill
```html
<nav class="flex items-center gap-0.5 bg-gray-100 p-1 rounded-xl">
  <!-- Tab activo -->
  <button class="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-blue-700 shadow-sm">
  <!-- Tab inactivo -->
  <button class="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-500 hover:text-gray-800 hover:bg-white/60">
</nav>
```

### Status badges
```html
<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-green-100 text-green-700">
```

### Toast/Alerts
```html
<div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium bg-green-50 border-green-200 text-green-800">
```

## Principios

1. **Compacto**: Usar `gap-0.5` a `gap-2`, `px-2 py-1` a `px-3 py-1.5`. Nada de padding excesivo.
2. **Pesos definidos**: `font-black` para labels uppercase, `font-bold`/`font-semibold` para títulos, `font-medium` para texto activo.
3. **Colores slate**: Preferir `slate-200`, `slate-400`, `slate-600` sobre `gray` para tonos fríos.
4. **Bordes sutiles**: `border border-slate-200` en vez de sombras pesadas.
5. **Rounded suave**: `rounded-lg` (8px) para elementos internos, `rounded-xl` (12px) para cards.
6. **Sin gradientes**: Solo colores sólidos. Excepción: icono de brand.
7. **Uppercase tracking-wider**: Para labels de filtros y categorías, siempre en `text-[10px]`.
8. **Estados claros**: Activo = fondo sólido azul + texto blanco. Inactivo = texto gris + hover sutil.
9. **Transiciones**: `transition-all duration-150` o `transition-colors` para suavidad.
10. **Iconos**: Bootstrap Icons (`bi bi-*`) o Material Design Icons (`mdi mdi-*`), siempre `text-sm` o `text-xs`.
