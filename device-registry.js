'use strict';

const REGISTRY_PHOTO_DATE='2026-11-17';
const photoDevice=(model,no,date,next,cert='',range='',acc='',roles=[],note='')=>({model,name:model,no,date,next,cert,range,acc,roles,note,src:'Реестр приборов на фотографиях пользователя от 17.11.2026'});
const FULL_DEVICE_REGISTRY=[
  photoDevice('Мегаомметр MIC-5005','LX0748','2025-08-13','2026-08-12','С-ВВО/13-08-2025/455892060','1 кОм–15 ТОм','±3%',['megger']),
  photoDevice('Измеритель электробезопасности MPI-530','AH7709','2025-10-17','2026-10-16','С-ВВО/17-10-2025/474838401','многофункциональный','±2%',['megger','earth','loop']),
  photoDevice('Измеритель электрического сопротивления МИКО-2.3','043Р','2025-12-11','2026-12-10','С-ДИТ/11-12-2025/487712666','многопредельный','±5 Rx; ±0,2%',['wind','contact'],'Обозначение погрешности «±5 Rx» перенесено с фото; формулу уточнять по руководству.'),
  photoDevice('Аппарат испытания диэлектриков цифровой АИД-70Ц','2032','2025-10-27','2026-10-26','С-М/27-10-2025/478849066','10–70 кВ постоянное; 10–50 кВ переменное','±3%',['hv','hv_dc']),
  photoDevice('Микроомметр ТС-3','347','2025-11-20','2026-11-19','паспорт','1 мОм–10 кОм','±0,2%',['contact'],'Диапазон на фото расходится с назначением микроомметра: сохранён как запись реестра; сверить режимы в руководстве.'),
  photoDevice('Измеритель сопротивления MRU-200','E31748','2025-02-10','2026-02-10','С-ВВО/10-02-2025/408891532','многопредельный','',['earth']),
  photoDevice('Установка HVA-60','GH5204.14C044','2025-04-14','2027-04-13','С-ВЯ/14-04-2025/425092870','','',['hv_dc','hv_vlf'],'Срок 13.04.2027 подтверждён пользователем; повторяющиеся строки реестра объединены.'),
  photoDevice('Измеритель напряжения прикосновения и параметров УЗО MRP-201','AG2296','2025-10-16','2026-10-15','С-ВВО/16-10-2025/47826750','многопредельный','±2%',['rcd']),
  photoDevice('Аппарат испытания масла АИМ-90А','1382','2025-10-06','2026-10-06','С-ДЦВ/06-10-2025/472983380','2–90 кВ','±5%',['oil'],'Строка «Маслопробойник АИМ-90А» без номера во втором листе не создана как второй аппарат.'),
  photoDevice('РЕТОМ-30КА','1994','2025-12-03','2029-12-02','С-ДЯК/03-12-2025/486553131','многопредельный','0,5%',['primary']),
  photoDevice('Тангенс-2000','11 25 1967','','','','многопредельный','',['tan'],'Дата в реестре указана только «11.2025»; точный день и срок не указаны.'),
  photoDevice('Клещи электроизмерительные CMP-2000','BB8862','2025-08-28','2026-08-27','С-ДРШ/28-08-2025/460211959','многофункциональные','0,5%–3,5%',['clamp']),
  photoDevice('Система измерения высокого напряжения СВИ-100/140','25405','2025-11-27','2026-11-26','С-ДЭН/27-11-2025/484092537','10–140 кВ постоянное; 10–100 кВ переменное','2%',['voltage'],'Измерительная система; не самостоятельный источник испытательного напряжения.'),
  photoDevice('Мегаомметр Е6-24','3681','','','калибровка','','',['megger'],'В реестре: I квартал 2025, калибровка; точная дата и срок отсутствуют.'),
  photoDevice('Мегаомметр Е6-24','23772','2026-01-20','','С-АХД/20-01-2026/499881362','','',['megger']),
  photoDevice('Мегаомметр Е6-24','28042','2026-07-06','','С-АХД/06-07-2026/541788021','','',['megger']),
  photoDevice('Мегаомметр ЭСО 202/2Г','42232','2025-07-15','','С-АХД/15-07-2025/450628196','','',['megger']),
  photoDevice('Мост постоянного тока Р4833','0664','2026-01-20','','4100-02-25','','',['wind']),
  photoDevice('Мост постоянного тока Р4833','0239','2025-04-07','','4100-02-238','','',['wind']),
  photoDevice('Измеритель сопротивления ПФИ24-10Р','2404','2024-03-29','2026-03-28','С-ТТ/29-03-2024/327608904','','',['contact']),
  photoDevice('Миллиомметр ПТФ-1','4419','2026-01-20','','С-АХД/20-01-2026/499881995','1 мкОм–2000 Ом','',['wind']),
  photoDevice('Аппарат испытания диэлектриков АИД-70','2339','2025-11-05','2026-11-05','3226282/2039/1','','',['hv','hv_dc'],'Дата «годно до» перенесена буквально с нового реестра.'),
  photoDevice('Измеритель сопротивления MRU-200','700358','2026-07-06','2027-07-05','С-АХД/06-07-2026/541788393','','',['earth']),
  photoDevice('Измеритель сопротивления KEW 6016','8334063','2026-04-07','','С-ВЯ/07-04-2026/517665849','20–2000 Ом','',['earth'],'В столбце «Годно до» на фото указан диапазон, а не дата. Срок не придуман.'),
  photoDevice('Измеритель сопротивления М-416','14103','2025-04-07','2026-04-07','С-АХД/07-04-2025/353648718','','',['earth']),
  photoDevice('Омметр ЭСО-212','409','2025-04-07','','','','',['earth'],'Срок в реестре: II квартал 2026; точная дата не указана.'),
  photoDevice('Микроомметр Ф4104-М1','9072','2025-03-17','2026-03-17','С-АХД/17-03-2025/421162961','','',['contact']),
  photoDevice('Микроомметр ИКС-30А','434','2023-10-27','2028-10-27','С-ГКА/27-10-2023/291206404','','',['contact']),
  photoDevice('Микроомметр МКИ 600','1088','2025-03-24','2026-03-24','4100-02-210','','',['contact']),
  photoDevice('Измеритель петли фаза-нуль «Вектор»','474','2026-06-15','2027-06-14','С-ВЯ/15-06-2026/533307297','','',['loop']),
  photoDevice('СВС-100','143','2024-04-10','2027-04-10','На 3 года','','',['ppe'],'Испытание средств защиты.'),
  photoDevice('Штанга измерительная ШИН-20','15367950','2025-07-09','2027-07-09','3225345/4134/1','','',['voltage']),
  photoDevice('Коэффициент','374','2025-05-12','','С-ВЯ/12-05-2025/431912404','','',['ratio'],'Название «Коэффициент» и номер подтверждены пользователем. Производитель и точная модификация пока не установлены; паспорт другого прибора не подставлять.'),
  photoDevice('Тепловизор RGK TL-160+','22100038','2026-08-24','2027-08-23','С-ВЯ/24-08-2026/51794838','','',['thermal']),
  photoDevice('Тепловизор RGK TL-160+','22100005','2025-03-12','2026-03-12','С-ВЯ/12-03-2025/416397414','','',['thermal']),
  photoDevice('Тангенс-2000','12 23 1815','2023-12-18','2025-12-17','С-В/08-04-2025/425494106','','',['tan'],'Дата свидетельства отличается от даты поверки на фото; обе записи сохранены для сверки.'),
  photoDevice('АИСТ СНЧ 36','1168','2026-04-07','2028-04-06','С-ВЯ/07-04-2026/517600442','','',['hv_dc','hv_vlf'])
];
for(const [key,label]of [['rcd','Параметры УЗО'],['oil','Пробивное напряжение масла'],['primary','Первичный ток и проверка отключения'],['tan','Ёмкость и tg δ'],['clamp','Токовые клещи'],['ratio','Коэффициент трансформации'],['voltage','Измерение напряжения'],['ppe','Испытания средств защиты'],['hv_vlf','Испытание напряжением СНЧ']])if(!DEV_ROLES.some(row=>row[0]===key)){DEV_ROLES.push([key,label]);DEV_ROLE_SHORT[key]=label;}
const registrySerial=value=>String(value||'').toUpperCase().replace(/[\s.\-]/g,'').replace(/[РАСНЕКХТВМО]/g,c=>({'Р':'P','А':'A','С':'C','Н':'H','Е':'E','К':'K','Х':'X','Т':'T','В':'B','М':'M','О':'O'}[c]));
async function initializeFullRegistry() {
  if(lsGet('psgiRegistryPhotoV22'))return;
  const devices=(await docsAll()).filter(d=>d.kind==='device');
  for(const entry of FULL_DEVICE_REGISTRY){
    let existing=devices.find(d=>registrySerial(d.no)&&registrySerial(d.no)===registrySerial(entry.no));
    if(!existing&&/СВИ-100\/140/.test(entry.name))existing=devices.find(d=>!d.no&&/СВИ-100\/140/.test(d.name));
    if(existing){
      const oldLabel=devLabel(existing),newer=!existing.date||entry.date&&entry.date>=existing.date;
      existing.registryPhoto={...entry};existing.registryPhotoV=22;
      for(const key of ['range','acc'])if((!existing[key]||/уточнить|не указан|многопредельный/i.test(existing[key]))&&entry[key])existing[key]=entry[key];
      if(newer){for(const key of ['date','next','cert'])if(entry[key])existing[key]=entry[key];}
      if(!existing.no)existing.no=entry.no;
      const retainedRoles=(existing.roles||[]).filter(r=>!(/СВИ-100\/140|ШИН-20|СВС-100/.test(entry.name)&&['hv','hv_dc'].includes(r)));
      existing.roles=[...new Set([...retainedRoles,...entry.roles])];existing.note=[existing.note,entry.note].filter(Boolean).join('\n');
      await docPut(existing);if(oldLabel!==devLabel(existing)){removeFromList('devices',oldLabel);addToList('devices',[devLabel(existing)]);}
    }else{existing={...entry,id:'registry-'+crypto.randomUUID(),kind:'device',created:Date.now(),files:[],registryPhoto:{...entry},registryPhotoV:22};await docPut(existing);devices.push(existing);addToList('devices',[devLabel(existing)]);}
  }
  lsSet('psgiRegistryPhotoV22',REGISTRY_PHOTO_DATE);
}
const initializeBeforeFullRegistry=initializeRelease;
initializeRelease=async function(){await initializeBeforeFullRegistry();await initializeFullRegistry();};
const enhanceBeforeRegistry=enhancePage;
enhancePage=async function(role,parts){
  await enhanceBeforeRegistry(role,parts);
  if(parts[1]==='device'&&parts[2]&&parts[2]!=='new'){
    const device=await docGet(parts[2]);if(device?.registryPhoto){const note=document.createElement('section');note.className='card';const found=MANUALS.some(m=>m.file&&m.match.test(device.name));note.innerHTML=`<h3>Сведения из полного реестра</h3><p class="meta">${esc(device.registryPhoto.src)}</p><p><b>Функции:</b> ${esc((device.roles||[]).map(r=>DEV_ROLE_SHORT[r]||r).join('; ')||'Требуют уточнения по паспорту')}</p>${device.note?paras(device.note):''}${!found?'<p class="hint">Проверенное руководство PDF для этой модели пока не добавлено. Паспорт своего экземпляра можно прикрепить к карточке.</p>':''}<p class="hint">Даты и номера перенесены с фотографий, не являются онлайн-проверкой ФГИС «Аршин».</p>`;app.append(note);}
  }
};

const PHOTO_MANUALS=[
  {
    "id": "mic-5005",
    "pattern": "MIC-5005",
    "name": "MIC-5005",
    "file": "manuals/mic-5005.pdf",
    "title": "Руководство по эксплуатации · 29 стр.",
    "source": "https://www.eskomp.ru/files/products/rukovodstvo-po-ekspluatatsii-izmeritelej-parametrov-elektroizolyatsii-mic-5005-i-mic-5010-1.pdf",
    "author": "SONEL; копия ТД ЭСКО",
    "summary": "Сопротивление изоляции, R15/R60, PI/DAR, ёмкость и разряд объекта. Руководство MIC-5005/MIC-5010; функции каждой модели различаются.",
    "checked": "17.11.2026"
  },
  {
    "id": "mrp-201",
    "pattern": "MRP-201",
    "name": "MRP-201",
    "file": "manuals/mrp-201.pdf",
    "title": "Руководство по эксплуатации · 31 стр.",
    "source": "https://www.eskomp.ru/files/products/mrp201.pdf",
    "author": "SONEL; копия ТД ЭСКО",
    "summary": "Ток и время срабатывания УЗО, напряжение прикосновения, выбор типа УЗО и режима проверки.",
    "checked": "17.11.2026"
  },
  {
    "id": "mru-200",
    "pattern": "MRU-200",
    "name": "MRU-200",
    "file": "manuals/mru-200.pdf",
    "title": "Руководство по эксплуатации · 41 стр.",
    "source": "https://www.sonel.ru/common/files/manual/MRU200.pdf",
    "author": "SONEL",
    "summary": "Сопротивление заземления различными методами, удельное сопротивление грунта и непрерывность соединений. Метод и принадлежности выбираются по руководству.",
    "checked": "17.11.2026"
  },
  {
    "id": "miko-2-3",
    "pattern": "МИКО-2[.,]3",
    "name": "МИКО-2.3",
    "file": "manuals/miko-2-3.pdf",
    "title": "Руководство по эксплуатации · 33 стр.",
    "source": "https://1ep.kz/upload/iblock/2c0/yvf3fraq6fp81yl9zkxafi38nk25fdm4/43130035205f839b6abe2ce9a7a73dbb.pdf",
    "author": "СКБ ЭП; копия Электронприбор",
    "summary": "Измерение электрического сопротивления в микро-, милли- и килоомном режимах, измерение температуры. Схемы для индуктивных и безиндуктивных объектов различаются.",
    "checked": "17.11.2026"
  },
  {
    "id": "tangens-2000",
    "pattern": "Тангенс-2000",
    "name": "Тангенс-2000",
    "file": "manuals/tangens-2000.pdf",
    "title": "Руководство по эксплуатации · 52 стр.",
    "source": "https://www.terra-kip.ru/files/products/d7/d795fb14-2e4e-11ed-80d5-005056010d88.pdf",
    "author": "НИИЭМП; копия Терра-КИП",
    "summary": "Измерение ёмкости и тангенса угла диэлектрических потерь. Условия применения, внешнее испытательное оборудование и схемы — в руководстве.",
    "checked": "17.11.2026"
  },
  {
    "id": "cmp-2000",
    "pattern": "CMP-2000",
    "name": "CMP-2000",
    "file": "manuals/cmp-2000.pdf",
    "title": "Руководство по эксплуатации · 88 стр.",
    "source": "https://cdn.sonel.com/Erp/CMP-2000%20insobs%20v1.08%20PL%20GB%20ES%20RU.pdf",
    "author": "SONEL",
    "summary": "Клещи для измерения тока и дополнительных электрических величин. Многоязычное руководство, русский раздел начинается с печатной страницы 64.",
    "checked": "17.11.2026"
  },
  {
    "id": "aim-90a",
    "pattern": "АИМ-90[АA]",
    "name": "АИМ-90А",
    "file": "manuals/aim-90a.pdf",
    "title": "Руководство по эксплуатации · 38 стр.",
    "source": "https://www.souz-pribor.ru/upload/iblock/2ac/Rukovodstvo-po-ekspluatatsii-AIM_90A.pdf",
    "author": "СКБ Медрентех; копия Союз-Прибор",
    "summary": "Определение пробивного напряжения электроизоляционного масла. Подготовка ячейки, последовательность серии и ограничения аппарата описаны в PDF.",
    "checked": "17.11.2026"
  },
  {
    "id": "aist-snch",
    "pattern": "АИСТ.*СНЧ.*36",
    "name": "АИСТ СНЧ 36",
    "file": "manuals/aist-snch.pdf",
    "title": "Руководство по эксплуатации · 24 стр.",
    "source": "https://bris.ru/files/products/re_apparaty-aist-snch-30-36-60_ver102-4.pdf",
    "author": "БРИС",
    "summary": "Испытания диэлектриков напряжением сверхнизкой частоты. Общее руководство АИСТ СНЧ 30/36/60; параметры выбирать по исполнению 36.",
    "checked": "17.11.2026"
  },
  {
    "id": "tl-160-plus",
    "pattern": "TL-160\\+",
    "name": "TL-160+",
    "file": "manuals/tl-160-plus.pdf",
    "title": "Руководство по эксплуатации · 36 стр.",
    "source": "https://www.rgk-tools.com/upload/iblock/d92/d920c46ea57f20c522342a30fb4600c8.pdf",
    "author": "RGK",
    "summary": "Термограммы, фокусировка, измерение температуры, излучательная способность и отражённая температура, сохранение изображений.",
    "checked": "17.11.2026"
  },
  {
    "id": "tc-3",
    "pattern": "ТС-3|TC-3",
    "name": "ТС-3",
    "file": "manuals/tc-3.pdf",
    "title": "Руководство по эксплуатации · 14 стр.",
    "source": "https://1ep.kz/upload/iblock/983/ye0qc6epr9tqgau7r6epn7noijyfcfyy/Rukovodstvo_po_ekspluatatsii_TS_3.pdf",
    "author": "НИИЭМП; копия Электронприбор",
    "summary": "Четырёхпроводное измерение малых сопротивлений контактов и соединений. Руководство РУКЮ 411212.040 РЭ.",
    "checked": "17.11.2026"
  },
  {
    "id": "mki-600",
    "pattern": "МКИ[ -]?600",
    "name": "МКИ-600",
    "file": "manuals/mki-600.pdf",
    "title": "Руководство по эксплуатации · 13 стр.",
    "source": "https://propribory.ru/static/upl/09-10-2018/qzQYrNUtIQjtrM-n/66311r.pdf",
    "author": "Руководство изготовителя; копия ПроПриборы",
    "summary": "Измерение переходного сопротивления контактов и токоведущих соединений. Руководство именно МКИ-600, не МКИ-600М.",
    "checked": "17.11.2026"
  },
  {
    "id": "hva-60",
    "pattern": "HVA[ -]?60",
    "name": "HVA60",
    "file": "manuals/hva-60.pdf",
    "title": "Руководство по эксплуатации · 69 стр.",
    "source": "https://www.brandishire.com.au/wp-content/uploads/2023/07/HVA60-User-manual.pdf",
    "author": "b2 electronic; копия Brandis Hire",
    "summary": "Испытательная система HVA: выбор формы напряжения, последовательности испытаний, контроль разряда и отчёты. Семейное руководство DHV0078 Rev05 на английском; совместимость версии своего HVA60 проверить.",
    "checked": "17.11.2026"
  },
  {
    "id": "svs-100",
    "pattern": "СВС-100",
    "name": "СВС-100",
    "file": "manuals/svs-100.pdf",
    "title": "Руководство по эксплуатации · 23 стр.",
    "source": "https://npp-tp.ru/images/pdf/Molniya/svs100.pdf",
    "author": "Руководство изготовителя; копия Точприбор",
    "summary": "Испытания электрозащитных средств на стационарном стенде. СВС-100 без суффиксов; исполнение вашего стенда и редакцию сверить по шильдику.",
    "checked": "17.11.2026"
  },
  {
    "id": "shin-20",
    "pattern": "ШИН-20",
    "name": "ШИН-20",
    "file": "manuals/shin-20.pdf",
    "title": "Руководство по эксплуатации · 30 стр.",
    "source": "https://opprib.ru/main/ismeritel/pdf/energy/exploitation.pdf",
    "author": "Документ изготовителя; библиотека ОРПРИБ",
    "summary": "Измерение наведённого напряжения и напряжения прикосновения. Состав комплекта и соответствие исполнения штанги проверяются по руководству.",
    "checked": "17.11.2026"
  },
  {
    "id": "retom-30ka",
    "pattern": "РЕТОМ[ -]?30[кК][аАA]",
    "name": "РЕТОМ-30КА",
    "file": "manuals/retom-30ka.pdf",
    "title": "Руководство по эксплуатации · 42 стр.",
    "source": "https://pribor-energy.ru/uploads/documents/rukovodstvo-po-ekspluatacii-retom-30-6029.pdf",
    "author": "НПП Динамика; копия Прибор-Энерго",
    "summary": "Прогрузка первичным током и проверка срабатывания аппаратов. Руководство БРГА.441322.025-01 РЭ; исполнение прибора сверять перед применением.",
    "checked": "17.11.2026"
  }
];
MANUALS.push(...PHOTO_MANUALS.map(({pattern,...manual})=>({...manual,match:new RegExp(pattern,'i')})));
