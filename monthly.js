'use strict';

const MONTHLY_KIND='monthly_assignment';
const MONTHLY_FORMAT='psgi-monthly-assignment';
const monthlyNumber=value=>value===null||value===undefined||String(value).trim()===''?null:Number(String(value).trim().replace(/\s/g,'').replace(',','.'));
const monthlyMonth=month=>new Date(month+'-02T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(' г.','');
const monthlyFmt=(value,digits=3)=>value===null||!Number.isFinite(value)?'—':value.toLocaleString('ru-RU',{minimumFractionDigits:digits,maximumFractionDigits:digits});
function monthlyRowResult(row) {
  const plan=monthlyNumber(row.plan),norm=monthlyNumber(row.norm),actual=monthlyNumber(row.actual),factor=monthlyNumber(row.factor);
  const nonnegative=n=>n!==null&&Number.isFinite(n)&&n>=0;
  const planned=nonnegative(plan)&&nonnegative(norm)?plan*norm:null;
  const earned=nonnegative(actual)&&nonnegative(norm)?actual*norm:null;
  const actualHours=earned!==null&&factor!==null&&Number.isFinite(factor)&&factor>=.91&&factor<=.97?earned*factor:null;
  return {planned,earned,actualHours};
}
function monthlyTotals(report) {
  const rows=report.rows.map(monthlyRowResult),total=key=>rows.length&&rows.every(r=>r[key]!==null)?rows.reduce((sum,row)=>sum+row[key],0):null;
  const planned=total('planned'),earned=total('earned'),actual=total('actualHours'),hours=monthlyNumber(report.actualWorkedHours);
  const share=category=>actual!==null&&actual>0?report.rows.reduce((sum,row,index)=>sum+(row.category===category?rows[index].actualHours:0),0)/actual*100:null;
  return {planned,earned,actual,percent:earned!==null&&hours!==null&&hours>0?earned/hours*100:null,permitShare:share('permit'),travelShare:share('travel'),planToEarned:planned!==null&&earned>0?planned/earned*100:null,missing:rows.filter(r=>r.planned===null||r.earned===null||r.actualHours===null).length};
}
function normalizeMonthly(raw) {
  if(raw.format!==MONTHLY_FORMAT||raw.version!==1||!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month)||!Array.isArray(raw.rows)||raw.rows.length>500)throw new Error('Нужен файл данных нормированного задания ПСГИ (.psgi.json).');
  const report=structuredClone(raw);
  report.rows=raw.rows.map((row,index)=>{
    const result={...row,id:String(row.id||crypto.randomUUID()),number:String(row.number??index+1)};
    for(const key of ['source','title','object','unit','note'])result[key]=String(row[key]||'').slice(0,8000);
    for(const key of ['plan','norm','actual','factor']){
      result[key]=monthlyNumber(row[key]);
      if(result[key]!==null&&(!Number.isFinite(result[key])||result[key]<0||key==='factor'&&(result[key]<.91||result[key]>.97)))throw new Error(`Строка ${index+1}: проверь ${key==='factor'?'коэффициент (0,91–0,97)':'числовые значения'}.`);
    }
    return result;
  });
  report.actualWorkedHours=monthlyNumber(report.actualWorkedHours);
  if(report.actualWorkedHours!==null&&(!Number.isFinite(report.actualWorkedHours)||report.actualWorkedHours<0))throw new Error('Проверь фактически отработанные часы.');
  return report;
}
function monthlyNewRow(number=1) {
  return {id:crypto.randomUUID(),number:String(number),source:'',title:'',object:'',unit:'шт.',plan:0,norm:null,actual:0,factor:.91};
}
function monthlyWorkbookModel(report) {
  const cells=[],merges=[],heights={},set=(r,c,value,style=0,formula)=>{cells.push({r,c,value,style,formula});};
  const merge=(r1,c1,r2,c2)=>merges.push([r1,c1,r2,c2]);
  const end=20+report.rows.length,total=end+1,foot=total+6;
  set(1,1,'Нормированное задание — '+monthlyMonth(report.month),4);merge(1,1,2,11);
  set(3,1,'Период');set(3,2,report.month);set(4,1,'Исполнитель');set(4,2,report.worker||'',5);merge(4,2,4,5);
  set(6,2,'Ввод: объёмы, нормы, часы и коэффициенты. Коэффициент каждой строки: 0,91–0,97.');merge(6,2,6,11);heights[6]=30;
  set(7,2,'Коэффициенты не подобраны под месячную норму часов. Их можно изменить позднее.');merge(7,2,7,11);heights[7]=30;
  set(14,1,'Наименование объекта (вид работ): '+(report.workplace||''));merge(14,1,14,11);
  set(15,1,'Бригада: '+(report.brigade||''),5);merge(15,1,15,11);
  set(16,1,'Бригадир: '+(report.foreman||''),5);merge(16,1,16,11);
  for(const [c,title] of [[1,'№ п/п'],[2,'Источник нормирования'],[3,'Наименование работ'],[5,'Единица измерения']]){set(18,c,title,3);merge(18,c,19,c===3?4:c);}
  set(18,6,'Задание',3);merge(18,6,18,8);set(18,9,'Выполнение',3);merge(18,9,18,11);
  ['Объём работ','Норма времени на единицу, чел.ч','Нормативное время на объём, чел.ч','Фактически выполненный объём','Нормативное время на фактический объём, чел.ч','Фактическая трудоёмкость, чел.ч'].forEach((title,i)=>set(19,6+i,title,3));
  set(18,12,'Коэфф. 0,91–0,97',3);merge(18,12,19,12);
  [1,2,3,null,4,5,6,7,8,9,10,null].forEach((v,i)=>set(20,i+1,v,3));
  const totals=monthlyTotals(report);
  report.rows.forEach((row,index)=>{
    const r=21+index,result=monthlyRowResult(row);
    [row.number,row.source,row.title,row.object,row.unit,row.plan,row.norm,result.planned,row.actual,result.earned,result.actualHours,row.factor].forEach((value,i)=>set(r,i+1,value,[6,7,9,12].includes(i+1)?5:[8,10,11].includes(i+1)?2:row.additional?6:0));
    const formulas={8:`IF(OR(F${r}="",G${r}=""),"",F${r}*G${r})`,10:`IF(OR(I${r}="",G${r}=""),"",I${r}*G${r})`,11:`IF(OR(J${r}="",L${r}="",L${r}<0.91,L${r}>0.97),"",J${r}*L${r})`};
    for(const [column,formula]of Object.entries(formulas))cells.find(c=>c.r===r&&c.c===+column).formula=formula;
    heights[r]=Math.max(64,Math.ceil(Math.max(row.source.length/27,row.title.length/32,row.object.length/26))*13+12);
  });
  set(total,3,'Итого',7);merge(total,3,total,5);
  for(const [column,key]of [[8,'planned'],[10,'earned'],[11,'actual']]){
    const letter=String.fromCharCode(64+column);set(total,column,totals[key],7,`IF(COUNT(${letter}21:${letter}${end})=${report.rows.length},SUM(${letter}21:${letter}${end}),"")`);
  }
  set(foot,2,'Фактически отработанное время, чел.ч');merge(foot,2,foot,7);set(foot,9,report.actualWorkedHours,5);
  set(foot+1,2,'Выполнение по трудоёмкости, % (графа 9 / отработанные часы × 100)');merge(foot+1,2,foot+1,7);set(foot+1,9,totals.percent,2,`IF(OR(J${total}="",I${foot}="",I${foot}=0),"",J${total}/I${foot}*100)`);heights[foot+1]=32;
  set(foot+2,2,'Отношение задания к выполнению, % (графа 7 / графа 9 × 100)');merge(foot+2,2,foot+2,7);set(foot+2,9,totals.planToEarned,2,`IF(OR(H${total}="",J${total}="",J${total}=0),"",H${total}/J${total}*100)`);heights[foot+2]=32;
  set(foot+3,2,'Работу сдал: '+(report.workerPosition||'')+' '+(report.worker||''));merge(foot+3,2,foot+3,7);heights[foot+3]=34;
  set(foot+3,9,'Работу принял: '+(report.foreman||''));merge(foot+3,9,foot+3,11);
  set(foot+4,2,'Доля допуска в фактической трудоёмкости, %');merge(foot+4,2,foot+4,7);
  set(foot+5,2,'Доля транспорта в фактической трудоёмкости, %');merge(foot+5,2,foot+5,7);
  for(const [category,offset,key]of [['permit',4,'permitShare'],['travel',5,'travelShare']]){const indices=report.rows.flatMap((row,index)=>row.category===category?[21+index]:[]);const numerator=indices.length?indices.map(r=>'K'+r).join('+'):'0';set(foot+offset,9,totals[key],2,`IF(OR(K${total}="",K${total}=0),"",(${numerator})/K${total}*100)`);}
  const notes=[report.sourceNote||''];
  if(report.photoTotals)notes.push(`Контрольные итоги на фото: графа 7 — ${report.photoTotals.planned}; графа 9 — ${report.photoTotals.earned}; графа 10 — ${report.photoTotals.actual}. По видимым нормам графа 9 пересчитывается в ${monthlyFmt(totals.earned)}. Скрытая точность исходного Excel не известна.`);
  if(report.sourceFiles?.length)notes.push('Источник: фотографии '+report.sourceFiles[0]+' — '+report.sourceFiles.at(-1)+'.');
  notes.filter(Boolean).forEach((note,index)=>{set(foot+6+index,2,note,8);merge(foot+6+index,2,foot+6+index,11);heights[foot+6+index]=index===0?52:40;});
  return {cells,merges,heights,end,total,foot,rows:foot+6+notes.length,widths:[6,29,35,29,12,10,13,14,13,15,15,12],name:'НЗ '+report.month};
}

function monthlyEscapeXML(value) {return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function monthlyZip(files) {
  const encoder=new TextEncoder(),chunks=[],central=[];let offset=0;
  const bytes=(length,write)=>{const value=new Uint8Array(length);write(new DataView(value.buffer));return value;};
  const crc=data=>{let value=0xffffffff;for(const b of data){value^=b;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return(value^0xffffffff)>>>0;};
  for(const [name,text]of Object.entries(files)){
    const filename=encoder.encode(name),data=encoder.encode(text),check=crc(data);
    const local=bytes(30,v=>{v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,check,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,filename.length,true);});
    const record=bytes(46,v=>{v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,check,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,filename.length,true);v.setUint32(42,offset,true);});
    chunks.push(local,filename,data);central.push(record,filename);offset+=local.length+filename.length+data.length;
  }
  const centralSize=central.reduce((sum,b)=>sum+b.length,0),count=Object.keys(files).length;
  const end=bytes(22,v=>{v.setUint32(0,0x06054b50,true);v.setUint16(8,count,true);v.setUint16(10,count,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);});
  return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function monthlyXlsx(report) {
  const model=monthlyWorkbookModel(report),x=monthlyEscapeXML,letter=c=>String.fromCharCode(64+c),byRow=new Map();
  for(const cell of model.cells){if(!byRow.has(cell.r))byRow.set(cell.r,[]);byRow.get(cell.r).push(cell);}
  const data=[...byRow].sort((a,b)=>a[0]-b[0]).map(([r,cells])=>`<row r="${r}" ht="${model.heights[r]||22}" customHeight="1">${cells.sort((a,b)=>a.c-b.c).map(c=>{const attributes=`r="${letter(c.c)}${r}" s="${c.style}"`;if(c.formula)return `<c ${attributes}><f>${x(c.formula)}</f>${c.value===null?'':`<v>${c.value}</v>`}</c>`;return typeof c.value==='number'?`<c ${attributes}><v>${c.value}</v></c>`:`<c ${attributes} t="inlineStr"><is><t xml:space="preserve">${x(c.value)}</t></is></c>`;}).join('')}</row>`).join('');
  const fills=['FFFFFFFF','FFF2F4F7','FFDDEBD0','FFE3EAF3','FFFFF2CC'];
  const styles=`<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.000"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map(color=>`<fill><patternFill patternType="solid"><fgColor rgb="${color}"/></patternFill></fill>`).join('')}</fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="9">${[[0,2,0],[0,2,164],[0,4,164],[1,5,0],[2,2,0],[0,6,164],[0,4,0],[1,6,165],[0,2,0]].map(([font,fill,num],i)=>`<xf fontId="${font}" fillId="${fill}" numFmtId="${num}" borderId="0" xfId="0" applyAlignment="1" applyFill="1" applyNumberFormat="1"><alignment vertical="${i===8?'top':'center'}" wrapText="1" horizontal="${i===3?'center':'general'}"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return monthlyZip({
    '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${x(model.name)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${x(model.name)}'!$A$1:$K$${model.rows}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'${x(model.name)}'!$18:$20</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1" calcMode="auto"/></workbook>`,
    'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml':styles,
    'xl/worksheets/sheet1.xml':`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="2" ySplit="20" topLeftCell="C21" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${model.widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData><mergeCells count="${model.merges.length}">${model.merges.map(([r1,c1,r2,c2])=>`<mergeCell ref="${letter(c1)}${r1}:${letter(c2)}${r2}"/>`).join('')}</mergeCells><dataValidations count="1"><dataValidation type="decimal" operator="between" sqref="L21:L${model.end}" allowBlank="1" showErrorMessage="1" errorTitle="Коэффициент" error="Введите от 0,91 до 0,97"><formula1>0.91</formula1><formula2>0.97</formula2></dataValidation></dataValidations><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`
  });
}
function monthlyDownload(blob,name) {const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}

async function viewMonthly(role,id) {
  if(!id){
    header('Нормированное задание по месяцам',`/${role}/more`);
    const reports=(await docsAll()).filter(d=>d.kind===MONTHLY_KIND).sort((a,b)=>b.month.localeCompare(a.month)||b.updatedAt-a.updatedAt);
    app.innerHTML=`<div class="card"><h2>Задания по месяцам</h2><p class="meta">Задания и изменения сохраняются на этом устройстве. Заполненный файл задания загружается один раз.</p><div class="actions"><label class="btn accent file-btn small">Загрузить задание<input id="monthlyImport" type="file" accept="application/json,.json"></label><button class="btn ghost small" id="monthlyNew">Новое задание</button></div></div>${reports.map(report=>{const totals=monthlyTotals(report);return `<a class="card task" href="#/${role}/monthly/${report.id}"><div class="top-line"><b>${esc(monthlyMonth(report.month))}</b><span class="badge st-sent">${report.rows.length} строк</span></div><p>${esc(report.worker||report.brigade||'Нормированное задание')}</p><p class="meta">Задание: ${monthlyFmt(totals.planned,2)} чел.ч · выполнение по норме: ${monthlyFmt(totals.earned,2)} чел.ч</p></a>`;}).join('')||'<div class="card meta">Пока заданий нет. Загрузи файл .psgi.json или создай новое.</div>'}`;
    $('#monthlyImport').onchange=async event=>{
      const file=event.target.files[0];if(!file)return;
      try{if(file.size>3e6)throw new Error('Файл задания слишком большой.');const report=normalizeMonthly(JSON.parse(await file.text()));const same=reports.find(d=>d.month===report.month&&d.worker===report.worker);if(same&&!confirm('Заменить сохранённое задание за этот месяц?'))return;report.id=same?.id||'monthly-'+crypto.randomUUID();report.kind=MONTHLY_KIND;report.updatedAt=Date.now();await docPut(report);location.hash=`/${role}/monthly/${report.id}`;}catch(error){toast(error.message||'Не удалось прочитать файл задания.');event.target.value='';}
    };
    $('#monthlyNew').onclick=async()=>{const month=await askText('Месяц задания','В формате ГГГГ-ММ',new Date().toISOString().slice(0,7),'2026-11');if(!month)return;try{const report=normalizeMonthly({format:MONTHLY_FORMAT,version:1,month,worker:me(),rows:[monthlyNewRow()],actualWorkedHours:null});report.id='monthly-'+crypto.randomUUID();report.kind=MONTHLY_KIND;report.updatedAt=Date.now();await docPut(report);location.hash=`/${role}/monthly/${report.id}`;}catch(error){toast(error.message);}};
    return;
  }
  const report=await docGet(id);if(!report||report.kind!==MONTHLY_KIND){location.hash=`/${role}/monthly`;return;}
  header(monthlyMonth(report.month),`/${role}/monthly`);
  const numeric=new Set(['plan','norm','actual','factor']);let saving=Promise.resolve(),saveVersion=0;
  const save=()=>{report.updatedAt=Date.now();const version=++saveVersion;const snapshot=structuredClone(report);saving=saving.catch(()=>{}).then(()=>docPut(snapshot));saving.then(()=>{if(version===saveVersion&&$('#monthlyStatus'))$('#monthlyStatus').textContent='Сохранено на устройстве';}).catch(()=>{if($('#monthlyStatus'))$('#monthlyStatus').textContent='Не удалось сохранить. Выгрузи файл задания.';});};
  const input=(row,key)=>numeric.has(key)?`<input data-monthly-row="${esc(row.id)}" data-key="${key}" inputmode="decimal" aria-label="Строка ${esc(row.number)}: ${{plan:'объём задания',norm:'норма времени',actual:'выполненный объём',factor:'коэффициент 0,91–0,97'}[key]}" value="${esc(row[key]??'')}" ${key==='factor'?'title="От 0,91 до 0,97"':''}>`:`<textarea data-monthly-row="${esc(row.id)}" data-key="${key}" aria-label="Строка ${esc(row.number)}: ${esc({number:'номер',source:'источник нормирования',title:'наименование работы',object:'объект',unit:'единица измерения'}[key]||key)}" rows="3">${esc(row[key]||'')}</textarea>`;
  const draw=()=>{
    app.innerHTML=`<section class="card"><h2>Нормированное задание</h2><p>${esc(monthlyMonth(report.month))} · ${esc(report.worker||'Исполнитель не указан')}</p><details><summary>Реквизиты задания</summary>${[['month','Месяц (ГГГГ-ММ)'],['workplace','Вид работ / объект'],['brigade','Бригада'],['foreman','Работу принял'],['worker','Работу сдал'],['workerPosition','Должность исполнителя']].map(([key,label])=>`<label class="field"><span class="lbl">${label}</span><input data-monthly-meta="${key}" value="${esc(report[key]||'')}"></label>`).join('')}</details><div class="actions"><button class="btn accent small" id="monthlyExcel">Скачать Excel</button><button class="btn ghost small" id="monthlyData">Скачать данные</button><button class="btn ghost small" id="monthlyCopy">На другой месяц</button><button class="btn ghost small" id="monthlyAdd">Добавить строку</button></div><p id="monthlyStatus" class="hint" role="status">Сохранено на устройстве</p></section>
      <section class="card monthly-summary"><div>Задание, чел.ч <b data-monthly-total="planned"></b></div><div>Норма на выполненный объём, чел.ч <b data-monthly-total="earned"></b></div><div>Фактическая трудоёмкость, чел.ч <b data-monthly-total="actual"></b></div><label class="field"><span class="lbl">Фактически отработанное время за месяц, чел.ч</span><input data-monthly-meta="actualWorkedHours" inputmode="decimal" value="${esc(report.actualWorkedHours??'')}"></label><div>Выполнение по трудоёмкости <b data-monthly-total="percent"></b></div><div>Допуск / фактическая трудоёмкость <b data-monthly-total="permitShare"></b></div><div>Транспорт / фактическая трудоёмкость <b data-monthly-total="travelShare"></b></div><p class="hint" id="monthlyMissing"></p></section>
      <p class="meta">План и факт вводятся вручную. Графы 7 и 9: объём × норма. Графа 10: графа 9 × коэффициент. Коэффициент можно менять от 0,91 до 0,97; подбор под месячные часы пока не выполняется. Таблица прокручивается вбок.</p>
      <div class="monthly-table-wrap"><table class="monthly-table"><thead><tr><th rowspan="2">№</th><th rowspan="2">Источник нормирования</th><th rowspan="2">Наименование работ</th><th rowspan="2">Объект / оборудование</th><th rowspan="2">Ед. изм.</th><th colspan="3">Задание</th><th colspan="3">Выполнение</th><th rowspan="2">Коэф.</th></tr><tr><th>5. Объём</th><th>6. Норма, чел.ч</th><th>7. Нормативное время, чел.ч</th><th>8. Объём</th><th>9. По норме, чел.ч</th><th>10. Фактическая трудоёмкость, чел.ч</th></tr></thead><tbody>${report.rows.map(row=>`<tr class="${row.additional?'monthly-additional':''}"><td>${input(row,'number')}</td><td>${input(row,'source')}</td><td>${input(row,'title')}</td><td>${input(row,'object')}</td><td>${input(row,'unit')}</td><td>${input(row,'plan')}</td><td>${input(row,'norm')}</td><td data-monthly-result="${esc(row.id)}:planned"></td><td>${input(row,'actual')}</td><td data-monthly-result="${esc(row.id)}:earned"></td><td data-monthly-result="${esc(row.id)}:actualHours"></td><td>${input(row,'factor')}</td></tr>`).join('')}</tbody></table></div>
      <section class="card mt"><h3>Источник и точность</h3><p class="meta">${esc(report.sourceNote||'Данные вводятся пользователем.')}</p>${report.photoTotals?`<p class="meta">На фото итоги: задание ${monthlyFmt(report.photoTotals.planned,2)}, по норме ${monthlyFmt(report.photoTotals.earned,2)}, фактически ${monthlyFmt(report.photoTotals.actual,2)} чел.ч. Пересчёт ведётся по видимым значениям строк; возможны различия из-за точности исходного файла.</p>`:''}<button class="btn ghost small danger" id="monthlyDelete">Удалить это задание</button></section>`;
    refresh();
    $('#monthlyExcel').onclick=async()=>{await saving;monthlyDownload(monthlyXlsx(report),'Нормированное задание '+report.month+'.xlsx');};
    $('#monthlyData').onclick=()=>monthlyDownload(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),'Нормированное задание '+report.month+'.psgi.json');
    $('#monthlyAdd').onclick=()=>{report.rows.push(monthlyNewRow(report.rows.length+1));save();draw();};
    $('#monthlyCopy').onclick=async()=>{const month=await askText('Новый месяц','Скопируются нормы, строки и план. Выполнение будет обнулено.',report.month,'2026-12');if(!month)return;try{const copy=normalizeMonthly({...structuredClone(report),month,actualWorkedHours:null,photoTotals:undefined,rows:report.rows.map(r=>({...r,id:crypto.randomUUID(),actual:0,photoActualHours:undefined}))});copy.id='monthly-'+crypto.randomUUID();copy.updatedAt=Date.now();await docPut(copy);location.hash=`/${role}/monthly/${copy.id}`;}catch(error){toast(error.message);}};
    $('#monthlyDelete').onclick=async()=>{if(confirm('Удалить это задание? Сначала сохрани файл данных, если оно ещё понадобится.')){await saving;await docDel(report.id);location.hash=`/${role}/monthly`;}};
    app.oninput=event=>{
      const field=event.target,key=field.dataset.key,rowId=field.dataset.monthlyRow,meta=field.dataset.monthlyMeta;
      if(rowId&&key){const row=report.rows.find(r=>r.id===rowId);if(!row)return;row[key]=numeric.has(key)?monthlyNumber(field.value):field.value;const invalid=numeric.has(key)&&row[key]!==null&&(!Number.isFinite(row[key])||row[key]<0||key==='factor'&&(row[key]<.91||row[key]>.97));field.setAttribute('aria-invalid',String(invalid));}
      else if(meta){if(meta==='month'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(field.value)){field.setAttribute('aria-invalid','true');return;}if(meta==='actualWorkedHours'){const value=monthlyNumber(field.value);if(value!==null&&(!Number.isFinite(value)||value<0)){field.setAttribute('aria-invalid','true');return;}report[meta]=value;}else report[meta]=field.value;field.setAttribute('aria-invalid','false');}
      else return;
      refresh();$('#monthlyStatus').textContent='Сохраняем…';save();
    };
  };
  const refresh=()=>{
    const totals=monthlyTotals(report);
    app.querySelectorAll('[data-monthly-total]').forEach(el=>{const key=el.dataset.monthlyTotal,percent=['percent','permitShare','travelShare'].includes(key);el.textContent=monthlyFmt(totals[key],percent?2:3)+(percent&&totals[key]!==null?' %':'');});
    const results=new Map(report.rows.map(row=>[row.id,monthlyRowResult(row)]));
    app.querySelectorAll('[data-monthly-result]').forEach(el=>{const split=el.dataset.monthlyResult.lastIndexOf(':'),id=el.dataset.monthlyResult.slice(0,split),key=el.dataset.monthlyResult.slice(split+1);el.textContent=monthlyFmt(results.get(id)?.[key]);});
    const status=$('#monthlyMissing');if(status)status.textContent=totals.missing?`Проверь объёмы, нормы и коэффициенты: не заполнено или некорректно строк — ${totals.missing}.`:'Все строки участвуют в расчёте.';
  };
  draw();
}
if(typeof window!=='undefined') {
  const monthlyPreviousRouter=router;
  router=async function(){
    const parts=(location.hash.slice(1)||'/').split('/').filter(Boolean);
    if(parts[1]!=='monthly')return monthlyPreviousRouter();
    app.oninput=null;app.onclick=null;app.onchange=null;currentFormId=null;swipeNav=null;
    const role=parts[0]==='b'?'b':'e';lsSet('role',role);
    try{await viewMonthly(role,parts[2]);bottomNav();voiceButton();}catch(error){console.error(error);app.innerHTML='<div class="card">'+esc(error.message||'Не удалось открыть задание')+'</div>';}
  };
  window.addEventListener('hashchange',()=>{if(!location.hash.includes('/monthly/'))app.oninput=null;});
}
