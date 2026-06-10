# Mantenimiento CRUD del sistema de tienda

Este mantenimiento aplica solo a categorias, productos y ventas. La tabla `usuarios` no se modifica porque los perfiles son fijos.

## Categorias

- Consultar: `GET backend.php?action=listCategories`
  - PHP consulta la tabla `categorias`.
  - JavaScript carga el resultado en `categories` y lo muestra en `#categories-tbody`.

- Adicionar: `POST backend.php?action=addCategory`
  - PHP valida campos obligatorios y que el ID no exista.
  - JavaScript captura los datos del modal y refresca la tabla sin recargar la pagina.

- Modificar: `POST backend.php?action=updateCategory`
  - PHP valida campos y actualiza la categoria.
  - Si cambia el nombre, PHP actualiza productos asociados para mantener consistencia.
  - JavaScript abre el modal con datos actuales y envia los cambios.

- Eliminar: `POST backend.php?action=deleteCategory`
  - PHP valida que no existan productos asociados.
  - PHP guarda el motivo en `logs_eliminaciones`.
  - JavaScript confirma con el usuario, pide motivo y refresca la tabla.

## Productos

- Consultar: `GET backend.php?action=listProducts`
  - PHP consulta la tabla `productos`.
  - JavaScript muestra el listado en `#inventory-tbody`.

- Adicionar: `POST backend.php?action=addProduct`
  - PHP valida ID unico, campos obligatorios, precio positivo y stock positivo.
  - JavaScript captura el formulario y actualiza la tabla dinamicamente.

- Modificar: `POST backend.php?action=updateProduct`
  - PHP valida existencia, campos obligatorios, precio positivo y stock positivo.
  - JavaScript abre el modal con los datos actuales, envia cambios y refresca la vista.

- Eliminar: `POST backend.php?action=deleteProduct`
  - PHP elimina el producto y registra el motivo en `logs_eliminaciones`.
  - JavaScript confirma con el usuario, pide motivo y refresca productos/reportes.

## Ventas

- Consultar: `GET backend.php?action=listSales`
  - PHP retorna las ventas guardadas en `datos_sistema`.
  - JavaScript las muestra como listado basico en reportes, sin filtros avanzados.

- Adicionar: `POST backend.php?action=confirmSale`
  - PHP registra la venta y descuenta stock.
  - JavaScript envia la venta generada desde el POS y actualiza las tablas sin recargar.
