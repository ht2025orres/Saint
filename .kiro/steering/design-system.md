# Sistema de Diseño — SaINT Design System

## Objetivo

Toda interfaz generada debe seguir estrictamente este lenguaje visual. No crear componentes nuevos que rompan la identidad. Antes de añadir elementos, reutilizar patrones existentes.

La referencia es un dashboard financiero moderno inspirado en **Stripe**, **Linear**, **Vercel** y **Arc Browser**, combinando estética corporativa con sensación premium.

## Cinco Pilares

1. Simplicidad
2. Jerarquía visual evidente
3. Navegabilidad inmediata
4. Consistencia absoluta
5. Convencionalidad (el usuario nunca debe preguntarse dónde está algo)

## Filosofía

El sistema transmite: **precisión, confianza, claridad, orden, elegancia**.

- Todo elemento debe tener un propósito.
- Eliminar cualquier ruido visual.
- Si una decisión de diseño no mejora la comprensión del usuario, eliminarla.

## Estilo General

- Visual limpio
- Muchísimo espacio en blanco
- Bordes suaves
- Contrastes bajos
- Sombras delicadas
- Microdetalles elegantes
- Nada debe sentirse pesado

## Personalidad

El sistema debe sentirse como una mezcla de: Stripe Dashboard, Linear, Arc Browser, Notion (espaciado), Vercel, Raycast.

Nunca parecer:
- Un template de Bootstrap
- Un panel administrativo genérico
- Material Design clásico

---

## Paleta Principal

| Rol | Color | Hex | Uso |
|-----|-------|-----|-----|
| **Primary** | Deep Indigo | `#3F347F` | Header, Navbar, Sidebar, Botones primarios, Elementos activos |
| **Primary Dark** | — | `#31296B` | Hover, Elementos seleccionados, Fondos secundarios |
| **Primary Light** | — | `#5A4CB4` | Estados activos, Pequeños acentos, Indicadores |
| **Background** | — | `#F6F7FB` | Fondo principal de la aplicación (nunca blanco puro) |
| **Cards** | — | `#FFFFFF` | Superficies de tarjetas |
| **Borders** | — | `#E8EAF3` | Bordes y separadores |
| **Text Primary** | — | `#111827` | Texto principal |
| **Text Secondary** | — | `#6B7280` | Texto secundario |
| **Text Tertiary** | — | `#9CA3AF` | Texto terciario / placeholder |

## Colores Semánticos

| Estado | Principal | Fondo | Borde |
|--------|-----------|-------|-------|
| Error | `#EF4444` | `#FEECEC` | `#F87171` |
| Warning | `#F59E0B` | `#FFF7E8` | `#FBBF24` |
| Success | `#10B981` | `#ECFDF5` | `#34D399` |
| Neutral | `#64748B` | — | — |

## Colores KPI

| KPI | Color |
|-----|-------|
| Costo | Rojo |
| Ahorro | Verde |
| Tiempo | Gris |
| Neto | Morado |
| Advertencia | Naranja |

---

## Tipografía

| Uso | Fuente | Peso |
|-----|--------|------|
| Títulos (Dashboard, Cards, Tabs, Menús, KPIs, Encabezados) | **Quicksand** | 700 |
| Texto (descripciones, labels, tablas, inputs, ayudas, tooltips) | **Inter** | 400 |

### Escala Tipográfica (px)

| Nivel | Tamaño |
|-------|--------|
| Dashboard | 34 |
| Página | 28 |
| Sección | 22 |
| Card | 18 |
| Subtítulo | 16 |
| Texto | 14 |
| Ayuda | 12 |
| Microtexto | 11 |

---

## Espaciado

- **Base:** 8px
- **Escala:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- Nunca usar espacios arbitrarios.

## Border Radius

| Elemento | Radius |
|----------|--------|
| Inputs | 12px |
| Cards | 18px |
| Botones | 12px |
| Charts | 18px |
| Modales | 24px |
| Floating button | 999px |

## Sombras

Muy suaves. Ejemplo: `0 6px 24px rgba(20, 20, 40, 0.06)`

Nunca sombras oscuras.

---

## Componentes

### Header

- Ocupa todo el ancho
- Altura: 90–110px
- Color: Deep Indigo
- Contenido izquierda: icono + título + descripción
- Contenido derecha: filtros (todos alineados horizontalmente, mismo alto, nunca romper alineación)

### Cards KPI (Diseño Obligatorio)

```
┌─────────────────────────────────
│  icono
│  título pequeño
│  valor grande
│  descripción
│  detalle inferior
└─────────────────────────────────
```

Características:
- Fondo blanco
- Borde izquierdo coloreado
- Esquina muy redondeada
- Sombra ligera
- Icono sobre fondo pastel
- Decoración circular muy transparente en esquina superior derecha
- Mucho padding

### Inputs

- Altura: 44–48px
- Radius: 12px
- Borde: `#D9DCE7`
- Hover: `#BFC5D8`
- Focus: Color primario + shadow muy suave

### Botones

| Tipo | Estilo |
|------|--------|
| Primario | Deep Indigo, texto blanco, radius 12, hover más oscuro |
| Secundario | Fondo blanco, borde gris |
| Ghost | Sin fondo |

### Tablas

- Muy limpias
- Cabecera gris muy clara
- Filas altas
- Hover extremadamente suave
- Separadores finos
- Nunca líneas fuertes

### Gráficos

- Mucho espacio
- Grid muy tenue
- Leyendas arriba
- Colores: Rojo `#EF4444`, Naranja `#F59E0B`, Verde `#10B981`, Morado `#6366F1`, Azul `#3B82F6`
- No más de 5 colores simultáneamente

---

## Iconografía

- Únicamente iconos **outline**
- Stroke: 2px
- Nunca usar iconos rellenos
- Bibliotecas: Lucide, Heroicons, Tabler Icons

---

## Distribución de Página (Jerarquía Obligatoria)

```
Header
  ↓
KPIs
  ↓
Gráfico principal
  ↓
Gráficos secundarios
  ↓
Tablas
  ↓
Detalle
```

Nunca alterar este orden.

---

## Navegación

El usuario debe comprender dónde está en menos de 3 segundos. Toda pantalla responde:
- ¿Qué estoy viendo?
- ¿Dónde estoy?
- ¿Qué puedo hacer?
- ¿Qué es importante?

---

## Espacio Negativo

El espacio vacío es parte del diseño. No rellenarlo. Respirar entre bloques. Nunca compactar demasiado.

---

## Animaciones

- Duración: 200–250ms
- Easing: `ease-out`
- Animar únicamente: hover, focus, apertura, expansión, cambio de filtros
- Nunca animaciones largas, rebotes, ni efectos exagerados

---

## Accesibilidad

- Contraste AA
- Estados hover visibles
- Estados focus claros
- Iconos acompañados de texto en acciones críticas
- Nunca depender únicamente del color

---

## Responsive

- **Desktop primero**
- Breakpoints: 1440, 1280, 1024, 768, 480
- Las cards KPI se reorganizan manteniendo el mismo tamaño visual

---

## Componentes Reutilizables

Crear únicamente mediante composición:

- `DashboardHeader`
- `SectionHeader`
- `StatCard`
- `MetricCard`
- `ChartCard`
- `TableCard`
- `InfoBadge`
- `StatusBadge`
- `FilterBar`
- `SearchInput`
- `PrimaryButton`
- `SecondaryButton`
- `GhostButton`
- `FloatingActionButton`
- `EmptyState`
- `LoadingSkeleton`

No crear variantes innecesarias.

---

## Estados Vacíos

No mostrar únicamente "Sin datos". Mostrar:
- Icono
- Mensaje
- Explicación
- Acción recomendada

Mantener el mismo estilo visual.

---

## Reglas Estrictas — Siempre Respetar

- ✓ Márgenes consistentes
- ✓ Padding uniforme
- ✓ Quicksand para títulos
- ✓ Inter para contenido
- ✓ Mucho espacio en blanco
- ✓ Bordes suaves
- ✓ Colores semánticos consistentes
- ✓ Sombras mínimas
- ✓ Jerarquía clara
- ✓ Componentes reutilizables
- ✓ Alineaciones perfectas
- ✓ Iconografía outline
- ✓ Layout limpio
- ✓ Diseño modular
- ✓ Consistencia absoluta

---

## Prohibido

- ✗ Degradados fuertes
- ✗ Tarjetas oscuras sobre fondos claros (excepto header)
- ✗ Colores saturados
- ✗ Más de una familia visual de iconos
- ✗ Bordes negros
- ✗ Tipografías diferentes a Quicksand/Inter
- ✗ Más de dos pesos tipográficos por componente
- ✗ Tablas densas
- ✗ Sombras pronunciadas
- ✗ Esquinas rectas
- ✗ Animaciones decorativas
- ✗ Romper el sistema de espaciado
- ✗ Nuevos colores fuera de la paleta
- ✗ Cambiar la jerarquía visual establecida
- ✗ Componentes únicos cuando puedan componerse a partir de los existentes
- ✗ Glassmorphism
- ✗ Neomorphism
- ✗ Gradientes agresivos
- ✗ Efectos llamativos
