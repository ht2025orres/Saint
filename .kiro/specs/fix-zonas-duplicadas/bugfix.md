# Bugfix Requirements Document

## Introduction

El módulo de inventario permite crear zonas con nombres repetidos dentro de la misma bodega, lo que genera duplicados silenciosos en la base de datos. Esto produce inconsistencias en la asignación de ítems: un ítem puede estar vinculado a una zona duplicada que queda "abandonada", dificultando la gestión y el conteo del inventario.

Este bugfix introduce una herramienta de corrección controlada (endpoint en Laravel, invocable desde el frontend) que:
1. Detecta todos los grupos de zonas con el mismo nombre dentro de la misma bodega.
2. Para cada grupo duplicado, conserva una zona como "principal" (la de menor `id`) y deshabilita el resto.
3. Reasigna al principal los ítems que estaban asociados exclusivamente a las zonas deshabilitadas (comparando por `id` exacto de zona).
4. Devuelve un resumen detallado de todo lo corregido para que el usuario pueda revisarlo.

## Bug Analysis

### Current Behavior (Defect)

1.1 CUANDO se crea una zona con un `nombre` ya existente para el mismo `codigo_bodega` ENTONCES el sistema permite guardarla sin error, generando un duplicado en la base de datos.

1.2 CUANDO existen zonas duplicadas (mismo nombre, misma bodega) y un ítem está asignado a una zona que no es la principal ENTONCES el sistema muestra el ítem bajo una zona que coexiste con otras de idéntico nombre, imposibilitando determinar cuál es la correcta.

1.3 CUANDO se ejecuta la herramienta de corrección sin la existencia de duplicados ENTONCES el sistema no cuenta con un mecanismo que informe al operador que no hay nada que corregir (ausencia de feedback).

### Expected Behavior (Correct)

2.1 CUANDO se invoca el endpoint `POST /inventario/zonas/corregir-duplicadas` ENTONCES el sistema SHALL detectar todos los grupos de zonas con el mismo `nombre` dentro del mismo `codigo_bodega` que tengan más de un registro.

2.2 CUANDO se detecta un grupo de zonas duplicadas ENTONCES el sistema SHALL conservar la zona con el `id` más bajo como zona principal y deshabilitar (`activo = false` o equivalente) todas las demás del grupo.

2.3 CUANDO una zona a deshabilitar tiene ítems asignados (identificados por `id_zona` exacto) ENTONCES el sistema SHALL reasignar esos ítems a la zona principal del grupo antes de deshabilitar la zona duplicada.

2.4 CUANDO un ítem ya estaba asignado tanto a la zona principal como a una zona duplicada ENTONCES el sistema SHALL omitir la reasignación de ese ítem (evitar duplicar la asociación) y solo deshabilitar la zona duplicada.

2.5 CUANDO el proceso finaliza ENTONCES el sistema SHALL retornar un objeto JSON con el resumen: cantidad de grupos procesados, zonas deshabilitadas, ítems reasignados y detalle por bodega.

2.6 CUANDO no existen zonas duplicadas en ninguna bodega ENTONCES el sistema SHALL retornar una respuesta exitosa indicando que no se encontraron duplicados y que no se realizó ninguna corrección.

2.7 CUANDO se invoca `POST /inventario/zonas` con un `nombre` que ya existe (comparación case-insensitive) para el mismo `codigo_bodega` ENTONCES el sistema SHALL rechazar la creación con HTTP 422 y un mensaje de error claro: `"Ya existe una zona con el nombre '{nombre}' en esta bodega."`.

2.8 CUANDO el frontend recibe el error HTTP 422 de creación de zona duplicada ENTONCES el sistema SHALL mostrar el mensaje de error del servidor en el modal de creación de zona usando SweetAlert2, en lugar del mensaje genérico actual.

### Unchanged Behavior (Regression Prevention)

3.1 CUANDO se consulta `GET /inventario/zonas` sin el parámetro `codigo_bodega` ENTONCES el sistema SHALL CONTINUE TO retornar todas las zonas activas sin alteraciones en su estructura de respuesta.

3.2 CUANDO se consulta `GET /inventario/zonas?codigo_bodega=X` ENTONCES el sistema SHALL CONTINUE TO retornar solo las zonas activas de esa bodega, excluyendo correctamente las deshabilitadas.

3.3 CUANDO se crea una nueva zona con `POST /inventario/zonas` para un nombre y bodega que no tienen duplicados ENTONCES el sistema SHALL CONTINUE TO crear la zona correctamente sin cambios en el comportamiento actual.

3.4 CUANDO se invoca `POST /inventario/asignar-zona-items` con un payload válido ENTONCES el sistema SHALL CONTINUE TO asignar los ítems a la zona indicada sin cambios en la lógica existente.

3.5 CUANDO se invoca `DELETE /inventario/eliminar-zonas-masivo` con un payload válido ENTONCES el sistema SHALL CONTINUE TO desvincular los ítems de la zona indicada sin cambios en la lógica existente.

3.6 CUANDO un ítem está asignado únicamente a zonas no duplicadas (zona principal activa) ENTONCES el sistema SHALL CONTINUE TO mostrar correctamente la asignación de zona del ítem en el frontend (`GestionZonasComponent`).

---

## Bug Condition (Pseudocódigo)

### Condición de Bug

```pascal
FUNCTION isBugCondition(zona)
  INPUT: zona de tipo Zona { id, nombre, codigo_bodega, activo }
  OUTPUT: boolean

  // Una zona es "buggy" si existe al menos otra zona con el mismo nombre
  // dentro de la misma bodega (es duplicada)
  RETURN COUNT(zonas WHERE nombre = zona.nombre AND codigo_bodega = zona.codigo_bodega) > 1
END FUNCTION
```

### Propiedad — Fix Checking

```pascal
// Propiedad: todas las zonas que satisfacen la condición de bug deben ser corregidas
FOR ALL grupo WHERE isBugCondition(grupo.cualquier_zona) DO
  zonaPrincipal ← zona con MIN(id) en grupo
  zonasADeshabilitar ← grupo \ {zonaPrincipal}

  resultado ← corregirDuplicadas'(grupo)

  ASSERT zonaPrincipal.activo = true
  ASSERT FOR ALL z IN zonasADeshabilitar: z.activo = false
  ASSERT FOR ALL item QUE TENIA id_zona IN zonasADeshabilitar:
    item.id_zona = zonaPrincipal.id  // reasignado
END FOR
```

### Propiedad — Preservation Checking

```pascal
// Propiedad: zonas sin duplicados y sus ítems no deben verse afectados
FOR ALL zona WHERE NOT isBugCondition(zona) DO
  ASSERT zona.activo = F(zona).activo         // sin cambio de estado
  ASSERT items(zona) = F'(items(zona))        // sin cambio en asignaciones
END FOR
```
