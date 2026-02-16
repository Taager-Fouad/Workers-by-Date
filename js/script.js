let allData = [];
let teamLeadersSet = new Set();
const baseUrl = 'https://docs.google.com/spreadsheets/d/1BIiPjpMrcr2JDRz3zUWVcormBui-Ly91slYPAfMnHJY/gviz/tq?tqx=out:csv&gid=';

function formatDateForSheet(dateStr){
  const d = new Date(dateStr);
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
}

function loadData(){
  const gid = document.getElementById('sheetSelect').value;
  const sheetUrl = baseUrl + gid;
  document.getElementById('list').innerHTML = "Loading...";
  teamLeadersSet.clear();
  allData = [];

  fetch(sheetUrl)
    .then(res => res.text())
    .then(csv => {
      const rows = csv.split('\n').map(r => r.split(','));
      const dates = rows[1];
      const today = new Date();
      document.getElementById('dateFilter').value = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;

      for(let i=2;i<rows.length;i++){
        const taagerId = rows[i][2]?.replace(/"/g, '').trim();
        const teamLeaderRaw = rows[i][0]?.replace(/"/g, '').trim();
        const teamLeader = teamLeaderRaw ? teamLeaderRaw : "No TL";
        const name = rows[i][1]?.replace(/"/g, '').trim();
        const shiftsPerDate = {};
        for(let j=5;j<rows[i].length;j++){
          const cellDate = dates[j]?.replace(/"/g, '').trim().replace(/\r|\n/g,'');
          if(cellDate) shiftsPerDate[cellDate] = rows[i][j]?.replace(/"/g, '').trim();
        }
        if(!taagerId || !name) continue;
        allData.push({taagerId, teamLeader, name, shiftsPerDate});
        teamLeadersSet.add(teamLeader);
      }

      const tlSelect = document.getElementById('tlFilter');
      tlSelect.innerHTML = '<option value="all">All</option>';
      Array.from(teamLeadersSet).sort().forEach(tl=>{
        const option = document.createElement('option');
        option.value = tl;
        option.textContent = tl;
        tlSelect.appendChild(option);
      });

      renderTable();
    })
    .catch(err => {
      document.getElementById('list').innerHTML="Error loading data 😔";
      console.error(err);
    });
}

function renderTable(){
  const shiftFilter = document.getElementById('shiftFilter').value;
  const shiftTimeFilter = document.getElementById('shiftTimeFilter').value;
  const tlFilter = document.getElementById('tlFilter').value;
  const dateInput = document.getElementById('dateFilter').value;
  const selectedDate = formatDateForSheet(dateInput);

 const exclude = ["resigned","dismissed","upl","ksa","gcc","whatsapp","tele ksa","tele-sales iraq","tele-sales","tele egy","iraq cr","iraq","eg ts","validation team","#n/a","tele iraq","egy","tele","sus","termination","support","egy cr","irq cr","egy ts","ksa cr","gcc cr","transferred","tls","irq ts","cr irq","wp","ksa ts","romoted"];

  let filtered = allData.map(d=>{
    const shift = (d.shiftsPerDate[selectedDate] || "").replace(/"/g,'').trim();
    return {...d, shift};
  }).filter(d=>{
    if(!d.shift) return false;
    return !exclude.includes(d.shift.toLowerCase().trim());
  });

  const shiftMap = {no_show:"no show", sick:"sick", casual:"casual"};
  if(shiftFilter==="shift"){
    filtered = filtered.filter(d=>{
      const shiftVal=d.shift.toLowerCase().trim();
      return !["off","annual",...exclude,"no show","sick","casual"].includes(shiftVal);
    });
    if(shiftTimeFilter!=="all"){
      filtered = filtered.filter(d => d.shift.includes(shiftTimeFilter));
    }
  } else if(["off","annual","no_show","sick","casual"].includes(shiftFilter)){
    const target = shiftMap[shiftFilter] || shiftFilter;
    filtered = filtered.filter(d => d.shift.toLowerCase().trim() === target);
  }

  if(tlFilter!=="all"){
    filtered = filtered.filter(d => d.teamLeader.trim().toLowerCase() === tlFilter.trim().toLowerCase());
  }

  document.getElementById('countDisplay').textContent = `Total: ${filtered.length}`;
  let result = "<table id='tableData'><tr><th>Taager ID</th><th>Team Leader</th><th>Name</th><th>Shift</th></tr>";
  filtered.forEach(d=>{
    // اضف attribute للصف عشان نقدر نفتح المودال عند الضغط
    result += `<tr data-taager="${d.taagerId}"><td>${d.taagerId}</td><td>${d.teamLeader}</td><td>${d.name}</td><td>${d.shift}</td></tr>`;
  });
  result += "</table>";
  document.getElementById('list').innerHTML = result || "🎉 No workers to show.";

  // بعد بناء الجدول، أضف listeners للصفوف
  const rows = document.querySelectorAll("#tableData tr[data-taager]");
  rows.forEach(row=>{
    row.removeEventListener('click', onRowClick); // تأكد ما فيش مكرر
    row.addEventListener('click', onRowClick);
  });
}

function onRowClick(e){
  const tr = e.currentTarget;
  const taagerId = tr.getAttribute('data-taager');
  const dateInput = document.getElementById('dateFilter').value;
  if(!taagerId) return;
  openModalForAgent(taagerId, dateInput);
}

// helper: get week start (Sunday) and end (Saturday) for a given date (YYYY-MM-DD input)
function getWeekRangeFromISO(isoDate){
  // isoDate: "YYYY-MM-DD"
  const d = new Date(isoDate + "T00:00:00");
  // getDay: 0 = Sunday, 6 = Saturday
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day); // go back to sunday
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { start: sunday, end: saturday };
}

// format date to sheet key (M/D/YYYY) same as formatDateForSheet but using Date obj
function formatDateForSheetFromDateObj(dateObj){
  return `${dateObj.getMonth()+1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
}

// get readable day name and formatted date
function dayLabel(dateObj){
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const formatted = `${(dateObj.getMonth()+1).toString().padStart(2,'0')}/${dateObj.getDate().toString().padStart(2,'0')}/${dateObj.getFullYear()}`;
  return { dayName, formatted };
}

// open modal for agent showing week schedule (Sunday->Saturday) based on selected date
function openModalForAgent(taagerId, isoDate){
  const agent = allData.find(a => a.taagerId === taagerId);
  if(!agent) return alert("Agent data not found.");

  const { start, end } = getWeekRangeFromISO(isoDate);
  // build week array
  const week = [];
  for(let dt = new Date(start); dt <= end; dt.setDate(dt.getDate()+1)){
    // clone date
    week.push(new Date(dt));
  }

  // build modal HTML
  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = ''; // clear previous
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  // Header + controls
  const headerRow = document.createElement('div');
  headerRow.className = 'modal-row';
  const title = document.createElement('h3');
  title.textContent = `Agent: ${agent.taagerId} — ${agent.name}`;
  headerRow.appendChild(title);

  // زر Download داخل المودال (يعمل screenshot للمودال)
  const modalCaptureBtn = document.createElement('button');
  modalCaptureBtn.className = 'modal-capture-btn';
  modalCaptureBtn.innerText = 'Download';
  modalCaptureBtn.title = 'Download modal screenshot';
  headerRow.appendChild(modalCaptureBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerText = 'Close';
  closeBtn.onclick = () => { modalRoot.innerHTML = ''; };
  headerRow.appendChild(closeBtn);
  modal.appendChild(headerRow);

  // Agent info
  const info = document.createElement('div');
  info.className = 'modal-row';
  info.innerHTML = `<div><strong>Team Leader:</strong> ${agent.teamLeader}</div><div><strong>Week:</strong> ${formatShort(start)} — ${formatShort(end)}</div>`;
  modal.appendChild(info);

  // Table of week
  const tbl = document.createElement('table');
  tbl.className = 'week-table';
  let thead = `<tr><th>Day</th><th>Date</th><th>Shift</th></tr>`;
  let tbody = '';
  week.forEach(d => {
    const key = formatDateForSheetFromDateObj(d); // matches keys in shiftsPerDate
    let raw = agent.shiftsPerDate[key] || '';
    raw = raw.replace(/"/g,'').trim();
    const { dayName } = dayLabel(d);
    tbody += `<tr><td>${dayName}</td><td>${key}</td><td>${raw || '-'}</td></tr>`;
  });
  tbl.innerHTML = thead + tbody;
  modal.appendChild(tbl);

  // append and show
  overlay.appendChild(modal);
  modalRoot.appendChild(overlay);

  // === Updated modal screenshot handler: clone modal, hide modal buttons in clone, capture clone ===
  modalCaptureBtn.addEventListener('click', async () => {
    try {
      const clone = modal.cloneNode(true);

      // hide any buttons we don't want to appear in the screenshot (inside the clone)
      const btnsToHide = clone.querySelectorAll('.modal-capture-btn, .close-btn');
      btnsToHide.forEach(b => b.style.display = 'none');

      // place clone off-screen to render it with same styles
      clone.style.position = "fixed";
      clone.style.top = "-9999px";
      clone.style.left = "0";
      // ensure clone background matches original modal background
      clone.style.background = window.getComputedStyle(modal).background || "#0f172a";

      document.body.appendChild(clone);

      await html2canvas(clone, {
        backgroundColor: "#0f172a",
        scale: Math.min(2, window.devicePixelRatio || 2),
        useCORS: true
      }).then(canvas => {
        const link = document.createElement("a");
        link.download = `${agent.taagerId}_modal.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      });

      document.body.removeChild(clone);
    } catch(err){
      console.error(err);
      alert("Modal capture failed.");
    }
  });

  // close on overlay click outside modal
  overlay.addEventListener('click', (ev)=>{
    if(ev.target === overlay) modalRoot.innerHTML = '';
  });

  // close on ESC
  function escHandler(ev){
    if(ev.key === 'Escape') modalRoot.innerHTML = '';
    document.removeEventListener('keydown', escHandler);
  }
  document.addEventListener('keydown', escHandler);
}

function formatShort(dateObj){
  return `${(dateObj.getMonth()+1).toString().padStart(2,'0')}/${dateObj.getDate().toString().padStart(2,'0')}/${dateObj.getFullYear()}`;
}

// Screenshot كامل الجدول + لون مظبوط
document.getElementById("captureBtn").addEventListener("click", async () => {
  const tableArea = document.querySelector("#list");
  if(!tableArea) return alert("No table to capture.");
  const scrollHeight = tableArea.scrollHeight;
  const scrollWidth = tableArea.scrollWidth;

  // clone to preserve inline background + ensure full width
  const clone = tableArea.cloneNode(true);
  clone.style.width = scrollWidth + "px";
  clone.style.backgroundColor = "#0f172a";
  clone.style.position = "fixed";
  clone.style.top = "-9999px";
  document.body.appendChild(clone);

  await html2canvas(clone, {
    backgroundColor: "#0f172a",
    scale: Math.min(2, window.devicePixelRatio || 2),
    useCORS: true,
    width: scrollWidth,
    height: scrollHeight
  }).then(canvas => {
    const link = document.createElement("a");
    link.download = "table-screenshot.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }).catch(err=>{
    console.error(err);
    alert("Capture failed.");
  });

  document.body.removeChild(clone);
});

// Excel
document.getElementById("excelBtn").addEventListener("click", () => {
  const table = document.querySelector("#tableData");
  if(!table){
    alert("No data to export!");
    return;
  }
  const wb = XLSX.utils.table_to_book(table, {sheet:"Shifts"});
  XLSX.writeFile(wb, "shift_table.xlsx");
});

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById('shiftTimeFilter').style.display = "inline-block";
});

document.getElementById('shiftFilter').addEventListener('change', e=>{
  const isShift = e.target.value === "shift";
  document.getElementById('shiftTimeFilter').style.display = isShift ? "inline-block" : "none";
  renderTable();
});
document.getElementById('searchBtn').addEventListener('click', renderTable);
document.getElementById('tlFilter').addEventListener('change', renderTable);
document.getElementById('shiftTimeFilter').addEventListener('change', renderTable);
document.getElementById('sheetSelect').addEventListener('change', loadData);

loadData();
