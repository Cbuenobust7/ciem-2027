# Magazine Starter Kit

Demo estática de una revista digital de CIEM. La edición ficticia MARGEN usa seis artículos originales de demostración, autores ficticios y fotografías de archivo de Pexels.

Incluye portada destacada, archivo por categoría, búsqueda, lector, guardados, marcado de lectura, enlace compartible, impresión y un panel editorial con creación, edición, borrador, publicación y archivo. El destacado solo puede ser un artículo publicado; al retirarlo se elige otro disponible.

El boletín es una simulación: se valida un correo ficticio y se guarda únicamente un indicador booleano, sin guardar ni enviar la dirección. Los datos editoriales y de lectura están en localStorage con la clave ciem-magazine-starter-v1.

No hay backend, CMS privado, autenticación, medios subidos, newsletters reales o paywall. Todos los artículos están en el código público. No usar información privada.

Pruebas: node --test catalog-tools/test_magazine_starter.mjs (6 casos). También se verificó en Chrome el recorrido de búsqueda, borrador, publicación, destacado, lector, guardados, edición, archivo, newsletter y reinicio.

Fotografías: ver creditos.html y photo-sources.json en la demo. Licencia de terceros conservada; no son assets originales de CIEM.
