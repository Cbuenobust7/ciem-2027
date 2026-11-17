# Band Studio Starter Kit — alcance de la demo

Demo: `/band-studio-starter-kit/`. Landing de banda ficticia con releases, galería ilustrativa, agenda de ejemplo y un flujo de selección/previsualización local para imágenes, video y audio.

## Workspace musical

- Canciones de muestra e ideas creadas por el visitante.
- Versiones inmutables de letra, idea, arreglo o nota de producción.
- Historial por canción, estados borrador/revisión/aprobado, comentarios asociados a una revisión.
- Comparación en paralelo de las dos versiones más recientes.
- Persistencia local de texto y estados en `localStorage` (`ciem-band-studio-v1`).
- Hasta 30 canciones, 100 versiones por canción y 500 comentarios por canción.

## Límites deliberados

La carga multimedia crea URLs locales de vista previa y revoca estas al quitarlas o salir de la página. Los archivos no se transfieren ni se almacenan y las vistas previas desaparecen al terminar la sesión. La demo no tiene usuarios ni permisos, no sincroniza datos y no es privada: todo lo escrito puede quedar visible para quien abra el workspace público. Usar solo datos ficticios; no subir material confidencial, personal o sujeto a licencias musicales de terceros.

No es un Git real: no hay ramas, merge, control de acceso, respaldo, servidor, historial de auditoría o colaboración concurrente. La comparación visualiza snapshots; no produce un diff semántico de letras o audio.

## Pruebas

`node --test catalog-tools/test_band_studio_starter.mjs`
