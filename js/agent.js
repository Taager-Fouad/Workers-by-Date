const sheetGIDs = {
  EgyptCR: '1118150853',
  EgyptTelesales: '672724919',
  IRQCR: '1741671021',
  IRQTelesales: '1989169122',
  GCC: '1211972237'
};

let allData = [];
let chartInstance = null;

function loadData(){
  const country = document.getElementById('countrySelect').value;
  const gid = sheetGIDs[country];
  const sheetUrl = `https://docs.google.com/spreadsheets/d/1hKdD1mH-6_FM35YRqrxfeaLoqn2fmlyKjxJ-TsvwDyY/gviz/tq?tqx=out:csv&gid=${gid}`;
  document.getElementById('list').innerHTML = "Loading data...";
  allData = [];
  const agentIdsSet = new Set();

  fetch(sheetUrl)
  .then(res => res.text())
  .then(csv => {
    const rows = csv.split('\n').map(r=>r.split(','));
    const dates = rows[1];
    for(let i=2;i<rows.length;i++){
      const taagerId = rows[i][0]?.trim();
      const teamLeader = rows[i][1]?.trim() || "No TL";
      const name = rows[i][2]?.trim();
      if(!taagerId || !name) continue;
      const shiftsPerDate = {};
      for(let j=5;j<rows[i].length;j++){
        const cellDate = dates[j]?.trim().replace(/\r|\n|"/g,'');
        if(cellDate) shiftsPerDate[cellDate] = rows[i][j]?.trim();
      }
      allData.push({taagerId, teamLeader, name, shiftsPerDate});
      agentIdsSet.add(taagerId);
    }
    const datalist = document.getElementById('agentIds');
    datalist.innerHTML = '';
    Array.from(agentIdsSet).sort().forEach(id=>{
      const opt = document.createElement('option');
      opt.value = id;
      datalist.appendChild(opt);
    });
    document.getElementById('list').innerHTML = "Data loaded. Select Agent ID and date range.";
  })
  .catch(err=>{
    document.getElementById('list').innerHTML="Error loading data 😔";
    console.error(err);
  });
}

function getDayName(dateStr){
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long' }); // Full day name
}

function searchAgent(){
  const agentId = document.getElementById('agentIdSelect').value.trim();
  const fromDateInput = document.getElementById('fromDate').value;
  const toDateInput = document.getElementById('toDate').value;

  if(!agentId || !fromDateInput || !toDateInput){
    alert("Please enter Agent ID and date range.");
    return;
  }

  const fromDate = new Date(fromDateInput);
  const toDate = new Date(toDateInput);
  toDate.setHours(23,59,59,999);

  const exclude=["resigned","dismissed","upl","ksa","gcc","whatsapp","tele ksa","tele-sales iraq","tele-sales"];
  const shiftTypes=["off","annual","no show","sick","casual"];

  const agentData = allData.filter(d => d.taagerId === agentId);
  if(agentData.length===0){
    document.getElementById('list').innerHTML="No data found for this Agent ID.";
    document.querySelector(".chart-container").style.display="none";
    document.getElementById("percentInfo").style.display="none";
    return;
  }

  const d = agentData[0];
  const counts = {};
  shiftTypes.forEach(s=>counts[s]=0);
  counts.totalDays = 0;

  const details=[];
  Object.keys(d.shiftsPerDate).forEach(dateStr=>{
    const dateObj = new Date(dateStr);
    if(dateObj >= fromDate && dateObj <= toDate){
      let shiftRaw = d.shiftsPerDate[dateStr] || "";
      shiftRaw = shiftRaw.replace(/"/g,'').trim();
      const shift = shiftRaw.toLowerCase();
      if(!shift || exclude.includes(shift)) return;
      counts.totalDays++;
      if(shiftTypes.includes(shift)) counts[shift]++;
      const dayName = getDayName(dateStr);
      details.push({day: dayName, date: dateStr, shift: shiftRaw});
    }
  });

  let html = `
    <div>
      <h3 style="color:#00c8ff;">Agent ID: ${d.taagerId}</h3>
      <p>Name: ${d.name} | Team Leader: ${d.teamLeader}</p>
      <p>
        Total Days: ${counts.totalDays}
        ${counts.off ? ` | Off: ${counts.off}` : ""}
        ${counts.annual ? ` | Annual: ${counts.annual}` : ""}
        ${counts["sick"] ? ` | Sick: ${counts["sick"]}` : ""}
        ${counts["no show"] ? ` | No Show: ${counts["no show"]}` : ""}
        ${counts.casual ? ` | Casual: ${counts.casual}` : ""}
      </p>
    </div>`;

  html+=`<table><tr><th>Day</th><th>Date</th><th>Shift</th></tr>`;
  details.forEach(dt=>{
    html+=`<tr><td>${dt.day}</td><td>${dt.date}</td><td>${dt.shift}</td></tr>`;
  });
  html+=`</table>`;
  document.getElementById('list').innerHTML=html;

  const filteredShiftTypes = shiftTypes.filter(s => counts[s] > 0);
  const chartData = filteredShiftTypes.map(s=>counts[s]);
  const chartLabels = filteredShiftTypes.map(s=>s.charAt(0).toUpperCase() + s.slice(1));
  
  // neon glow chart colors
  const chartColors = [
    'rgba(0,200,255,0.9)',
    'rgba(255,193,7,0.9)',
    'rgba(255,77,77,0.9)',
    'rgba(0,255,153,0.9)',
    'rgba(179,102,255,0.9)'
  ];

  document.querySelector(".chart-container").style.display = filteredShiftTypes.length ? "flex" : "none";

  if(chartInstance) chartInstance.destroy();

  if(filteredShiftTypes.length){
    const ctx = document.getElementById('shiftChart').getContext('2d');
    const neonGlow = ctx.createRadialGradient(150,150,50,150,150,300);
    neonGlow.addColorStop(0, '#00c8ff22');
    neonGlow.addColorStop(1, '#00c8ff00');

    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: chartLabels,
        datasets: [{
          data: chartData,
          backgroundColor: chartColors,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 2,
          hoverOffset: 18,
          shadowOffsetX: 2,
          shadowOffsetY: 2,
          shadowBlur: 15,
          shadowColor: 'rgba(0,200,255,0.5)'
        }]
      },
      options: {
        cutout: '65%',
        plugins: {
          legend: { labels: { color: '#00c8ff', font: { size: 14, weight: 'bold' } } },
          datalabels: {
            color: '#fff',
            formatter: (value, ctx) => {
              const total = ctx.chart._metasets[0].total;
              const percent = total ? ((value / total) * 100).toFixed(1) + '%' : '0%';
              return percent;
            },
            font: { weight: 'bold', size: 14 },
            textShadowColor: '#000',
            textShadowBlur: 10
          }
        },
        animation: {
          animateScale: true,
          animateRotate: true
        }
      },
      plugins: [ChartDataLabels]
    });
  }

  const percentDiv = document.getElementById("percentInfo");
  percentDiv.innerHTML = "";
  if(filteredShiftTypes.length){
    percentDiv.style.display = "flex";
    filteredShiftTypes.forEach((s,i)=>{
      const val = counts[s];
      const percent = counts.totalDays ? ((val / counts.totalDays) * 100).toFixed(1) : 0;
      const box = document.createElement("div");
      box.className = "percent-box";
      box.style.color = chartColors[i];
      box.style.textShadow = `0 0 10px ${chartColors[i]}`;
      box.innerHTML = `${s.charAt(0).toUpperCase() + s.slice(1)}: ${percent}%`;
      percentDiv.appendChild(box);
    });
  } else {
    percentDiv.style.display = "none";
  }
}

document.getElementById('countrySelect').addEventListener('change', loadData);
document.getElementById('searchBtn').addEventListener('click', searchAgent);
loadData();
