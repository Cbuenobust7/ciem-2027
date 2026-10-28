import test from 'node:test';
import assert from 'node:assert/strict';
import {initialData,addRecord,changeRecord,matching,restoreRecords,futureDate} from '../frontend/public/demos/shared/model.js';
test('CRM: crear, avanzar, buscar y restaurar',()=>{
 let rows=addRecord('crm-comercial',initialData('crm-comercial'),{name:'Negocio demo',amount:'1250.50'},'x');
 rows=changeRecord('crm-comercial',rows,'x','advance');
 assert.equal(rows.at(-1).status,'En contacto');assert.equal(matching(rows,'NEGOCIO').length,1);
 assert.deepEqual(restoreRecords('crm-comercial',JSON.parse(JSON.stringify(rows))),rows);
 assert.throws(()=>addRecord('crm-comercial',rows,{name:'',amount:1},'z'));
 assert.throws(()=>addRecord('crm-comercial',rows,{name:'Demo',amount:-1},'z'));
});
test('Inventario: SKU único, cantidades enteras y salidas sin stock',()=>{
 let rows=initialData('gestion-inventario');const before=structuredClone(rows);
 assert.throws(()=>addRecord('gestion-inventario',rows,{name:'Otro',sku:'PAP-001',quantity:1,amount:2},'z'));
 assert.throws(()=>addRecord('gestion-inventario',rows,{name:'Otro',sku:'NEW',quantity:1.5,amount:2},'z'));
 assert.throws(()=>changeRecord('gestion-inventario',rows,'4','minus'));
 rows=changeRecord('gestion-inventario',rows,'4','plus');assert.equal(rows[3].quantity,1);
 assert.deepEqual(initialData('gestion-inventario'),before);
 assert.deepEqual(restoreRecords('gestion-inventario',rows),rows);
});
test('Reservas: evita conflictos y libera horarios al cancelar',()=>{
 let rows=initialData('plataforma-reservas');
 const input={name:'Demo',service:'Asesoría',date:futureDate(),time:'10:00'};
 assert.throws(()=>addRecord('plataforma-reservas',rows,input,'x'));
 rows=changeRecord('plataforma-reservas',rows,'1','cancel');
 rows=addRecord('plataforma-reservas',rows,input,'x');assert.equal(rows.at(-1).status,'Pendiente');
 rows=changeRecord('plataforma-reservas',rows,'x','advance');assert.equal(rows.at(-1).status,'Confirmada');
 assert.deepEqual(restoreRecords('plataforma-reservas',rows),rows);
});
test('Reservas: rechaza fechas inválidas, pasadas y servicios no definidos',()=>{
 const input={name:'Demo',service:'Asesoría',date:'2000-01-01',time:'09:00'};
 assert.throws(()=>addRecord('plataforma-reservas',[],input,'x'));
 assert.throws(()=>addRecord('plataforma-reservas',[],{...input,date:'2099-02-31'},'x'));
 assert.throws(()=>addRecord('plataforma-reservas',[],{...input,date:futureDate(),service:'No existe'},'x'));
});
test('Estados finales no avanzan y la búsqueda respeta el filtro',()=>{
 const rows=initialData('crm-comercial');assert.throws(()=>changeRecord('crm-comercial',rows,'4','advance'));
 assert.equal(matching(rows,'','Nuevo').length,1);assert.equal(matching(rows,'inexistente').length,0);
});
test('Datos de almacenamiento inválidos se rechazan',()=>{
 for(const value of [null,{},[{id:'x',name:'Demo',amount:-4,status:'Nuevo'}]])assert.throws(()=>restoreRecords('crm-comercial',value));
 const row=initialData('crm-comercial')[0];assert.throws(()=>restoreRecords('crm-comercial',[row,row]));
});
