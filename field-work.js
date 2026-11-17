'use strict';

const editorDraftKey=(role,id)=>'editor-draft:'+role+':'+encodeURIComponent(me()||'device')+':'+(id||'new');
async function saveEditorDraft(snapshot){await docPut({...snapshot,kind:'task_editor_draft',updatedAt:Date.now()});}
function applyTaskLocation(task,coords,replace=false) {
  if(!Number.isFinite(coords.latitude)||!Number.isFinite(coords.longitude))throw new Error('Телефон не вернул координаты.');
  const location={latitude:coords.latitude,longitude:coords.longitude,accuracy:Number.isFinite(coords.accuracy)?coords.accuracy:null,at:Date.now()};
  task.location=location;
  for(const item of task.items){item.values ||= {};const v=item.values;if(!replace&&v.locationOverride&&v.latitude&&v.longitude)continue;v.latitude=String(coords.latitude);v.longitude=String(coords.longitude);if(replace)delete v.locationOverride;if(task.siteId&&!v.kust_id)v.kust_id=task.siteId;}
  return task;
}
async function bindTaskPosition(id) {
  const coords=await getPos(),task=await dbGet(id);if(!task)throw new Error('Заявка не найдена');
  const conflicts=task.items.filter(item=>item.values?.latitude&&item.values?.longitude&&(Math.abs(+item.values.latitude-coords.latitude)>.0001||Math.abs(+item.values.longitude-coords.longitude)>.0001));
  const replace=!conflicts.length||confirm('В протоколах уже есть другая точка. Заменить её общим местоположением заявки? При отмене индивидуальные точки сохранятся.');
  if(!replace)for(const item of conflicts)item.values.locationOverride='1';
  applyTaskLocation(task,coords,replace);
  if(task.siteId){const sites=kusty(),site=sites.find(s=>s.id===task.siteId);if(site){site.lat=coords.latitude;site.lon=coords.longitude;saveKusty(sites);}}
  await dbPut(task);lsSet('weatherLocation',JSON.stringify({latitude:coords.latitude,longitude:coords.longitude,place:task.object||'Место заявки',city:''}));
  return task;
}
async function createSite() {
  const name=(await askText('Новый куст или подстанция','Название сохранится в справочнике.','','Например, куст 210 или ПС-35 №163')||'').trim();if(!name)return null;
  const sites=kusty(),existing=sites.find(s=>s.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase());if(existing)return existing;
  const site={id:'site-'+crypto.randomUUID(),name,field:'',lat:null,lon:null,note:'',tests:{},log:[]};sites.push(site);saveKusty(sites);return site;
}
function taskSiteOptions(selected='') {return '<option value="">— выбери куст / подстанцию —</option>'+kusty().map(site=>`<option value="${esc(site.id)}" ${site.id===selected?'selected':''}>${esc(site.name)}${site.field?' · '+esc(site.field):''}</option>`).join('');}

// The OPN form keeps its old keys so previous reports remain readable.
const opnAssetSection={title:'Место установки ОПН',fields:[ASSET_SECTION.fields.find(f=>f.id==='kust_id')]};
ARRESTER.form=ARRESTER.form.map(section=>section===ASSET_SECTION?opnAssetSection:section);
const opnEquipment=ARRESTER.form.find(section=>section.title==='Оборудование и условия');
opnEquipment.fields=opnEquipment.fields.filter(field=>!(field.type==='row'&&field.fields?.some(f=>/^ar_no_/.test(f.id))));
opnEquipment.fields.push({type:'row',label:'Заводские номера ОПН / разрядников',fields:['a','b','c'].map(p=>({id:'ar_no_'+p,label:'Фаза '+p.toUpperCase(),type:'text'}))});
for(const section of ARRESTER.form)for(const field of section.fields||[])if(field.type==='row')for(const child of field.fields||[])if(/^(ar_r|opn_i|rz_i)_[abc]$/.test(child.id))child.label='Фаза '+child.id.at(-1).toUpperCase();
const legacyOpnAsset={title:'Ранее сохранённые реквизиты',show:v=>!!(v.asset_name||v.asset_tag),fields:ASSET_SECTION.fields.filter(f=>f.id!=='kust_id')};
ARRESTER.form.splice(ARRESTER.form.length-1,0,legacyOpnAsset);

const enhanceBeforeFieldWork=enhancePage;
enhancePage=async function(role,parts) {
  await enhanceBeforeFieldWork(role,parts);
  if(['e','b'].includes(role)&&parts.length===1){
    const drafts=(await docsAll()).filter(d=>d.kind==='task_editor_draft'&&d.role===role&&d.owner===(me()||'')).sort((a,b)=>b.updatedAt-a.updatedAt);
    if(drafts.length){const panel=document.createElement('section');panel.className='card draft-reminders';panel.innerHTML=`<h3>Незавершённые заявки</h3>${drafts.map(d=>`<a class="reminder-link" href="#/${role}/${d.taskId?'edit/'+d.taskId:'new'}"><b>${esc(d.form?.object||'Новая заявка')}</b><small>Продолжить заполнение · ${fmtDT(d.updatedAt)}</small></a>`).join('')}`;app.prepend(panel);}
  }
  if(parts[1]==='task'){
    const task=await dbGet(parts[2]);if(!task)return;
    const summary=app.querySelector('.task-summary');if(!summary)return;
    const panel=document.createElement('section');panel.className='task-location no-print';
    const canEdit=isManager(role)||canManageWorkerTask(task,me());
    panel.innerHTML=`<p class="meta">Общая точка заявки: ${task.location?`${esc(task.location.latitude.toFixed(5))}, ${esc(task.location.longitude.toFixed(5))}${task.location.accuracy!==null?' · точность около '+Math.round(task.location.accuracy)+' м':''}`:'ещё не привязана'}</p>${canEdit?`<label class="field"><span class="lbl">Куст / подстанция для всех испытаний</span><select data-task-site>${taskSiteOptions(task.siteId)}</select></label><div class="actions"><button type="button" class="btn ghost small" data-site-add>Новый куст / подстанция</button><button type="button" class="btn accent small" data-task-position>Где я нахожусь?</button></div><p class="hint" data-position-status>Координаты заявки наследуют все испытания комплекса.</p>`:''}`;
    const actions=summary.querySelector('.actions');if(actions)actions.before(panel);else summary.append(panel);
    if(!canEdit)return;
    const select=panel.querySelector('[data-task-site]');
    const setSite=async id=>{const current=await dbGet(task.id);current.siteId=id;for(const item of current.items)item.values.kust_id=id;await dbPut(current);await router();};
    select.onchange=()=>setSite(select.value);
    panel.querySelector('[data-site-add]').onclick=async()=>{const site=await createSite();if(site)await setSite(site.id);};
    panel.querySelector('[data-task-position]').onclick=async event=>{
      const button=event.currentTarget,status=panel.querySelector('[data-position-status]');button.disabled=true;status.textContent='Определяем место телефона, это может занять до 25 секунд…';
      try{await bindTaskPosition(task.id);await router();toast('Местоположение сохранено для заявки и её испытаний');}catch(error){status.textContent=error.message;button.disabled=false;}
    };
    app.querySelectorAll('[data-geolocate]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await bindTaskPosition(task.id);await router();toast('Общие координаты сохранены');}catch(error){toast(error.message);button.disabled=false;}});
    const siteField=app.querySelector('[data-f="kust_id"]');
    if(siteField&&!app.querySelector('[data-inline-site]')){const add=document.createElement('button');add.type='button';add.className='btn ghost small';add.dataset.inlineSite='1';add.textContent='+ Новый куст / подстанция';siteField.closest('.field')?.after(add);add.onclick=async()=>{const site=await createSite();if(site)await setSite(site.id);};}
  }
};
