const sheetGIDs = {
  EgyptCR: '1118150853',
  EgyptTelesales: '672724919',
  IRQCR: '1741671021',
  IRQTelesales: '1989169122',
  GCC: '1211972237'
};

let allData = [];

// Format date for sheet
function formatDateForSheet(dateStr){
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
}

// Load data for selected country
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

        // Populate datalist for Agent IDs
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

// Search function
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

    const exclude=["resigned","dismissed","upl","ksa","gcc","whatsapp","iraq"];
    const shiftTypes=["off","annual","no show","sick","casual"];

    const agentData = allData.filter(d => d.taagerId === agentId);
    if(agentData.length===0){
        document.getElementById('list').innerHTML="No data found for this Agent ID.";
        return;
    }

    const d = agentData[0];
    const counts = {};
    shiftTypes.forEach(s=>counts[s]=0);
    counts.totalDays = 0;

    const details=[];

    Object.keys(d.shiftsPerDate).forEach(dateStr=>{
        const dateObj = new Date(dateStr);
        if(dateObj>=fromDate && dateObj<=toDate){
            let shiftRaw = d.shiftsPerDate[dateStr] || "";
            shiftRaw = shiftRaw.replace(/"/g,'').trim();
            const shift = shiftRaw.toLowerCase();
            if(!shift || exclude.includes(shift)) return;

            counts.totalDays++;
            if(shiftTypes.includes(shift)) counts[shift]++;
            details.push({date:dateStr, shift:shiftRaw});
        }
    });

    let html=`<h3>Agent ID: ${d.taagerId} | Name: ${d.name} | Team Leader: ${d.teamLeader}</h3>`;
    html+=`<p>Total Days in Range: ${counts.totalDays}`;
    shiftTypes.forEach(s=>{
        html+=` | ${s.charAt(0).toUpperCase() + s.slice(1)}: ${counts[s]}`;
    });
    html+=`</p>`;

    html+=`<table><tr><th>Date</th><th>Shift</th></tr>`;
    details.forEach(dt=>{
        html+=`<tr><td>${dt.date}</td><td>${dt.shift}</td></tr>`;
    });
    html+=`</table>`;
    document.getElementById('list').innerHTML=html;
}

// Event listeners
document.getElementById('countrySelect').addEventListener('change', loadData);
document.getElementById('searchBtn').addEventListener('click', searchAgent);

// Initial load
loadData();