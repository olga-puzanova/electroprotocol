'use strict';

// v18 keeps the existing IndexedDB and all historical measurement keys.
function isTaskAssignedTo(task, name) {
  if (!name) return false;
  const members = task.crew?.members || [];
  return task.assignedElectrician === name || members.includes(name) || task.crew?.respHead === name || task.crew?.foreman === name || (!members.length && task.createdByRole === 'e' && task.createdBy === name);
}
function changeItemType(item, type) {
  if (item.type === type) return structuredClone(item);
  const variants = structuredClone(item.savedVariants || {});
  if (item.type) variants[item.type] = { values: structuredClone(item.values || {}), photos: structuredClone(item.photos || []), skip: !!item.skip, reason: item.reason || '' };
  const restored = variants[type] || { values: {}, photos: [] };
  return { ...item, type, ...structuredClone(restored), savedVariants: variants };
}
function mergeUnchangedItems(items, original, latest) {
  for (let index=0; index<items.length; index++) {
    const item=items[index], before=original.items.find(i=>i.id===item.id) || original.items[index];
    const current=latest.items.find(i=>i.id===item.id);
    if (before && current && before.type===item.type && current.type===item.type) {
      item.values=structuredClone(current.values); item.photos=structuredClone(current.photos || []);
      item.skip=current.skip; item.reason=current.reason;
    }
  }
}
const canManageWorkerTask=(task,name)=>!!name&&(task.submittedBy===name||isTaskAssignedTo(task,name));
function workerReadingItems(docs,name) {
  if(!name)return [];
  const documents=docs.filter(d=>d.kind==='info'&&docForPerson(d,name)&&!ackedBy(d,name)).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||b.created-a.created).map(d=>({id:'doc:'+d.id,title:d.title,href:'#/e/doc/'+d.id,kind:'Документ',action:'Прочитать и нажать «Ознакомлен»',due:d.due||''}));
  const quiz=quizDoneBy(name)?[]:[{id:'quiz:'+weekNo(),title:'Тест недели',href:'#/e/quiz',kind:'Тест',action:'Ответить на вопросы теста'}];
  const training=assignedTraining().filter(t=>t.person===name&&!t.completedAt).map(t=>({id:'training:'+t.id,title:t.title,href:'#/e/training/'+t.id,kind:t.kind==='quiz'?'Личный тест':'Личное ознакомление',action:t.kind==='quiz'?'Ответить на вопросы':'Прочитать и нажать «Ознакомлен»',due:t.due||''}));
  return [...documents,...quiz,...training];
}
function readingTasksHTML(items,name) {
  if(!name)return '<section class="card reading-tasks"><h3>Что нужно прочитать</h3><p class="meta">Выбери себя в поле «Сотрудник» — покажем твои документы и тесты.</p></section>';
  return `<section class="card reading-tasks"><h3>Требует внимания: ${items.length}</h3><p class="meta">${esc(name)}${items.length?' · Открой нужный пункт ниже.':' · Всё прочитано, тесты выполнены.'}</p>${items.map((item,index)=>`<a class="reading-link" href="${esc(item.href)}"><span class="reading-number">${index+1}</span><span><b>${esc(item.title)}</b><small>${esc(item.kind)}${item.due?' · до '+fmtDate(item.due):''}</small><small>${esc(item.action)}</small></span><span aria-hidden="true">›</span></a>`).join('')}</section>`;
}
function canRegisterProtocol(task,name) {
  return canManageWorkerTask(task,name) && task.status==='sent' && task.outcome!=='notdone' && task.items.some(i=>!i.skip);
}
const protocolNumberAction=task=>task.items.some(i=>!i.skip&&!String(i.values.proto_no||'').trim())?'Добавить номер протокола':'Изменить номер протокола';
async function updateTaskNumbers(id, numbers) {
  const task=await dbGet(id); if (!task) throw new Error('Заявка не найдена');
  if(!canRegisterProtocol(task,me()))throw new Error('Номер добавляет сотрудник, выполнивший заявку. Выбери себя в разделе электромонтёра.');
  await docPut({id:'revision-'+crypto.randomUUID(),kind:'task_revision',created:Date.now(),task:structuredClone(task)});
  for (const [key,value] of Object.entries(numbers)) {
    const item=task.items.find(i=>i.id===key); if (item&&!item.skip) item.values.proto_no=String(value).trim();
  }
  task.editedAt=Date.now(); await dbPut(task); return task;
}
async function editTaskNumbers(id) {
  const task=await dbGet(id); if (!task) return;
  if(!canRegisterProtocol(task,me())){toast('Выбери сотрудника, выполнившего эту заявку, в разделе электромонтёра.');return;}
  const dialog=document.createElement('dialog'); dialog.className='psgi-dialog';
  dialog.innerHTML=`<form><h2>Номер протокола после регистрации</h2><p class="hint">Внеси номер из журнала регистрации на базе. Измерения, фотографии и номер наряда сохранятся.</p>${task.items.filter(i=>!i.skip).map(i=>`<label class="field"><span class="lbl">Номер протокола: ${esc(typeName(i.type))}</span><input data-number-item="${esc(i.id)}" value="${esc(i.values.proto_no || '')}" autocomplete="off"></label>`).join('')}<div class="actions"><button class="btn accent" type="submit">Сохранить номера</button><button class="btn ghost" type="button" data-cancel>Отмена</button></div><p class="hint" role="status"></p></form>`;
  document.body.append(dialog); dialog.showModal(); dialog.onclose=()=>dialog.remove();
  dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
  dialog.querySelector('form').onsubmit=async e=>{
    e.preventDefault(); const button=e.target.querySelector('[type=submit]'); button.disabled=true;
    try { const numbers=Object.fromEntries([...dialog.querySelectorAll('[data-number-item]')].map(input=>[input.dataset.numberItem,input.value])); await updateTaskNumbers(id,numbers); dialog.close(); await router(); toast('Номера протоколов сохранены. Данные испытаний сохранены.'); }
    catch(error) { dialog.querySelector('[role=status]').textContent=error.message; button.disabled=false; }
  };
}

// Remove the master entry points; existing journals/preparation records are retained.
const routerBefore18=router;
router=async function() {
  if (location.hash.startsWith('#/m')) { lsSet('role','b'); location.hash=location.hash.replace('#/m','#/b'); return; }
  if (lsGet('role')==='m') lsSet('role','b');
  const parts=(location.hash.slice(1)||'/').split('/').filter(Boolean);
  if (parts[1]==='norm-table') { viewNormTable(parts[0],decodeURIComponent(parts[2] || '')); bottomNav(); voiceButton(); return; }
  await routerBefore18();
};

// Standalone thermography. Legacy filled sections remain readable with their original tests.
const legacyThermal={...THERMAL_SECTION,title:'Сохранённый тепловизионный контроль',show:v=>THERMAL_SECTION.fields.some(f=>String(v[f.id]||'').trim())};
for (const wt of Object.values(WORK_TYPES)) {
  wt.form=wt.form.filter(s=>s!==THERMAL_SECTION);
  wt.form.splice(wt.form.length-1,0,legacyThermal);
}
WORK_TYPES.thermal={code:'',short:'Тепловизионный контроль',title:'Тепловизионный контроль электрооборудования',deviceRoles:['thermal'],briefing:COMMON_BRIEFING,potee:POTEE_COMMON,
  steps:[{title:'Контроль по методике',text:'Укажи оборудование, нагрузку, условия осмотра, результат, номер автомата или узла и приложи термограммы. Оценка — по применимой методике.'}],
  form:[PROTO_SECTION,ASSET_SECTION,{title:'Условия контроля',fields:[{id:'thermal_load',label:'Нагрузка во время контроля',type:'text'},{id:'thermal_method',label:'Методика контроля',type:'text'}]},THERMAL_SECTION,CONCLUSION],check:()=>({})};
DEV_ROLES.push(['thermal','Тепловизионный контроль']); DEV_ROLE_SHORT.thermal='Тепловизионный контроль';
const inspectionBasis={title:'Основание освидетельствования',show:v=>v.mode==='T',fields:[{id:'norm_basis',label:'Применимые нормы по программе работ',type:'select',required:true,options:[{v:'P',t:'ПУЭ'},{v:'M',t:'РД 34.45-51.300-97'}]}]};
for (const wt of Object.values(WORK_TYPES)) wt.form.splice(1,0,inspectionBasis);
SHARED_FIELDS.push('norm_basis');
PROTO_SECTION.fields.find(f=>f.id==='mode').reform=true;
inspectionBasis.fields[0].reform=true;

// Transformer location replaces the expanded asset block; the stored identifiers stay intact.
const transformerLocation={title:'Местоположение',fields:[{type:'location'}]};
TRANSFORMER.form=TRANSFORMER.form.map(s=>s===ASSET_SECTION?transformerLocation:s);
const capInfo=CAPACITORS.form.find(s=>s.title==='Батарея и условия');
capInfo.fields.push({id:'cap_q_var',label:'Номинальная реактивная мощность',type:'number',unit:'вар'},{id:'cap_i_nom',label:'Номинальный ток',type:'number',unit:'А'});
const capRepeat=CAPACITORS.form.flatMap(s=>s.fields).find(f=>f.type==='repeat'&&f.count==='caps_n');
const capMake=capRepeat.make;
capRepeat.make=k=>[...capMake(k),{type:'row',label:`Номинальные данные конденсатора ${k}`,fields:[{id:`cap_q_var_${k}`,label:'Мощность',type:'number',unit:'вар'},{id:`cap_un_${k}`,label:'Напряжение',type:'number',unit:'кВ'},{id:`cap_in_${k}`,label:'Ток',type:'number',unit:'А'}]}];

const cablePhases=['a','b','c'];
const cableConnection=p=>`Фаза ${p.toUpperCase()} — (${cablePhases.filter(x=>x!==p).map(x=>x.toUpperCase()).join(' + ')} + земля)`;
const insulationSection=CABLE.form.find(s=>s.ref===2);
insulationSection.fields=cablePhases.map(p=>({type:'row',label:cableConnection(p)+', МОм',fields:[{id:`ri_bef_${p}`,label:'До испытания',type:'number'},{id:`ri_aft_${p}`,label:'После испытания',type:'number'}]}));
const cableHV=CABLE.form.find(s=>s.ref===3), previousCableFields=cableHV.fields;
cableHV.fields=[...previousCableFields.slice(0,3),
 {type:'dyn',make:v=>cablePhases.map(p=>({type:'row',label:cableConnection(p)+', мкА',fields:[...(num(v.hv_u)!==null&&num(v.hv_u)<20?[]:[{id:`il20_${p}`,label:'При 20 кВ',type:'number'}]),{id:`ilt_${p}`,label:`При Uисп${v.hv_u?' = '+v.hv_u+' кВ':''}`,type:'number'}]}))},
 {type:'calc',id:'asym20',label:'Асимметрия токов при 20 кВ'},{type:'calc',id:'asymt',label:'Асимметрия при испытательном напряжении'},
 {id:'hv_res',label:'Результат',type:'select',options:RESULT}];
cableHV.note+=' Первая запись при 20 кВ — по вашей программе, если эта ступень применима и не превышает испытательное напряжение. Поле не задаёт режим испытания.';
cableHV.fields.find(f=>f.id==='hv_u').rerender=true;
const cableLegacy={title:'Сохранённые замеры при 15 и 35 кВ',show:v=>cablePhases.some(p=>v[`il15_${p}`]||v[`il35_${p}`]),fields:previousCableFields.filter(f=>f.type==='row'&&f.fields.some(c=>/^il(?:15|35)_/.test(c.id)))};
CABLE.form.splice(CABLE.form.indexOf(cableHV)+1,0,cableLegacy);
const previousCableCheck=CABLE.check;
CABLE.check=v=>{const result=previousCableCheck(v),xs=cablePhases.map(p=>num(v[`il20_${p}`]));if(xs.every(x=>x!==null)&&Math.min(...xs)>0)result.asym20=info(fmt(Math.max(...xs)/Math.min(...xs)),'Промежуточная ступень; оценка по программе.');return result;};
CABLE.steps=CABLE.steps.map(s=>s.title==='Испытание выпрямленным напряжением'?{...s,text:s.text.replace('на ступенях 15 и 35 кВ и при испытательном напряжении','на промежуточной ступени, предусмотренной программой, и при испытательном напряжении')}:s);

// Tables were bundled in another parsed paragraph; resolve references across the local document.
const normTables=new Map();
for (const norm of Object.values(NORMS)) for (const entry of norm.rd) {
  const matches=[...entry.t.matchAll(/Таблица\s+(\d+\.\d+)(?!\d)/g)];
  matches.forEach((match,index)=>{const text=entry.t.slice(match.index,matches[index+1]?.index??entry.t.length);const old=normTables.get(match[1]);if(!old||text.length>old.length)normTables.set(match[1],text);});
}
function normReferencesHTML(wt,text,section) {
  const references=[...text.matchAll(/табл\.\s*(\d+\.\d+)/gi)].map(m=>m[1]);
  if (wt.code==='1.8.16'&&section?.ref===3) references.push('6.1','6.2');
  const links=[...new Set(references)].filter(id=>normTables.has(id));
  return `${links.map(id=>`<details class="norm-table"><summary>Таблица ${id} — открыть сохранённый текст</summary>${localNormTableHTML(id)}</details>`).join('')}<p class="hint">Сохранённая выдержка РД; перед работой проверь применимость редакции и программу испытаний.</p><p><a href="https://www.tdtransformator.ru/files/383/rd_34-45-51-300-97.pdf" target="_blank" rel="noopener">Полный текст РД в источнике (6-е издание)</a></p>`;
}
function localNormTableHTML(id) {
  const text=normTables.get(id)||'';
  if(id!=='6.1')return paras(text);
  const lines=text.split('\n'),rows=lines.filter(line=>/^¦\s*(?:До|\d)/.test(line)).map(line=>line.split('¦').slice(1).map(s=>s.trim()));
  const notes=lines.findIndex(line=>line.startsWith('Примечания'));
  return `${paras(lines[0])}<div class="ptbl"><table><thead><tr><th rowspan="3">Класс напряжения, кВ</th><th colspan="3">Силовые трансформаторы, шунтирующие и дугогасящие реакторы — испытательное напряжение, кВ</th><th colspan="3">Аппараты, измерительные трансформаторы, токоограничивающие реакторы, изоляторы, вводы, конденсаторы связи, токопроводы, шины, КРУ и КТП — испытательное напряжение, кВ</th></tr><tr><th rowspan="2">На заводе</th><th rowspan="2">При вводе</th><th rowspan="2">В эксплуатации</th><th rowspan="2">На заводе</th><th colspan="2">Перед вводом и в эксплуатации</th></tr><tr><th>Фарфоровая изоляция</th><th>Другие виды изоляции</th></tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${notes>=0?paras(lines.slice(notes).join('\n')):''}`;
}
function viewNormTable(role,id) { header('РД: таблица '+id,`/${role}`);app.innerHTML=`<div class="card tb-text">${normTables.has(id)?paras(normTables.get(id)):'Таблица не найдена в локальном тексте.'}</div>`; }

// Voice input is attached to the field that will receive the text.
let inlineVoice;
voiceButton=function() {
  $('#voiceInput')?.remove();
  if (inlineVoice && !inlineVoice.field.isConnected) { inlineVoice.controls.remove(); inlineVoice=null; }
};
document.addEventListener('focusin',event=>{
  const field=event.target;
  if (!field.matches('textarea,input:not([type]),input[type="text"],input[type="search"]')||field.readOnly||field.disabled) return;
  if (inlineVoice?.field===field) return;
  if (voiceRecognition) voiceRecognition.stop();
  inlineVoice?.controls.remove();
  const controls=document.createElement('div'); controls.className='inline-voice no-print';
  const label=field.closest('.field')?.querySelector('.lbl')?.textContent||field.getAttribute('aria-label')||field.placeholder||'Сообщение';
  controls.innerHTML=`<button type="button" class="btn ghost small">🎙 Ввести голосом: ${esc(label.replace(/\*/g,'').trim())}</button><span role="status" class="hint"></span>`;
  (field.closest('.field')||field).after(controls);inlineVoice={field,controls};
  const button=controls.querySelector('button'),status=controls.querySelector('[role=status]');
  button.onclick=()=>{
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){status.textContent='Используй микрофон на клавиатуре телефона: этот браузер не поддерживает распознавание.';return;}
    if(voiceRecognition){voiceRecognition.stop();return;}
    const recognition=new Recognition();voiceRecognition=recognition;recognition.lang='ru-RU';
    status.textContent='Слушаю. Текст появится в поле «'+label+'».';button.textContent='Остановить запись';
    recognition.onresult=e=>{if(!field.isConnected)return;field.value=[field.value.trim(),e.results[0][0].transcript].filter(Boolean).join(' ');field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));status.textContent='Текст внесён в поле.';};
    recognition.onerror=e=>{status.textContent=e.error==='not-allowed'?'Разреши микрофон в настройках браузера.':'Не удалось распознать речь. Попробуй ещё раз.';};
    recognition.onend=()=>{voiceRecognition=null;button.textContent='🎙 Ввести голосом: '+label;};
    try{recognition.start();}catch{voiceRecognition=null;status.textContent='Не удалось включить микрофон.';}
  };
});

const enhanceBefore18=enhancePage;
enhancePage=async function(role,parts) {
  await enhanceBefore18(role,parts);
  if(role==='e'&&(parts.length===1||parts[1]==='docs'&&parts[2]==='info'||parts[1]==='training'&&!parts[2])) {
    const panel=document.createElement('div');panel.innerHTML=readingTasksHTML(workerReadingItems(await docsAll(),me()),me());
    const profile=app.querySelector('.profile-selector');if(profile)profile.after(panel);else app.prepend(panel);
  }
  if(role==='e'&&parts[1]==='doc') {
    const doc=await docGet(parts[2]);
    if(doc?.kind==='info'&&me()&&ackedBy(doc,me())) {
      const pending=workerReadingItems(await docsAll(),me()),link=document.createElement('a');link.className='btn ghost small mt';link.href=pending[0]?.href||'#/e/docs/info';link.textContent=pending.length?`Следующий пункт (${pending.length}): ${pending[0].title}`:'Всё выполнено — к информации';app.append(link);
    }
  }
  if(parts[1]==='task') {
    const task=await dbGet(parts[2]);if(!task)return;
    const editable=role==='b'||canManageWorkerTask(task,me());
    if(role==='e'&&canRegisterProtocol(task,me())){const button=document.createElement('button');button.type='button';button.className='btn accent no-print protocol-number-button';button.textContent=protocolNumberAction(task);button.onclick=()=>editTaskNumbers(task.id);const actions=app.querySelector('.task-actions-compact')||app.querySelector('.actions')||app;actions.prepend(button);}
    if(role==='e'&&!editable){app.querySelectorAll('a[href*="/edit/"],#noSave,#noEdit,#delBtn,.swipe-menu,.swipe-actions,#reopenBtn').forEach(el=>el.remove());}
  }
  app.querySelectorAll('[data-geolocate]').forEach(button=>button.onclick=async()=>{
    button.disabled=true;button.textContent='Определяю координаты…';
    try{const c=await getPos(),task=await dbGet(parts[2]),index=+parts[4]||0;if(!task)return;task.items[index].values.latitude=String(c.latitude);task.items[index].values.longitude=String(c.longitude);await dbPut(task);if(button.isConnected)await router();toast('Координаты сохранены');}
    catch(error){toast(error.message);button.disabled=false;button.textContent='Я сейчас тут — взять координаты';}
  });
  if(!parts.length) showOfflineReadiness();
};

async function showOfflineReadiness() {
  let status=$('#offlineReadiness');if(!status){status=document.createElement('p');status.id='offlineReadiness';status.className='hint';app.append(status);}
  try{
    const cache=await caches.open('psgi-v22'),required=['index.html','styles.css','app.js','data.js','norms.js','potee.js','extras.js','kusty.js','manifest.json','icon.svg','improvements.js','repairs.js','monthly.js','device-registry.js','field-work.js','engineering-ideas.js','visual-guides.js','pdf-export.js','ideas.js','chat.js','vendor/pdf-lib.min.js','vendor/fontkit.umd.min.js','vendor/NotoSans-Regular.ttf'];
    const files=await Promise.all(required.map(file=>cache.match(new URL(file,location.href.split('#')[0]))));
    const controlled=navigator.serviceWorker?.controller?.scriptURL.includes('v=22');
    status.textContent=files.every(Boolean)&&controlled?'Приложение сохранено и готово к открытию без интернета. Паспорта сохраняются отдельно после загрузки.':'Подготавливаем автономную версию. Дождись сообщения о готовности при наличии сети.';
  }catch{status.textContent='Браузер не дал проверить автономное сохранение. Открой приложение при наличии сети.';}
}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!location.hash||location.hash==='#/')showOfflineReadiness();});
