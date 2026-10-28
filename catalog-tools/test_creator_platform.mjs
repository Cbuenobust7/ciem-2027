import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,canAccess,changeMembership,cancelMembership,toggle,addPost,changePostStatus,restoreState} from '../frontend/public/creator-platform-starter-kit/model.js';
test('Acceso: público, Comunidad y Círculo son niveles distintos',()=>{
 let state=initialState();const publicPost=state.posts[0],memberPost=state.posts[1],circlePost=state.posts[3];
 assert.equal(canAccess(state,publicPost),true);assert.equal(canAccess(state,memberPost),false);assert.equal(canAccess(state,circlePost),false);
 state=changeMembership(state,'luna','community');assert.equal(canAccess(state,memberPost),true);
 state=changeMembership(state,'mateo','community');assert.equal(canAccess(state,circlePost),false);
 state=changeMembership(state,'mateo','circle');assert.equal(canAccess(state,circlePost),true);
 state=changeMembership(state,'mateo','community');assert.equal(canAccess(state,circlePost),false);
});
test('Cancelar revoca el acceso simulado; se puede reactivar',()=>{
 let state=changeMembership(initialState(),'luna','community');const previous=state;
 state=cancelMembership(state,'luna');assert.equal(canAccess(state,state.posts[1]),false);assert.equal(previous.memberships.luna.status,'active');
 assert.throws(()=>cancelMembership(state,'luna'));state=changeMembership(state,'luna','circle');assert.equal(canAccess(state,state.posts[1]),true);
 assert.throws(()=>changeMembership(state,'no-existe','circle'));assert.throws(()=>changeMembership(state,'luna','gratis'));
});
test('Seguimiento, guardados y reacciones son reversibles y validados',()=>{
 let state=initialState();state=toggle(state,'following','luna');assert.deepEqual(state.following,['luna']);state=toggle(state,'following','luna');assert.deepEqual(state.following,[]);
 assert.throws(()=>toggle(state,'likes','post-2'));state=toggle(state,'saved','post-2');assert.deepEqual(state.saved,['post-2']);
 state=toggle(state,'likes','post-1');assert.deepEqual(state.likes,['post-1']);assert.throws(()=>toggle(state,'following','otro'));assert.throws(()=>toggle(state,'saved','otro'));
});
test('Creator Studio: borrador, publicación y archivo sin mutar el estado anterior',()=>{
 const before=initialState();let state=addPost(before,{creator:'luna',title:'Mi publicación',body:'Un contenido de ejemplo que se puede probar.',audience:'community',status:'draft'},'post-test');
 assert.equal(before.posts.length,8);assert.equal(state.posts[0].status,'draft');
 state=changePostStatus(state,'post-test','published');assert.equal(state.posts[0].status,'published');
 state=changePostStatus(state,'post-test','archived');assert.equal(state.posts[0].status,'archived');
 assert.throws(()=>changePostStatus(state,'no-existe','published'));assert.throws(()=>changePostStatus(state,'post-test','otro'));
});
test('Publicación: valida creador, límites, audiencia y duplicados',()=>{
 const state=initialState(),input={creator:'luna',title:'Mi publicación',body:'Contenido de ejemplo válido.',audience:'public',status:'draft'};
 for(const bad of [{creator:'otro'},{title:'a'},{body:'corto'},{body:'a'.repeat(2001)},{audience:'secreto'},{status:'otro'}])assert.throws(()=>addPost(state,{...input,...bad},'new'));
 assert.throws(()=>addPost(state,input,'post-1'));assert.throws(()=>addPost({...state,posts:Array(100).fill(state.posts[0])},input,'new'));
});
test('Persistencia: conserva solo estructura válida y rechaza estados corruptos',()=>{
 let state=initialState();state=toggle(state,'following','alma');state=changeMembership(state,'alma','circle');
 assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))),state);
 for(const bad of [null,{}, {...state,version:2},{...state,likes:['otro']},{...state,memberships:{otro:{plan:'circle',status:'active'}}},{...state,posts:[state.posts[0],state.posts[0]]}])assert.throws(()=>restoreState(bad));
});
