export const CREATORS=[
 {id:'luna',name:'Luna Rivera',handle:'luna.crea',category:'Diseño',initials:'LR',color:'pink',tagline:'Ideas que empiezan en un cuaderno.',bio:'Ilustración, procesos creativos y pequeñas ideas para encontrar tu propio lenguaje visual.',followers:1240,art:'design'},
 {id:'mateo',name:'Mateo Sol',handle:'mateo.sonido',category:'Música',initials:'MS',color:'orange',tagline:'El sonido de hacer algo propio.',bio:'Explora sesiones, bocetos sonoros y el proceso que hay detrás de cada composición.',followers:860,art:'music'},
 {id:'alma',name:'Alma Torres',handle:'alma.enfoco',category:'Fotografía',initials:'AT',color:'green',tagline:'Otra manera de mirar lo cotidiano.',bio:'Historias visuales, recorridos y notas para observar la luz desde una perspectiva distinta.',followers:1920,art:'photo'},
 {id:'nico',name:'Nico Vega',handle:'nico.construye',category:'Tecnología',initials:'NV',color:'blue',tagline:'Aprender también es construir.',bio:'Prototipos, diseño de interfaces y experiencias para crear productos digitales con intención.',followers:1540,art:'tech'},
];
export const PLANS=[{id:'community',name:'Comunidad',level:1,price:19,benefits:['Publicaciones para miembros','Procesos y notas de creación','Acceso al archivo de la comunidad']},{id:'circle',name:'Círculo creativo',level:2,price:39,benefits:['Todo lo del plan Comunidad','Contenido del Círculo creativo','Series y sesiones de ejemplo']}];
const seedPosts=[
 ['luna','El comienzo de una nueva colección','A veces una colección empieza con una sola forma. Esta semana exploré colores, ritmos y composiciones a partir de elementos cotidianos. ¿Qué detalle te inspira hoy?','public','design'],
 ['luna','Dentro del cuaderno: del boceto a la pieza','En esta publicación de ejemplo, el creador comparte un recorrido de trabajo: referencias, tres variaciones de composición y una selección final. Este texto simula contenido disponible para miembros.','community','sketch'],
 ['mateo','Una idea, cuatro capas de sonido','Un ritmo sencillo puede abrir un mundo de posibilidades. Este es un ejemplo editorial de una publicación musical; la demo no incluye un archivo de audio ni un reproductor real.','public','music'],
 ['mateo','La sesión del Círculo: cómo nace una melodía','Contenido de ejemplo para el nivel Círculo creativo. Aquí podría presentarse una sesión grabada, notas o recursos en una plataforma completa. La demo simula el acceso y muestra este texto.','circle','music'],
 ['alma','La luz cambia la historia','Un paseo, una esquina y una sombra inesperada. Este texto de ejemplo invita a mirar el entorno con curiosidad. La composición visual es una ilustración original de la demo.','public','photo'],
 ['alma','Cuaderno de campo: una mañana en la ciudad','Una publicación de ejemplo para miembros: planificación de un recorrido, observación de la luz y selección de una serie. Los recursos descargables y archivos reales se definirían en el proyecto.','community','photo'],
 ['nico','De una idea a un primer prototipo','Empieza por el problema, dibuja el recorrido y prueba una hipótesis pequeña. Esta publicación muestra cómo podría compartir contenido un creador de productos digitales.','public','tech'],
 ['nico','Un sistema visual desde cero','Contenido de ejemplo para el Círculo creativo: decisiones de estructura, componentes y patrones. No es un curso completo ni incluye código descargable; representa un contenido exclusivo dentro de esta demo.','circle','tech'],
];
export function initialState(){return {version:1,following:[],likes:[],saved:[],memberships:{},posts:seedPosts.map((p,i)=>({id:'post-'+(i+1),creator:p[0],title:p[1],body:p[2],audience:p[3],art:p[4],status:'published',date:'Contenido de ejemplo'}))};}
export function levelFor(state,creator){const m=state.memberships[creator];return m?.status==='active'?(PLANS.find(p=>p.id===m.plan)?.level||0):0;}
export function canAccess(state,post){return post.audience==='public'||levelFor(state,post.creator)>=(post.audience==='circle'?2:1);}
export function changeMembership(state,creator,plan){
 if(!CREATORS.some(c=>c.id===creator)||!PLANS.some(p=>p.id===plan))throw new Error('Creador o plan inválido.');
 return {...state,memberships:{...state.memberships,[creator]:{plan,status:'active'}}};
}
export function cancelMembership(state,creator){if(!state.memberships[creator]||state.memberships[creator].status!=='active')throw new Error('No hay una membresía activa.');return {...state,memberships:{...state.memberships,[creator]:{...state.memberships[creator],status:'cancelled'}}};}
export function toggle(state,field,id){
 if(!['following','likes','saved'].includes(field))throw new Error('Acción inválida.');
 if(field==='following'?!CREATORS.some(c=>c.id===id):!state.posts.some(p=>p.id===id&&p.status==='published'))throw new Error('No se encontró el contenido.');
 if(field==='likes'&&!canAccess(state,state.posts.find(p=>p.id===id)))throw new Error('Activa una membresía de ejemplo para reaccionar a este contenido.');
 return {...state,[field]:state[field].includes(id)?state[field].filter(x=>x!==id):[...state[field],id]};
}
export function addPost(state,input,id){
 if(state.posts.length>=100)throw new Error('La demo admite 100 publicaciones. Restablece los datos para continuar.');
 if(!CREATORS.some(c=>c.id===input.creator)||!['public','community','circle'].includes(input.audience)||!['draft','published'].includes(input.status))throw new Error('Selecciona un creador, una audiencia y un estado válidos.');
 const title=String(input.title||'').trim(),body=String(input.body||'').trim();
 if(title.length<3||title.length>100)throw new Error('El título debe tener entre 3 y 100 caracteres.');
 if(body.length<10||body.length>2000)throw new Error('El contenido debe tener entre 10 y 2000 caracteres.');
 if(!id||state.posts.some(p=>p.id===id))throw new Error('Referencia de publicación inválida.');
 const creator=CREATORS.find(c=>c.id===input.creator);
 return {...state,posts:[{id,creator:creator.id,title,body,audience:input.audience,status:input.status,art:creator.art,date:'Creado en esta demo'},...state.posts]};
}
export function changePostStatus(state,id,status){
 if(!['draft','published','archived'].includes(status)||!state.posts.some(p=>p.id===id))throw new Error('Publicación o estado inválido.');
 return {...state,posts:state.posts.map(p=>p.id===id?{...p,status}:p)};
}
export function restoreState(value){
 if(!value||value.version!==1||!Array.isArray(value.posts)||value.posts.length>100)throw new Error('Datos inválidos.');
 const creators=CREATORS.map(c=>c.id),ids=new Set();
 const posts=value.posts.map(p=>{
  if(!p||typeof p.id!=='string'||p.id.length>70||ids.has(p.id)||!creators.includes(p.creator)||typeof p.title!=='string'||p.title.length<3||p.title.length>100||typeof p.body!=='string'||p.body.length<10||p.body.length>2000||!['draft','published','archived'].includes(p.status)||!['public','community','circle'].includes(p.audience)||!['design','sketch','music','photo','tech'].includes(p.art)||typeof p.date!=='string'||p.date.length>60)throw new Error('Publicación inválida.');
  ids.add(p.id);return {id:p.id,creator:p.creator,title:p.title,body:p.body,audience:p.audience,status:p.status,art:p.art,date:p.date};
 });
 const result={version:1,posts,memberships:{},following:[],likes:[],saved:[]};
 for(const field of ['following','likes','saved']){const list=value[field];if(!Array.isArray(list)||list.length>100||list.some(id=>typeof id!=='string'||!(field==='following'?creators.includes(id):ids.has(id))))throw new Error('Selección inválida.');result[field]=[...new Set(list)];}
 if(!value.memberships||typeof value.memberships!=='object'||Array.isArray(value.memberships))throw new Error('Membresías inválidas.');
 for(const [creator,m]of Object.entries(value.memberships)){if(!creators.includes(creator)||!m||!PLANS.some(p=>p.id===m.plan)||!['active','cancelled'].includes(m.status))throw new Error('Membresía inválida.');result.memberships[creator]={plan:m.plan,status:m.status};}
 return result;
}
