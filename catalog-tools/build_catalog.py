from pathlib import Path
import json, zipfile, html, shutil, textwrap
from PIL import Image, ImageDraw, ImageFont
ROOT=Path('/home/carlos/marketplace-ciem')
OUT=ROOT/'frontend/public/catalog'; OUT.mkdir(parents=True,exist_ok=True)
CATEGORIES=[('templates-web','Templates web'),('plugins-wordpress','Plugins WordPress'),('plataformas-web','Plataformas web'),('componentes-ui','Componentes UI'),('tiendas-online','Tiendas online'),('desarrollo-a-medida','Desarrollo a medida')]
ITEMS=[
('landing-negocio','Template landing para negocios','templates-web','download','Una página de presentación con servicios, beneficios y contacto. HTML y CSS editables.'),
('portfolio-profesional','Template portfolio profesional','templates-web','download','Presentación personal, proyectos y contacto. Una base estática para profesionales independientes.'),
('restaurante-menu','Template de carta para restaurante','templates-web','download','Carta digital con categorías y precios de ejemplo editables. Sin pagos ni pedidos automatizados.'),
('consultoria-servicios','Template para consultoría y servicios','templates-web','download','Presentación de servicios profesionales, proceso de trabajo y preguntas frecuentes.'),
('wp-contacto-whatsapp','Plugin WordPress: contacto por WhatsApp','plugins-wordpress','plugin','Shortcode configurable para mostrar un enlace de WhatsApp. Incluye número y texto mediante atributos.'),
('wp-barra-aviso','Plugin WordPress: aviso destacado','plugins-wordpress','plugin','Shortcode para publicar un aviso con texto y enlace opcional, sin dependencias externas.'),
('wp-faq-simple','Plugin WordPress: preguntas frecuentes','plugins-wordpress','plugin','Shortcode para preguntas y respuestas desplegables con HTML nativo y contenido editable.'),
('panel-indicadores','Componente: panel de indicadores','componentes-ui','download','Maqueta HTML de tarjetas de métricas y tabla. Datos ilustrativos; sin conexión a una base de datos.'),
('seccion-precios','Componente: comparador de planes','componentes-ui','download','Sección HTML para comparar planes. Los importes de la maqueta son ejemplos editables.'),
('faq-contacto','Componente: preguntas frecuentes','componentes-ui','download','Sección accesible de preguntas desplegables con details y summary, lista para adaptar.'),
('plataforma-reservas','Plataforma de reservas — desarrollo por encargo','plataformas-web','quote','Propuesta para gestionar servicios, horarios y solicitudes de reserva. Roles, calendario y notificaciones se evalúan según el proyecto.'),
('plataforma-cursos','Plataforma de cursos — desarrollo por encargo','plataformas-web','quote','Propuesta para organizar cursos, lecciones y acceso de alumnos. Pagos, evaluaciones y certificados requieren definición de alcance.'),
('crm-comercial','CRM para pequeños negocios — desarrollo por encargo','plataformas-web','quote','Propuesta para organizar contactos, oportunidades y seguimiento comercial. Las integraciones se evalúan durante la cotización.'),
('gestion-inventario','Sistema de inventario — desarrollo por encargo','plataformas-web','quote','Propuesta para registrar productos, entradas, salidas y reportes. Almacenes, permisos y reglas se acuerdan con el equipo.'),
('portal-clientes','Portal de clientes — desarrollo por encargo','plataformas-web','quote','Propuesta para centralizar solicitudes, documentos y seguimiento con acceso privado. Seguridad e integraciones se definen en el alcance.'),
('tienda-wordpress','Tienda con WordPress — implementación por encargo','tiendas-online','quote','Evaluación e implementación de una tienda sobre WordPress. Catálogo, pagos, envíos y licencias se cotizan según las necesidades.'),
('catalogo-whatsapp','Catálogo con pedidos por WhatsApp — por encargo','tiendas-online','quote','Propuesta para mostrar productos y derivar consultas o pedidos a WhatsApp. No incluye pagos ni gestión logística sin evaluación previa.'),
('plataforma-desde-cero','Tu plataforma a medida desde cero','desarrollo-a-medida','quote','Diseño y desarrollo de una plataforma según tu negocio. Definimos usuarios, funcionalidades, integraciones, prioridades y fases antes de cotizar.'),
]
LICENSE='''MIT License\nCopyright (c) 2026 CIEM\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n'''
STYLE='''*{box-sizing:border-box}body{margin:0;font:17px/1.65 system-ui,sans-serif;color:#101f65;background:#f5f8fc}main,nav{max-width:1000px;margin:auto;padding:28px}nav{display:flex;justify-content:space-between}a{color:#101f65}header{background:#101f65;color:white;padding:64px 28px}header>div{max-width:944px;margin:auto}h1{font-size:clamp(32px,6vw,54px);line-height:1.15;max-width:780px}h2{font-size:28px}small{color:#06d69a}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}article,details{background:white;border:1px solid #dce3ed;border-radius:12px;padding:24px;margin-bottom:16px}summary{cursor:pointer;font-weight:bold}.cta{display:inline-block;background:#06d69a;border-radius:8px;padding:12px 20px;text-decoration:none;font-weight:700}footer{padding:30px;text-align:center}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:14px;border-bottom:1px solid #ddd}'''
def markup(slug,title,desc):
 esc=html.escape
 if slug=='restaurante-menu':
  blocks=''.join(f'<article><h3>{name}</h3><p>Descripción de ejemplo. Cambia ingredientes y precio.</p><strong>S/ {price} · ejemplo</strong></article>' for name,price in [('Entrada del día','12'),('Plato de temporada','24'),('Postre de la casa','10')])
 elif slug=='portfolio-profesional':
  blocks=''.join(f'<article><h3>Proyecto {n}</h3><p>Describe el reto, tu participación y el resultado. Sustituye este contenido de ejemplo.</p></article>' for n in range(1,4))
 elif slug=='panel-indicadores':
  blocks=''.join(f'<article><h3>{label}</h3><strong>{value}</strong><p>Dato ilustrativo</p></article>' for label,value in [('Ventas','120'),('Clientes','48'),('Solicitudes','16')])
 elif slug=='seccion-precios':
  blocks=''.join(f'<article><h3>{label}</h3><p>S/ {value} · importe de ejemplo</p><ul><li>Característica editable</li><li>Alcance de ejemplo</li></ul><a href="#contacto">Consultar este plan</a></article>' for label,value in [('Inicial','99'),('Negocio','199'),('Profesional','299')])
 else:
  blocks=''.join(f'<article><h3>{label}</h3><p>Contenido de ejemplo para adaptar a tu negocio y a las necesidades de tus clientes.</p></article>' for label in ['Presenta tu propuesta','Explica tus servicios','Invita a conversar'])
 faq=''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q,a in [('¿Cómo se utiliza?','Edita el archivo index.html y sustituye los textos de ejemplo.'),('¿Incluye backend?','Esta base es estática. Los formularios, pagos y datos requieren implementación adicional.'),('¿Se puede personalizar?','Sí. Modifica los estilos y el contenido según tu proyecto.')])
 return f'''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><style>{STYLE}</style><body><nav><strong>Tu marca</strong><a href="#contacto">Contacto</a></nav><header><div><small>BASE EDITABLE · CIEM</small><h1>{esc(title)}</h1><p>{esc(desc)}</p><a class="cta" href="#contenido">Explorar</a></div></header><main><section id="contenido"><h2>Una base para tu próximo proyecto</h2><div class="grid">{blocks}</div></section><section><h2>Preguntas frecuentes</h2>{faq}</section><section id="contacto"><h2>Hablemos de tu proyecto</h2><p>Sustituye este correo por tu contacto real.</p><a class="cta" href="mailto:contacto@example.com">Escribir un mensaje</a></section></main><footer>Contenido de demostración editable · Licencia MIT</footer></body></html>'''
PLUGINS={
'wp-contacto-whatsapp':'''add_shortcode('ciem_whatsapp', function($atts) {
 $a = shortcode_atts(array('numero'=>'','texto'=>'Contactar por WhatsApp','mensaje'=>''), $atts, 'ciem_whatsapp');
 $number = preg_replace('/[^0-9]/', '', $a['numero']);
 if (!$number) return '';
 $url = 'https://wa.me/' . $number;
 if ($a['mensaje'] !== '') $url = add_query_arg('text', $a['mensaje'], $url);
 return '<a style="display:inline-block;background:#25d366;color:#083b20;padding:12px 18px;border-radius:8px;font-weight:700;text-decoration:none" target="_blank" rel="noopener noreferrer" href="'.esc_url($url).'">'.esc_html($a['texto']).'</a>';
});''',
'wp-barra-aviso':'''add_shortcode('ciem_aviso', function($atts) {
 $a = shortcode_atts(array('texto'=>'','url'=>'','enlace'=>'Más información'), $atts, 'ciem_aviso');
 if ($a['texto'] === '') return '';
 $link = $a['url'] !== '' ? ' <a style="color:#06d69a" href="'.esc_url($a['url']).'">'.esc_html($a['enlace']).'</a>' : '';
 return '<aside style="background:#101f65;color:white;padding:16px;border-radius:8px">'.esc_html($a['texto']).$link.'</aside>';
});''',
'wp-faq-simple':'''add_shortcode('ciem_faq', function($atts) {
 $a = shortcode_atts(array('pregunta'=>'','respuesta'=>''), $atts, 'ciem_faq');
 if ($a['pregunta'] === '') return '';
 return '<details style="border:1px solid #d8e1ee;border-radius:8px;padding:16px;margin:12px 0"><summary style="cursor:pointer;font-weight:700">'.esc_html($a['pregunta']).'</summary><p>'.nl2br(esc_html($a['respuesta'])).'</p></details>';
});'''}
USAGE={'wp-contacto-whatsapp':'[ciem_whatsapp numero="51999989709" texto="Contactar" mensaje="Hola"]','wp-barra-aviso':'[ciem_aviso texto="Escribe tu anuncio" url="https://example.com" enlace="Ver detalle"]','wp-faq-simple':'[ciem_faq pregunta="¿Cómo contacto?" respuesta="Escribe aquí tu respuesta."]'}
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',34)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
catalog=[]
for slug,title,cat,kind,desc in ITEMS:
 folder=OUT/slug;folder.mkdir(exist_ok=True)
 download=None
 if kind in ('download','plugin'):
  files={'LICENSE.txt':LICENSE}
  if kind=='plugin':
   php=f'<?php\n/*\nPlugin Name: {title}\nDescription: {desc}\nVersion: 1.0.0\nAuthor: CIEM\nLicense: MIT\n*/\nif (!defined("ABSPATH")) {{ exit; }}\n'+PLUGINS[slug]+'\n'
   files[slug+'.php']=php
   files['README.txt']=title+'\n\nInstalación: sube el ZIP desde Plugins > Añadir nuevo > Subir plugin, actívalo e inserta el shortcode en una página.\n\nEjemplo:\n'+USAGE[slug]+'\n\nValida en una instalación de pruebas antes de producción. No se han realizado pruebas de integración en WordPress. Sin panel de configuración, servicios externos ni soporte incluido.\nLicencia MIT.\n'
   (folder/(slug+'.php')).write_text(php)
  else:
   files['index.html']=markup(slug,title,desc)
   files['README.txt']=title+'\n\nAbre index.html en tu navegador y edita el HTML/CSS. Sin dependencias ni compilación. Sustituye datos, precios, correos y textos de ejemplo antes de publicar. No incluye backend, pagos, cuentas ni integración con servicios. Personalización y hosting se cotizan aparte.\nLicencia MIT.\n'
   (folder/'index.html').write_text(files['index.html'])
  with zipfile.ZipFile(folder/(slug+'.zip'),'w',zipfile.ZIP_DEFLATED) as z:
   for name,content in files.items(): z.writestr(slug+'/'+name,content)
  download='/catalog/'+slug+'/'+slug+'.zip'
 im=Image.new('RGB',(1000,650),'#f4f7fb');d=ImageDraw.Draw(im)
 d.rectangle((0,0,1000,72),fill='#101f65');d.text((36,22),'CIEM / PRODUCTOS DIGITALES',font=small,fill='white')
 d.rounded_rectangle((36,110,964,460),radius=14,fill='white',outline='#d8e1ee',width=2)
 d.rounded_rectangle((66,140,934,196),radius=8,fill='#101f65')
 for n in range(3):
  x=66+n*290;d.rounded_rectangle((x,220,x+264,420),radius=9,fill='#edf4fa');d.rectangle((x+20,244,x+100,252),fill='#06d69a');d.rectangle((x+20,276,x+220,286),fill='#c8d6e5');d.rectangle((x+20,302,x+180,312),fill='#c8d6e5')
 for n,line in enumerate(textwrap.wrap(title.split(' — ')[0],width=43)):d.text((36,485+n*44),line,font=font,fill='#101f65')
 d.text((36,605),'VISTA ILUSTRATIVA · '+('POR ENCARGO' if kind=='quote' else 'BASE EDITABLE'),font=small,fill='#52627a')
 im.save(folder/'cover.png')
 catalog.append(dict(slug=slug,title=title,category=cat,kind=kind,summary=desc,download=download,preview='/catalog/'+slug+'/index.html' if kind=='download' else ('/demos/'+slug+'/' if slug in {'crm-comercial','gestion-inventario','plataforma-reservas'} else None)))
commercial_file=ROOT/'catalog-tools/commercial_products.json'
if commercial_file.exists(): catalog.extend(json.loads(commercial_file.read_text()))
additional_file=ROOT/'catalog-tools/additional_products.json'
if additional_file.exists(): catalog.extend(json.loads(additional_file.read_text()))
(ROOT/'catalog-tools/catalog.json').write_text(json.dumps({'categories':CATEGORIES,'items':catalog},ensure_ascii=False,indent=2))
print('Preparados',len(catalog),'productos;',sum(bool(x['download']) for x in catalog),'ZIP originales.')
