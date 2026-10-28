export const MAX_CENTS=100000000;
export function today(now=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
export function addDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function validDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return false;const d=new Date(date+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date;}
export function parseMoney(value){const text=String(value).trim().replace(',','.');if(!/^\d{1,7}(\.\d{1,2})?$/.test(text))throw new Error('Escribe un importe válido, con hasta dos decimales.');const [whole,decimal='']=text.split('.'),cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));if(cents>MAX_CENTS)throw new Error('El importe supera el límite de esta demo.');return cents;}
function integer(value,min=1,max=100000){const n=Number(value);if(String(value).trim()===''||!Number.isInteger(n)||n<min||n>max)throw new Error('Ingresa una cantidad entera válida.');return n;}
function text(value,label,max=100){const s=String(value||'').trim();if(!s||s.length>max)throw new Error(label+' debe tener entre 1 y '+max+' caracteres.');return s;}
function code(prefix,list){let n=1001+list.length;while(list.some(x=>x.id===prefix+'-'+n))n++;return prefix+'-'+n;}
function limit(list,max=200){if(list.length>=max)throw new Error('Se alcanzó el límite de registros de la demo. Puedes restablecer los ejemplos.');}
function get(list,id,label){const x=list.find(r=>r.id===id);if(!x)throw new Error('No se encontró '+label+'.');return x;}
function validDue(date,due){if(!validDate(date)||!validDate(due)||due<date)throw new Error('La fecha de vencimiento debe ser válida y no anterior al documento.');}
function total(lines){const n=lines.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0);if(!Number.isSafeInteger(n)||n>MAX_CENTS)throw new Error('El total supera el límite de la demo.');return n;}
function normalizedLines(state,input,purchase=false){if(!Array.isArray(input)||!input.length||input.length>20)throw new Error('Añade entre 1 y 20 líneas de productos.');const grouped=new Map();for(const line of input){const p=get(state.products,line.productId,'el producto');if(purchase&&!p.trackStock)throw new Error('Las compras de esta demo son de productos con stock.');const quantity=integer(line.quantity);grouped.set(p.id,(grouped.get(p.id)||0)+quantity);}return [...grouped].map(([id,quantity])=>({productId:id,quantity:integer(quantity),unitPrice:get(state.products,id,'el producto')[purchase?'cost':'price']}));}
function stockMovement(state,productId,delta,reference,reason,date){
 limit(state.movements,500);const product=get(state.products,productId,'el producto');if(!product.trackStock)throw new Error('Este servicio no gestiona stock.');
 const balance=product.stock+delta;if(!Number.isInteger(delta)||delta===0||balance<0||balance>100000)throw new Error('Stock insuficiente o movimiento fuera de los límites de la demo: '+product.name+'.');
 product.stock=balance;state.movements.unshift({id:code('MOV',state.movements),productId,delta,balance,reference,reason,date});
}
export function addContact(state,kind,input){if(!['clients','suppliers'].includes(kind))throw new Error('Tipo de contacto inválido.');limit(state[kind],100);const name=text(input.name,'El nombre',90),email=String(input.email||'').trim(),phone=String(input.phone||'').trim();if(email&&(email.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new Error('Usa un correo de ejemplo válido.');if(phone.length>30)throw new Error('El teléfono admite hasta 30 caracteres.');const next=structuredClone(state);next[kind].push({id:code(kind==='clients'?'CLI':'PRO',state[kind]),name,email,phone});return next;}
export function addProduct(state,input,date=today()){
 limit(state.products,100);const name=text(input.name,'El nombre',90),sku=text(input.sku,'El SKU',24).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(sku))throw new Error('El SKU admite letras, números, guiones y guiones bajos.');if(state.products.some(p=>p.sku===sku))throw new Error('Ese SKU ya está registrado.');
 if(!['product','service'].includes(input.type))throw new Error('Selecciona un tipo válido.');
 const trackStock=input.type==='product',stock=trackStock?integer(input.stock,0):0,cost=parseMoney(input.cost),price=parseMoney(input.price),id=code('PRD',state.products),next=structuredClone(state);
 next.products.push({id,name,sku,stock:0,cost,price,trackStock});if(stock)stockMovement(next,id,stock,id,'Stock inicial de ejemplo',date);return next;
}
export function adjustStock(state,id,delta,reason,date=today()){const amount=Number(delta);if(!Number.isInteger(amount)||amount===0||Math.abs(amount)>100000)throw new Error('Ingresa una cantidad entera distinta de cero.');if(!validDate(date))throw new Error('Fecha inválida.');const next=structuredClone(state);stockMovement(next,id,amount,'AJUSTE',text(reason,'El motivo',120),date);return next;}
export function addQuote(state,input,date=today()){
 limit(state.quotes);get(state.clients,input.clientId,'el cliente');const dueDate=input.dueDate||addDays(date,15);validDue(date,dueDate);const lines=normalizedLines(state,input.lines),next=structuredClone(state);next.quotes.unshift({id:code('COT',state.quotes),clientId:input.clientId,date,dueDate,lines,total:total(lines),status:'Cotizada'});return next;
}
export function quoteToOrder(state,id){const quote=get(state.quotes,id,'la cotización');if(quote.status!=='Cotizada'||state.orders.some(o=>o.quoteId===id))throw new Error('Esta cotización ya se convirtió en pedido.');limit(state.orders);const next=structuredClone(state);next.quotes.find(q=>q.id===id).status='Convertida';next.orders.unshift({id:code('PED',state.orders),quoteId:id,clientId:quote.clientId,date:quote.date,dueDate:quote.dueDate,lines:structuredClone(quote.lines),total:quote.total,status:'Pendiente'});return next;}
export function orderToSale(state,id,date=today()){
 const order=get(state.orders,id,'el pedido');if(order.status!=='Pendiente'||state.sales.some(s=>s.orderId===id))throw new Error('El pedido ya tiene una venta registrada.');if(!validDate(date))throw new Error('Fecha inválida.');limit(state.sales);
 const next=structuredClone(state),saleId=code('VEN',state.sales);for(const line of order.lines){const p=get(next.products,line.productId,'el producto');if(p.trackStock)stockMovement(next,p.id,-line.quantity,saleId,'Salida por venta de ejemplo',date);}
 next.orders.find(o=>o.id===id).status='Vendido';next.sales.unshift({id:saleId,orderId:id,clientId:order.clientId,date,dueDate:order.dueDate<date?date:order.dueDate,lines:structuredClone(order.lines),total:order.total});return next;
}
export function addPurchase(state,input,date=today()){
 limit(state.purchases);get(state.suppliers,input.supplierId,'el proveedor');const dueDate=input.dueDate||addDays(date,15);validDue(date,dueDate);const lines=normalizedLines(state,input.lines,true),next=structuredClone(state);next.purchases.unshift({id:code('COM',state.purchases),supplierId:input.supplierId,date,dueDate,lines,total:total(lines),status:'Pendiente'});return next;
}
export function receivePurchase(state,id,date=today()){
 const purchase=get(state.purchases,id,'la compra');if(purchase.status!=='Pendiente')throw new Error('Esta compra ya fue recibida.');if(!validDate(date))throw new Error('Fecha inválida.');const next=structuredClone(state);for(const line of purchase.lines)stockMovement(next,line.productId,line.quantity,id,'Entrada por compra de ejemplo',date);next.purchases.find(p=>p.id===id).status='Recibida';return next;
}
export function paidAmount(state,type,id){return state.payments.filter(p=>p.type===type&&p.documentId===id).reduce((sum,p)=>sum+p.amount,0);}
export function balanceFor(state,type,id){const doc=get(type==='sale'?state.sales:state.purchases,id,'el documento');return doc.total-paidAmount(state,type,id);}
export function addPayment(state,type,id,amount,date=today()){
 if(!['sale','purchase'].includes(type))throw new Error('Tipo de cuenta inválido.');const doc=get(type==='sale'?state.sales:state.purchases,id,'el documento');if(type==='purchase'&&doc.status!=='Recibida')throw new Error('Primero registra la recepción de la compra.');if(!validDate(date))throw new Error('Fecha inválida.');const cents=parseMoney(amount);if(cents<=0||cents>balanceFor(state,type,id))throw new Error('El abono debe ser mayor que cero y no superar el saldo pendiente.');limit(state.payments,300);const next=structuredClone(state);next.payments.unshift({id:code('ABO',state.payments),type,documentId:id,amount:cents,date});return next;
}
export function accounts(state,type){return (type==='sale'?state.sales:state.purchases.filter(p=>p.status==='Recibida')).map(doc=>({...doc,paid:paidAmount(state,type,doc.id),balance:balanceFor(state,type,doc.id)}));}
export function initialState(now=new Date()){
 const date=today(now);let state={version:1,products:[
 {id:'PRD-1001',name:'Cuaderno A5',sku:'PAP-001',stock:24,cost:1200,price:2200,trackStock:true},
 {id:'PRD-1002',name:'Botella térmica',sku:'ACC-002',stock:8,cost:3800,price:6500,trackStock:true},
 {id:'PRD-1003',name:'Cable USB-C',sku:'TEC-003',stock:3,cost:1400,price:2500,trackStock:true},
 {id:'PRD-1004',name:'Organizador de escritorio',sku:'ACC-004',stock:0,cost:3000,price:5500,trackStock:true},
 {id:'PRD-1005',name:'Servicio de instalación',sku:'SER-001',stock:0,cost:0,price:12000,trackStock:false}],
 clients:[{id:'CLI-1001',name:'Estudio Aurora · ejemplo',email:'aurora@example.com',phone:'000 000 001'},{id:'CLI-1002',name:'Café del Parque · ejemplo',email:'cafe@example.com',phone:'000 000 002'},{id:'CLI-1003',name:'Taller Norte · ejemplo',email:'taller@example.com',phone:'000 000 003'}],
 suppliers:[{id:'PRO-1001',name:'Distribuidora Central · ejemplo',email:'central@example.com',phone:'000 000 010'},{id:'PRO-1002',name:'Suministros del Sur · ejemplo',email:'sur@example.com',phone:'000 000 011'}],quotes:[],orders:[],sales:[],purchases:[],payments:[],movements:[]};
 state=addQuote(state,{clientId:'CLI-1001',dueDate:addDays(date,-3),lines:[{productId:'PRD-1001',quantity:3},{productId:'PRD-1005',quantity:1}]},addDays(date,-18));state=quoteToOrder(state,state.quotes[0].id);state=orderToSale(state,state.orders[0].id,addDays(date,-18));state=addPayment(state,'sale',state.sales[0].id,'60.00',addDays(date,-17));
 state=addPurchase(state,{supplierId:'PRO-1001',dueDate:addDays(date,10),lines:[{productId:'PRD-1001',quantity:10}]},addDays(date,-5));state=receivePurchase(state,state.purchases[0].id,addDays(date,-5));state=addPayment(state,'purchase',state.purchases[0].id,'50.00',addDays(date,-4));
 state=addQuote(state,{clientId:'CLI-1002',lines:[{productId:'PRD-1002',quantity:2}]},date);return state;
}
export function restoreState(value){
 const lists=['products','clients','suppliers','quotes','orders','sales','purchases','payments','movements'];if(!value||value.version!==1||lists.some(k=>!Array.isArray(value[k])||value[k].length>(k==='movements'?500:k==='payments'?300:k==='products'||k==='clients'||k==='suppliers'?100:200)))throw new Error('Datos de demo inválidos.');
 const state=structuredClone(value),ids={};for(const key of lists){ids[key]=new Set();for(const r of state[key]){if(!r||typeof r.id!=='string'||r.id.length>40||ids[key].has(r.id))throw new Error('Referencia inválida.');ids[key].add(r.id);}}
 const cents=n=>Number.isInteger(n)&&n>=0&&n<=MAX_CENTS;const validText=(s,n)=>typeof s==='string'&&s.length<=n;
 const skus=new Set();for(const p of state.products){if(!validText(p.name,90)||!p.name||!validText(p.sku,24)||!p.sku||skus.has(p.sku)||typeof p.trackStock!=='boolean'||!Number.isInteger(p.stock)||p.stock<0||p.stock>100000||!cents(p.cost)||!cents(p.price))throw new Error('Producto inválido.');skus.add(p.sku);}
 for(const key of ['clients','suppliers'])for(const c of state[key])if(!validText(c.name,90)||!c.name||!validText(c.email,120)||!validText(c.phone,30))throw new Error('Contacto inválido.');
 for(const key of ['quotes','orders','sales','purchases'])for(const doc of state[key]){
  const party=key==='purchases'?ids.suppliers.has(doc.supplierId):ids.clients.has(doc.clientId);
  if(!party||!validDate(doc.date)||!validDate(doc.dueDate)||doc.dueDate<doc.date||!Array.isArray(doc.lines)||!doc.lines.length||doc.lines.length>20||!cents(doc.total))throw new Error('Documento inválido.');
  for(const line of doc.lines)if(!ids.products.has(line.productId)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>100000||!cents(line.unitPrice))throw new Error('Línea inválida.');
  if(total(doc.lines)!==doc.total)throw new Error('Total inválido.');
  if(key==='quotes'&&!['Cotizada','Convertida'].includes(doc.status)||key==='orders'&&(!['Pendiente','Vendido'].includes(doc.status)||!ids.quotes.has(doc.quoteId))||key==='sales'&&!ids.orders.has(doc.orderId)||key==='purchases'&&!['Pendiente','Recibida'].includes(doc.status))throw new Error('Estado inválido.');
 }
 for(const p of state.payments)if(!['sale','purchase'].includes(p.type)||!(p.type==='sale'?ids.sales.has(p.documentId):state.purchases.some(d=>d.id===p.documentId&&d.status==='Recibida'))||!cents(p.amount)||p.amount===0||!validDate(p.date))throw new Error('Abono inválido.');
 for(const key of ['sale','purchase'])for(const a of accounts(state,key))if(a.balance<0)throw new Error('Saldo inválido.');
 for(const m of state.movements)if(!ids.products.has(m.productId)||!Number.isInteger(m.delta)||m.delta===0||!Number.isInteger(m.balance)||m.balance<0||m.balance>100000||!validDate(m.date)||!validText(m.reference,40)||!validText(m.reason,120))throw new Error('Movimiento inválido.');
 return Object.fromEntries(['version',...lists].map(k=>[k,state[k]]));
}
export function csvCell(value){let s=String(value??'');if(typeof value==='string'&&(/^[=+\-@]/.test(s.trimStart())||/^[\t\r\n]/.test(s)))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function csvDocument(rows){return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');}
