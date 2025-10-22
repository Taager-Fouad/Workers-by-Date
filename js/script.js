const sheetUrl = 'https://docs.google.com/spreadsheets/d/1hKdD1mH-6_FM35YRqrxfeaLoqn2fmlyKjxJ-TsvwDyY/gviz/tq?tqx=out:csv&gid=1118150853';
let allData = [];
let teamLeadersSet = new Set();

function formatDateForSheet(dateStr){
    const d = new Date(dateStr);
    const month = d.getMonth()+1;
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
}

fetch(sheetUrl)
.then(res=>res.text())
.then(csv=>{
    const rows=csv.split('\n').map(r=>r.split(','));
    const dates=rows[1];

    const today=new Date();
    document.getElementById('dateFilter').value=`${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;

    allData=[];
    for(let i=2;i<rows.length;i++){
        const taagerId=rows[i][0]?.trim();
        const teamLeaderRaw=rows[i][1]?.trim();
        const teamLeader=teamLeaderRaw ? teamLeaderRaw : "No TL";
        const name=rows[i][2]?.trim();

        const shiftsPerDate={};
        for(let j=5;j<rows[i].length;j++){
            const cellDate=dates[j]?.trim().replace(/\r|\n|"/g,'');
            if(cellDate) shiftsPerDate[cellDate]=rows[i][j]?.trim();
        }

        if(!taagerId || !name) continue;
        allData.push({taagerId, teamLeader, name, shiftsPerDate});
        teamLeadersSet.add(teamLeader);
    }

    allData.sort((a,b)=>a.taagerId.localeCompare(b.taagerId));

    const tlSelect=document.getElementById('tlFilter');
    Array.from(teamLeadersSet).sort().forEach(tl=>{
        const option=document.createElement('option');
        option.value=tl; option.textContent=tl; tlSelect.appendChild(option);
    });

    renderTable();
})
.catch(err=>{document.getElementById('list').innerHTML="Error loading data 😔"; console.error(err);});

function renderTable(){
    const shiftFilter=document.getElementById('shiftFilter').value;
    const tlFilter=document.getElementById('tlFilter').value;
    const dateInput=document.getElementById('dateFilter').value;
    const selectedDate=formatDateForSheet(dateInput);

    const exclude=["resigned","dismissed","upl","ksa","gcc","whatsapp","iraq"];

    let filtered = allData.map(d=>{
        const shift=(d.shiftsPerDate[selectedDate] || "").replace(/"/g,'').trim();
        return {...d, shift};
    })
    .filter(d=>{
        if(!d.shift) return false;
        const shiftVal=d.shift.toLowerCase();
        return !exclude.includes(shiftVal);
    });

    // Shift Filter
    const shiftMap = {no_show:"no show", sick:"sick", casual:"casual"};
    if(shiftFilter==="shift"){
        filtered = filtered.filter(d=>{
            const shiftVal=d.shift.toLowerCase();
            return !["off","annual",...exclude,"no show","sick","casual"].includes(shiftVal);
        });
    } else if(["off","annual","no_show","sick","casual"].includes(shiftFilter)){
        const target = shiftMap[shiftFilter] || shiftFilter;
        filtered = filtered.filter(d => d.shift.toLowerCase() === target);
    }

    // Team Leader Filter
    if(tlFilter!=="all"){
        filtered = filtered.filter(d=>d.teamLeader.trim().toLowerCase()===tlFilter.trim().toLowerCase());
    }

    document.getElementById('countDisplay').textContent=`Total: ${filtered.length}`;

    let result="<table><tr><th>Taager ID</th><th>Team Leader</th><th>Name</th><th>Shift</th></tr>";
    filtered.forEach(d=>{
        result+=`<tr><td>${d.taagerId}</td><td>${d.teamLeader}</td><td>${d.name}</td><td>${d.shift}</td></tr>`;
    });
    result+="</table>";

    document.getElementById('list').innerHTML=result||"🎉 No workers to show.";
}

document.getElementById('shiftFilter').addEventListener('change', renderTable);
document.getElementById('tlFilter').addEventListener('change', renderTable);
document.getElementById('searchBtn').addEventListener('click', renderTable);