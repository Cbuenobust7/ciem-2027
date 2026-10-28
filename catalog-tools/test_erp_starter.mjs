import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoney,addContact,addProduct,adjustStock,addQuote,quoteToOrder,orderToSale,addPurchase,receivePurchase,addPayment,balanceFor,accounts,initialState,restoreState,csvDocument} from '../frontend/public/erp-starter-kit/model.js';
const now=new Date('2026-11-20T17:00:00Z'),date='2026-11-20';
function freshQuote(state,lines=[{productId:'PRD-1001',quantity:2}]){return addQuote(state,{clientId:'CLI-1001',lines},date);}
test('Cotización → pedido → venta: conserva totales y descuenta stock una sola vez',()=>{
 let state=initialState(now),original=structuredClone(state),stock=state.products[0].stock;
 state=freshQuote(state);const quote=state.quotes[0];assert.equal(quote.total,4400);assert.equal(state.products[0].stock,stock);
 state=quoteToOrder(state,quote.id);const order=state.orders[0];assert.equal(state.products[0].stock,stock);assert.throws(()=>quoteToOrder(state,quote.id));
 state=orderToSale(state,order.id,date);assert.equal(state.products[0].stock,stock-2);assert.equal(balanceFor(state,'sale',state.sales[0].id),4400);assert.throws(()=>orderToSale(state,order.id,date));
 assert.deepEqual(original.products,initialState(now).products);
});
test('Las líneas repetidas se agrupan y la venta falla atómicamente si falta stock',()=>{
 let state=initialState(now);state=freshQuote(state,[{productId:'PRD-1001',quantity:2},{productId:'PRD-1001',quantity:3}]);assert.equal(state.quotes[0].lines.length,1);assert.equal(state.quotes[0].lines[0].quantity,5);
 state=freshQuote(state,[{productId:'PRD-1001',quantity:1},{productId:'PRD-1004',quantity:1}]);state=quoteToOrder(state,state.quotes[0].id);const before=structuredClone(state);assert.throws(()=>orderToSale(state,state.orders[0].id,date));assert.deepEqual(state,before);
});
test('Los servicios se venden sin consumir stock ni crear movimientos',()=>{
 let state=initialState(now),moves=state.movements.length;state=freshQuote(state,[{productId:'PRD-1005',quantity:2}]);state=quoteToOrder(state,state.quotes[0].id);state=orderToSale(state,state.orders[0].id,date);assert.equal(state.movements.length,moves);assert.equal(state.sales[0].total,24000);
});
test('Compras: el stock y la cuenta por pagar aparecen al recibir, sin duplicados',()=>{
 let state=initialState(now),stock=state.products[0].stock,count=accounts(state,'purchase').length;
 state=addPurchase(state,{supplierId:'PRO-1001',lines:[{productId:'PRD-1001',quantity:5}]},date);const id=state.purchases[0].id;assert.equal(state.products[0].stock,stock);assert.equal(accounts(state,'purchase').length,count);assert.throws(()=>addPayment(state,'purchase',id,'1.00',date));
 state=receivePurchase(state,id,date);assert.equal(state.products[0].stock,stock+5);assert.equal(balanceFor(state,'purchase',id),6000);assert.equal(accounts(state,'purchase').length,count+1);assert.throws(()=>receivePurchase(state,id,date));
 assert.throws(()=>addPurchase(state,{supplierId:'PRO-1001',lines:[{productId:'PRD-1005',quantity:1}]},date));
});
test('Abonos parciales exactos: impide sobrepagos, importes inválidos y negativos',()=>{
 let state=initialState(now);state=freshQuote(state);state=quoteToOrder(state,state.quotes[0].id);state=orderToSale(state,state.orders[0].id,date);const id=state.sales[0].id;
 state=addPayment(state,'sale',id,'10.00',date);assert.equal(balanceFor(state,'sale',id),3400);assert.throws(()=>addPayment(state,'sale',id,'34.01',date));
 for(const amount of ['0','-1','1.234','abc','Infinity'])assert.throws(()=>addPayment(state,'sale',id,amount,date));
 state=addPayment(state,'sale',id,'34.00',date);assert.equal(balanceFor(state,'sale',id),0);assert.throws(()=>addPayment(state,'sale',id,'0.01',date));
 assert.equal(parseMoney('0.10')+parseMoney('0.20'),30);assert.equal(parseMoney('12,50'),1250);
});
test('Inventario: SKU único, ajustes con motivo y ningún stock negativo',()=>{
 let state=initialState(now);assert.throws(()=>addProduct(state,{name:'Otro',sku:'pap-001',type:'product',stock:0,cost:1,price:2},date));
 state=addProduct(state,{name:'Producto de prueba',sku:'NEW-001',type:'product',stock:3,cost:'0.10',price:'0.20'},date);const p=state.products.at(-1);assert.equal(p.stock,3);
 state=adjustStock(state,p.id,-2,'Salida de ejemplo',date);assert.equal(state.products.at(-1).stock,1);assert.throws(()=>adjustStock(state,p.id,-2,'Salida',date));assert.throws(()=>adjustStock(state,p.id,0,'Sin cambio',date));assert.throws(()=>adjustStock(state,p.id,1,'',date));
});
test('Contactos y documentos: valida referencias, fechas y cantidades',()=>{
 let state=initialState(now);state=addContact(state,'clients',{name:'Cliente de ejemplo',email:'demo@example.com',phone:''});assert.equal(state.clients.length,4);assert.throws(()=>addContact(state,'clients',{name:'',email:''}));
 for(const lines of [[],[{productId:'otro',quantity:1}],[{productId:'PRD-1001',quantity:1.2}],[{productId:'PRD-1001',quantity:0}]])assert.throws(()=>freshQuote(state,lines));
 assert.throws(()=>addQuote(state,{clientId:'CLI-1001',dueDate:'2026-01-01',lines:[{productId:'PRD-1001',quantity:1}]},date));
});
test('Persistencia rechaza stock negativo, documentos corruptos y saldos sobrepagados',()=>{
 const state=initialState(now);assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))),state);
 let bad=structuredClone(state);bad.products[0].stock=-1;assert.throws(()=>restoreState(bad));bad=structuredClone(state);bad.quotes[0].total++;assert.throws(()=>restoreState(bad));bad=structuredClone(state);bad.payments[0].amount=1000000;assert.throws(()=>restoreState(bad));
});
test('CSV escapa comillas y neutraliza celdas interpretables como fórmulas',()=>{
 const csv=csvDocument([['Nombre','Importe'],['=SUM(A1:A2)',22],['Negocio "A"','@demo']]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("'=SUM"));assert.ok(csv.includes('Negocio ""A""'));assert.ok(csv.includes("'@demo"));
});
