'use strict';

// PDF is built locally. No measurements or photographs are sent to a PDF service.
let pdfFontBytes;
const pdfSafeName = s => String(s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60);
async function buildProtocolPDF(t) {
  if (!globalThis.PDFLib || !globalThis.fontkit) throw new Error('Не загрузились средства создания PDF. Обновите приложение при наличии сети.');
  if (!pdfFontBytes) {
    const res = await fetch('vendor/NotoSans-Regular.ttf');
    if (!res.ok) throw new Error('Не загружен шрифт PDF. Откройте приложение при наличии сети.');
    pdfFontBytes = await res.arrayBuffer();
  }
  await loadPaperDevices();
  const pdf = await PDFLib.PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(pdfFontBytes, { subset: true });
  pdf.setTitle(`ПСГИ - заявка ${t.number} - ${t.object}`);
  pdf.setCreator('ПСГИ');
  const ink = PDFLib.rgb(.1, .16, .22), muted = PDFLib.rgb(.38, .42, .47);
  let page, y, pages = [];
  const margin = 40, width = 515;
  const clean = s => String(s ?? '').replace(/\r/g, '').replace(/≥/g, 'не менее ').replace(/≤/g, 'не более ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, '');
  const newPage = () => { page = pdf.addPage([595.28, 841.89]); pages.push(page); y = 796; };
  const ensure = height => { if (!page || y - height < 48) newPage(); };
  const split = (text, size, available) => {
    const lines = [];
    for (const paragraph of clean(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        if (font.widthOfTextAtSize(line + (line ? ' ' : '') + word, size) <= available) { line += (line ? ' ' : '') + word; continue; }
        if (line) { lines.push(line); line = ''; }
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > available && line) { lines.push(line); line = ''; }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const write = (text, { size = 10, color = ink, indent = 0, gap = 4 } = {}) => {
    for (const line of split(text, size, width - indent)) {
      ensure(size * 1.5 + gap);
      page.drawText(line, { x: margin + indent, y, size, font, color });
      y -= size * 1.5;
    }
    y -= gap;
  };
  const heading = title => { ensure(46); y -= 9; write(title, { size: 12, gap: 7 }); };
  const row = (label, value) => {
    if (value === '' || value == null) return;
    write(`${label}: ${value}`, { size: 9.5, indent: 6, gap: 3 });
  };
  const b = blank();
  newPage();
  if (t.outcome === 'notdone') {
    write('ПСГИ', { size: 19 });
    heading(`Заявка ${t.number}: работа не выполнялась`);
    row('Объект', t.object); row('Дата', fmtDate(t.date)); row('Причина', t.reason);
  } else for (const [index, it] of t.items.entries()) {
    if (it.skip) continue;
    if (index && y < 760) newPage();
    const wt = WORK_TYPES[it.type], v = it.values, result = wt.check(v);
    write(b.org || 'ПСГИ', { size: 14 });
    if (b.lab) write(b.lab, { size: 10 });
    heading(`ПРОТОКОЛ № ${v.proto_no || 'не зарегистрирован'}`);
    write(wt.title || typeName(it.type), { size: 12 });
    row('Дата испытаний', fmtDate(v.proto_date || t.date));
    row('Заявка', t.number); row('Объект', t.object); row('Адрес', t.address);
    row('Оборудование', t.equipment); row('Наряд-допуск / распоряжение', permitOf(t));
    row('Место испытаний', v.place || t.address || t.object);
    row('Вид испытаний', v.mode ? optText({ options: MODES }, v.mode) : 'не указан');
    row('Климатические условия', [v.temp_air !== '' && v.temp_air != null ? `${v.temp_air} °C` : '', v.humidity ? `${v.humidity} %` : '', v.pressure ? `${v.pressure} мм рт. ст.` : ''].filter(Boolean).join('; '));
    row('Методика', b.methods?.[wt.code] || 'не указана');
    row('Утверждение методики', b.approved);
    if (b.p2) write(b.p2, { size: 8, color: muted });
    if (b.p3) write(b.p3, { size: 8, color: muted });
    if (b.p7) write(b.p7, { size: 8, color: muted });
    for (const sec of wt.form.filter(s => secVisible(s, v) && s !== wt.form[0])) {
      const entries = [];
      for (const f of expand(sec.fields, v)) {
        if (f.type === 'location' && v.latitude && v.longitude) entries.push(['Координаты',`${v.latitude}, ${v.longitude}`]);
        if (f.type === 'checklist' || f.type === 'table') {
          for (const [label, value] of listRows(f, v, result)) entries.push([label, value]);
        } else if (f.type === 'calc') {
          if (result[f.id]?.value != null) entries.push([f.label, result[f.id].value]);
        } else for (const x of f.type === 'row' ? rowChildren(f) : [f]) {
          if (x.id && String(v[x.id] ?? '').trim()) entries.push([x.label, measurementText(x, v)]);
        }
      }
      if (!entries.length) continue;
      heading(sec.title);
      if (sec.ref) {
        write(`ПУЭ п. ${wt.code}, пункт ${sec.ref}${v.mode === 'M' ? '; нормы РД 34.45-51.300-97' : ''}`, { size: 8, color: muted });
        write(normText(sec, v, result) || 'Норма - по методике и паспорту оборудования', { size: 8, color: muted });
      }
      for (const [label, value] of entries) row(label, value);
    }
    heading('Средства измерений и испытательное оборудование');
    for (const selected of rowsOf(v, 'devices')) {
      const device = paperDevices.find(d => devLabel(d) === selected.name);
      write(selected.name, { size: 10 });
      if (device) {
        row('Диапазон / точность', [device.range, device.acc].filter(Boolean).join('; '));
        row('Поверка', [device.cert, device.date && fmtDate(device.date), device.next && 'до ' + fmtDate(device.next)].filter(Boolean).join('; '));
      }
    }
    if (!rowsOf(v, 'devices').length) write('Приборы не указаны', { color: muted });
    const reasons = reasonsOf(wt, v, result);
    if (reasons.length) { heading('Выявленные несоответствия'); for (const reason of reasons) write(`${reason.what}. ${reason.ref}. ${reason.need || ''}`); }
    heading('Испытания проводили');
    for (const name of crewNames(t)) row(staffPos(name) || 'Электромонтёр', name + '     Подпись: ______________');
    row('Протокол проверил', [b.checkerPos, b.checker].filter(Boolean).join(' ') + '     Подпись: ______________');
    for (const [photoIndex, src] of (it.photos || []).entries()) {
      try {
        const img = /^data:image\/png/.test(src) ? await pdf.embedPng(src) : await pdf.embedJpg(src);
        const scale = Math.min(1, width / img.width, 510 / img.height), height = img.height * scale;
        ensure(height + 35); write(`Фото ${photoIndex + 1}`, { size: 9 });
        page.drawImage(img, { x: margin, y: y - height, width: img.width * scale, height }); y -= height + 18;
      } catch (error) { throw new Error(`Не удалось включить фото ${photoIndex + 1} в PDF. Проверьте изображение.`); }
    }
  }
  if (t.outcome !== 'notdone' && t.items.every(i => i.skip)) write('Испытания не проводились.');
  pages.forEach((p, i) => p.drawText(`ПСГИ | Заявка ${clean(t.number)} | Лист ${i + 1} из ${pages.length}`, { x: margin, y: 26, size: 8, font, color: muted }));
  return new File([await pdf.save()], `ПСГИ_${pdfSafeName(t.number)}_${pdfSafeName(t.object)}.pdf`, { type: 'application/pdf' });
}

function downloadFile(file) {
  const url = URL.createObjectURL(file), a = document.createElement('a');
  a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// A second tap keeps the browser's user activation for the native share sheet.
async function shareProtocol(t) {
  const modal = document.createElement('dialog'); modal.className = 'psgi-dialog';
  modal.innerHTML = '<h2>Протокол в PDF</h2><p data-progress role="status">Подготавливаем файл с измерениями и фотографиями…</p><div data-pdf-actions></div><button class="btn ghost mt" data-close>Закрыть</button>';
  document.body.append(modal); modal.showModal();
  let url;
  modal.querySelector('[data-close]').onclick = () => modal.close();
  modal.onclose = () => { if (url) URL.revokeObjectURL(url); modal.remove(); };
  try {
    const file = await buildProtocolPDF(t);
    if (!modal.isConnected) return;
    url = URL.createObjectURL(file);
    modal.querySelector('[data-progress]').textContent = `Готов файл ${file.name}. Формат PDF, ${Math.ceil(file.size / 1024)} КБ.`;
    const canShareFile = !!navigator.share && !!navigator.canShare?.({ files: [file] });
    modal.querySelector('[data-pdf-actions]').innerHTML = `${canShareFile ? '<button class="btn accent" data-send-pdf>Отправить PDF в мессенджер</button>' : '<p class="hint">В этом браузере отправка файлов через системное меню недоступна. Скачайте PDF и прикрепите его в мессенджере.</p>'}<a class="btn ghost mt" data-download>Скачать PDF</a><button class="btn ghost mt" data-confirm-send>PDF уже передан — отметить</button>`;
    const a = modal.querySelector('[data-download]'); a.href = url; a.download = file.name;
    const markSent = async () => {
      const current = await dbGet(t.id);
      if (!current) return;
      if (registrationNumbers(current) !== registrationNumbers(t)) { toast('Номера изменились. Создайте PDF заново.'); return; }
      current.registrationShared = registrationNumbers(t); current.registrationSharedAt = Date.now();
      await dbPut(current); toast('Передача PDF отмечена'); modal.close(); router();
    };
    modal.querySelector('[data-confirm-send]').onclick = () => { if (confirm('Подтвердить, что PDF с текущими номерами протоколов передан получателю?')) markSent(); };
    const send = modal.querySelector('[data-send-pdf]');
    if (send) send.onclick = async () => {
      try { await navigator.share({ files: [file], title: `ПСГИ: заявка ${t.number}` }); await markSent(); }
      catch (error) { if (error.name !== 'AbortError') { modal.querySelector('[data-progress]').textContent = 'Передать файл не удалось. Скачайте PDF и прикрепите его вручную.'; } }
    };
  } catch (error) { if (modal.isConnected) modal.querySelector('[data-progress]').textContent = error.message || 'Не удалось создать PDF'; }
}
