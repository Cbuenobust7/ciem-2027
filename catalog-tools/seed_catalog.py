"""Add the explicitly requested digital catalog; never modify legacy records."""
from pathlib import Path
import json,os,sys,shutil
ROOT=Path('/home/carlos/marketplace-ciem')
sys.path.insert(0,'/home/carlos/ciem-creatorhub')
os.environ.setdefault('DJANGO_SETTINGS_MODULE','core.settings')
os.environ.setdefault('DJANGO_ENV','production')
import django;django.setup()
from django.db import transaction
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from marketplace.categories.models import Category
from marketplace.listings.models import Listing,ListingImage
manifest=json.loads((ROOT/'catalog-tools/catalog.json').read_text())
owner=get_user_model().objects.get(username='ciem-admin')
with transaction.atomic():
 cats={}
 for index,(slug,name) in enumerate(manifest['categories']):
  cats[slug],_=Category.objects.get_or_create(slug=slug,defaults=dict(name=name,parent=None,order=index+10,is_active=True,icon=''))
 created=0
 for item in manifest['items']:
  description=item['summary']+'\n\n'
  if item['kind']=='commercial':
   description=item.get('description',item['summary'])
  elif item['kind']=='quote':
   description+='Desarrollo o implementación por encargo. Esta ficha describe una solución propuesta; no es una plataforma terminada ni incluye descarga inmediata. Funcionalidades, integraciones, licencias, precio y plazo se acuerdan después de evaluar el proyecto.\n\nCuéntanos qué quieres construir, si ya tienes un sitio, qué funciones necesitas y cuál es tu plazo deseado.'
  else:
   description+='Base original de CIEM disponible para descargar con licencia MIT. Personalización, instalación, hosting y soporte se cotizan por separado.\n\n'
   description+= 'Plugin básico con shortcode; incluye instrucciones. Valida en un WordPress de pruebas antes de producción. No se han verificado todas las versiones, temas o plugins de terceros.' if item['kind']=='plugin' else 'Incluye HTML y CSS editables, textos de ejemplo e instrucciones. No incluye backend, pagos, usuarios ni datos reales. La imagen del catálogo es ilustrativa; revisa la vista previa para conocer el contenido.'
  if item.get('description'): description=item['description']
  listing,new=Listing.objects.get_or_create(seller=owner,title=item['title'],defaults=dict(description=description,price=None,currency='PEN',is_free=item['kind'] in ('download','plugin'),is_negotiable=False,category=cats[item['category']],condition='new',location='Digital · atención remota',status='active',published_at=timezone.now()))
  if not new: continue
  created+=1
  relative='catalog/'+item['slug']+'/cover.png'
  for folder in {Path(settings.MEDIA_ROOT),ROOT/'media'}:
   target=folder/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/'frontend/public'/relative,target)
  ListingImage.objects.create(listing=listing,image=relative,alt_text=('Portada comercial de ' if item['kind']=='commercial' else 'Vista ilustrativa de ')+item['title'],order=0,is_cover=True)
print('Fichas digitales nuevas:',created,'; categorías nuevas o reutilizadas:',len(cats))
print('No se modificaron anuncios ni categorías anteriores.')
