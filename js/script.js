let allData = [];
let teamLeadersSet = new Set();
const baseUrl = 'https://docs.google.com/spreadsheets/d/1hKdD1mH-6_FM35YRqrxfeaLoqn2fmlyKjxJ-TsvwDyY/gviz/tq?tqx=out:csv&gid=';

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
        const taagerId = rows[i][0]?.replace(/"/g, '').trim();
        const teamLeaderRaw = rows[i][1]?.replace(/"/g, '').trim();
        const teamLeader = teamLeaderRaw ? teamLeaderRaw : "No TL";
        const name = rows[i][2]?.replace(/"/g, '').trim();
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

  const exclude = ["resigned","dismissed","upl","ksa","gcc","whatsapp","tele ksa","tele-sales iraq","tele-sales","tele egy","iraq cr","iraq"];

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
    result += `<tr><td>${d.taagerId}</td><td>${d.teamLeader}</td><td>${d.name}</td><td>${d.shift}</td></tr>`;
  });
  result += "</table>";
  document.getElementById('list').innerHTML = result || "🎉 No workers to show.";
}

// Screenshot كامل الجدول + لون مظبوط
document.getElementById("captureBtn").addEventListener("click", async () => {
  const tableArea = document.querySelector("#list");
  const scrollHeight = tableArea.scrollHeight;
  const scrollWidth = tableArea.scrollWidth;

  const clone = tableArea.cloneNode(true);
  clone.style.width = scrollWidth + "px";
  clone.style.backgroundColor = "#0f172a";
  document.body.appendChild(clone);

  await html2canvas(clone, {
    backgroundColor: "#0f172a",
    scale: 2,
    useCORS: true,
    width: scrollWidth,
    height: scrollHeight
  }).then(canvas => {
    const link = document.createElement("a");
    link.download = "table-screenshot.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
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
