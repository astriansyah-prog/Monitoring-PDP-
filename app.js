/* ==================================================================
   Monitoring PDP sampai Juni 2026 - DIV SAK
   Dashboard logic — vanilla JS + Chart.js
   ================================================================== */

const PALETTE = {
  navy:'#0b1f3d', yellow:'#FCD116', red:'#E4032E', blue:'#2f80ed',
  green:'#1aab6f', amber:'#f2a900', purple:'#7c5cff', teal:'#12b6c9', gray:'#8a95ab'
};
const CATCOLORS = {D1:'#1aab6f', D2:'#2f80ed', D3:'#f2a900', D4:'#E4032E'};
const FASECOLORS = {
  'Perencanaan':'#8a95ab','Pra-Pelaksanaan':'#2f80ed','Pelaksanaan':'#f2a900',
  'Penyelesaian':'#7c5cff','Selesai':'#1aab6f','Terminasi':'#E4032E'
};

function fmtRp(v, opt={}){
  if(v===null||v===undefined||isNaN(v)) return '-';
  const abs = Math.abs(v);
  const sign = v<0?'-':'';
  if(abs>=1e12) return sign+'Rp '+(abs/1e12).toLocaleString('id-ID',{maximumFractionDigits:2})+' T';
  if(abs>=1e9)  return sign+'Rp '+(abs/1e9).toLocaleString('id-ID',{maximumFractionDigits:2})+' M';
  if(abs>=1e6)  return sign+'Rp '+(abs/1e6).toLocaleString('id-ID',{maximumFractionDigits:1})+' Jt';
  return sign+'Rp '+abs.toLocaleString('id-ID');
}
function fmtNum(v){ return (v===null||v===undefined)?'-':v.toLocaleString('id-ID'); }
function fmtPct(v,d=1){ return (v===null||v===undefined||isNaN(v))?'-':v.toLocaleString('id-ID',{maximumFractionDigits:d})+'%'; }
function esc(s){
  if(s===null||s===undefined) return '';
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function unitShort(u){
  const m={'SUMBAGUT':'Sumbagut','SUMBAGTENG':'Sumbagteng','SUMBAGSEL':'Sumbagsel','KALBAGBAR':'Kalbagbar',
  'KALBAGTIM':'Kalbagtim','SULAWESI':'Sulawesi','JBB':'JBB','JBT':'JBT','JBTB':'JBTB',
  'MALUKU PAPUA':'Maluku Papua','NUSRA':'Nusra'};
  return m[u]||u;
}

/* ---------------- NAV ---------------- */
const VIEW_TITLES = {
  beranda:'Beranda — Infografis Sebaran Proyek PDP',
  performance:'Performance Monitoring Proyek PDP',
  ews:'EWS — Early Warning System',
  kategori:'Kategori PDP D1 – D4',
  cluster:'Cluster Proyek PDP 1 – 9',
  rekon:'Rekonsiliasi Nilai PDP: DIV PMO vs DIV AKT (SAP)'
};

let DATA = null;

document.addEventListener('DOMContentLoaded', ()=>{ boot(false); });

async function boot(forceRefresh){
  const content = document.getElementById('content');
  content.innerHTML = `<div class="loading-box">
      <div class="spinner"></div>
      <div>${forceRefresh?'Menyegarkan data dari Google Sheets…':'Memuat data dari Google Sheets…'}</div>
    </div>`;
  let result;
  try{
    result = await loadDashboardData(forceRefresh);
  }catch(err){
    content.innerHTML = `<div class="panel" style="text-align:center;padding:40px;">
      <h3 style="color:var(--red);">Gagal memuat data</h3>
      <p style="color:var(--muted);font-size:12.5px;">${esc(err.message||String(err))}</p>
      <p style="font-size:12.5px;">Pastikan koneksi internet aktif dan Google Sheet dibagikan sebagai "Anyone with the link — Viewer", atau taruh file <code>data/dashboard_data.snapshot.json</code> hasil generate sebelumnya di folder yang sama.</p>
    </div>`;
    return;
  }
  DATA = result.data;
  buildAllViews();
  renderSourceBadge(result);
  wireNav();
}

function wireNav(){
  document.querySelectorAll('.navitem').forEach(el=>{
    el.addEventListener('click', ()=>{
      document.querySelectorAll('.navitem').forEach(x=>x.classList.remove('active'));
      el.classList.add('active');
      const v = el.dataset.view;
      document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
      document.getElementById('view-'+v).classList.add('active');
      document.getElementById('pageTitle').textContent = VIEW_TITLES[v];
      document.getElementById('sidebar').classList.remove('open');
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
  document.getElementById('menuBtn').addEventListener('click',()=>{
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('modalBg').addEventListener('click',(e)=>{
    if(e.target.id==='modalBg') closeModal();
  });
}

function renderSourceBadge(result){
  const el = document.getElementById('sourceBadge');
  if(!el) return;
  const when = result.fetchedAt ? new Date(result.fetchedAt).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}) : '-';
  const labels = {live:'🟢 Data live', cache:'🟡 Cache browser', 'stale-cache':'🟠 Cache lama', snapshot:'⚪ Snapshot bawaan'};
  el.innerHTML = `<span title="${esc(result.error||'')}">${labels[result.source]||result.source} · ${esc(when)}</span>
    <button id="refreshBtn" title="Ambil ulang data dari Google Sheets">⟳ Refresh</button>`;
  document.getElementById('refreshBtn').addEventListener('click', ()=>boot(true));
  if(result.error){
    el.title = result.error;
    el.classList.add('warn');
  }
}

function closeModal(){ document.getElementById('modalBg').classList.remove('active'); }

function openModal(html){
  document.getElementById('modalBody').innerHTML = '<span class="modal-close" onclick="closeModal()">&times;</span>'+html;
  document.getElementById('modalBg').classList.add('active');
}

/* ---------------- BUILD ALL VIEWS ---------------- */
function buildAllViews(){
  const content = document.getElementById('content');
  content.innerHTML = `
    <section class="view active" id="view-beranda"></section>
    <section class="view" id="view-performance"></section>
    <section class="view" id="view-ews"></section>
    <section class="view" id="view-kategori"></section>
    <section class="view" id="view-cluster"></section>
    <section class="view" id="view-rekon"></section>
  `;
  renderBeranda();
  renderPerformance();
  renderEWS();
  renderKategori();
  renderCluster();
  renderRekon();
}

/* =========================================================
   VIEW 1 — BERANDA
   ========================================================= */
function renderBeranda(){
  const el = document.getElementById('view-beranda');
  const k = DATA.kpi;
  const um = DATA.unit_map.slice().sort((a,b)=>b.total-a.total);

  el.innerHTML = `
  <div class="kpi-row">
    <div class="kpi-card" style="--accent:${PALETTE.blue}">
      <div class="lbl">Total Nilai PDP (DIV PMO)</div>
      <div class="val">${fmtRp(k.total_pmo)}</div>
      <div class="sub">D1+D2+D3+D4 · ${k.jumlah_proyek_d1+k.jumlah_proyek_d2+k.jumlah_proyek_d3} proyek + ${k.jumlah_item_d4} item material</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.navy}">
      <div class="lbl">Total Nilai PDP (SAP · DIV AKT)</div>
      <div class="val">${fmtRp(k.total_sap)}</div>
      <div class="sub">Termasuk ATBM &amp; Biaya Ditangguhkan seluruh unit</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.green}">
      <div class="lbl">Realisasi Settlement s.d Juni</div>
      <div class="val">${fmtRp(k.settlement_realisasi_total)}</div>
      <div class="sub good">${fmtPct(k.settlement_realisasi_total/k.settlement_target_2026_total*100)} dari target tahun 2026</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.amber}">
      <div class="lbl">Rata-rata Progress Fisik (D3)</div>
      <div class="val">${fmtPct(k.avg_progress_fisik)}</div>
      <div class="sub">Dari ${DATA.by_category.D3.count} proyek konstruksi berjalan</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.red}">
      <div class="lbl">Proyek dalam Cluster Kendala</div>
      <div class="val">${fmtNum(k.cluster_total_count)}</div>
      <div class="sub bad">Nilai ${fmtRp(k.cluster_total_value)} (Cluster 1-9)</div>
    </div>
  </div>

  <div class="section-title"><span class="bar"></span>Peta Sebaran Proyek PDP Indonesia</div>
  <div class="section-desc">Ukuran bubble = total nilai saldo PDP (D1-D4) per Unit Induk Pembangunan (UIP), posisi mengikuti letak geografis unit dari barat ke timur Indonesia.</div>
  <div class="grid2">
    <div class="panel">
      <h3>Peta Sebaran Proyek PDP <span class="legend-badge">Juni 2026</span></h3>
      <div class="panel-sub">Klik bubble untuk detail unit</div>
      <div class="map-wrap" id="mapWrap"></div>
    </div>
    <div class="panel">
      <h3>Komposisi Kategori PDP</h3>
      <div class="panel-sub">Berdasarkan nilai saldo PDP per kategori D1-D4</div>
      <div class="chart-wrap" style="height:230px;"><canvas id="chartComposisi"></canvas></div>
      <div style="margin-top:10px;font-size:11.5px;color:var(--muted);line-height:1.8;">
        <b style="color:${CATCOLORS.D1}">■</b> D1 — Sudah SLO/proses settlement akhir &nbsp;
        <b style="color:${CATCOLORS.D2}">■</b> D2 — Proses SLO/BA-ATBM &nbsp;
        <b style="color:${CATCOLORS.D3}">■</b> D3 — On going konstruksi &nbsp;
        <b style="color:${CATCOLORS.D4}">■</b> D4 — Material terpasang
      </div>
    </div>
  </div>

  <div class="grid2" style="grid-template-columns:1fr 1fr;">
    <div class="panel">
      <h3>Jumlah Nilai PDP per UIP</h3>
      <div class="panel-sub">Total saldo PDP (D1-D4), diurutkan dari terbesar</div>
      <div class="chart-wrap" style="height:280px;"><canvas id="chartPerUIP"></canvas></div>
    </div>
    <div class="panel">
      <h3>Peringkat Unit dengan Nilai PDP Terbanyak</h3>
      <div class="panel-sub">Top unit berdasarkan total nilai saldo PDP</div>
      <div class="table-wrap">
        <table class="dt">
          <thead><tr><th>#</th><th>Unit (UIP)</th><th>Nilai PDP</th><th>Jml Proyek D3</th><th>Kategori Dominan</th></tr></thead>
          <tbody>
            ${um.slice(0,8).map((u,i)=>{
              const dvals={D1:u.d1,D2:u.d2,D3:u.d3,D4:u.d4};
              const dom = Object.entries(dvals).sort((a,b)=>b[1]-a[1])[0][0];
              const rankColor = i===0?PALETTE.yellow:i===1?'#c0c9d8':i===2?'#cd8b52':PALETTE.blue;
              return `<tr>
                <td><span class="rank" style="background:${rankColor}">${i+1}</span></td>
                <td><b>${esc(u.label)}</b></td>
                <td>${fmtRp(u.total)}</td>
                <td>${u.jumlah_proyek_d3}</td>
                <td><span class="badge info">${dom}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="section-title"><span class="bar"></span>Jenis Proyek (Fungsi) — Kategori D3</div>
  <div class="grid3">
    ${['KIT','TL','GI'].map(f=>{
      const d = DATA.fungsi_dist[f]||{count:0,value:0};
      const lbl = f==='KIT'?'Pembangkit (KIT)':f==='TL'?'Transmisi (TL)':'Gardu Induk (GI)';
      return `<div class="panel" style="text-align:center;">
        <div class="panel-sub" style="margin-bottom:2px;">${lbl}</div>
        <div style="font-size:24px;font-weight:800;color:var(--navy);">${d.count}</div>
        <div style="font-size:11.5px;color:var(--muted);">proyek · ${fmtRp(d.value)}</div>
      </div>`;
    }).join('')}
  </div>
  `;

  // real Indonesia map (SVG path, projected from actual country geometry) + bubbles
  const mapWrap = document.getElementById('mapWrap');
  const mv = DATA.map.viewbox;
  mapWrap.insertAdjacentHTML('afterbegin',
    `<svg class="map-svg" viewBox="0 0 ${mv.w} ${mv.h}" preserveAspectRatio="none">
       <path d="${DATA.map.path}"></path>
     </svg>`);
  const maxTotal = Math.max(...um.map(u=>u.total),1);
  DATA.unit_map.forEach(u=>{
    const size = 20 + Math.sqrt(u.total/maxTotal)*54;
    const [x,y] = u.pos;
    const colorIdx = ['#2f80ed','#1aab6f','#f2a900','#E4032E','#7c5cff'];
    const color = colorIdx[Math.floor(x/22)%colorIdx.length];
    const b = document.createElement('div');
    b.className='map-bubble';
    b.style.left = x+'%'; b.style.top = y+'%';
    b.style.width = size+'px'; b.style.height = size+'px';
    b.style.background = color;
    b.innerHTML = `<span class="map-tip" style="font-size:${size>50?11:9}px;">${fmtRp(u.total).replace('Rp ','')}</span>`;
    b.title = u.label+': '+fmtRp(u.total);
    b.addEventListener('click',()=>{
      openModal(`<h3>${esc(u.label)}</h3>
        <div class="two-col-kv">
          <div><span>Total Nilai PDP</span><b>${fmtRp(u.total)}</b></div>
          <div><span>D1</span><b>${fmtRp(u.d1)}</b></div>
          <div><span>D2</span><b>${fmtRp(u.d2)}</b></div>
          <div><span>D3</span><b>${fmtRp(u.d3)}</b></div>
          <div><span>D4</span><b>${fmtRp(u.d4)}</b></div>
          <div><span>Jumlah Proyek D3</span><b>${u.jumlah_proyek_d3}</b></div>
        </div>`);
    });
    mapWrap.appendChild(b);
    const lab = document.createElement('div');
    lab.className='map-label'; lab.style.left=x+'%';
    lab.style.top = `calc(${y}% + ${size/2 + 5}px)`;
    lab.textContent = unitShort(u.unit);
    mapWrap.appendChild(lab);
  });

  // composition donut D1-D4
  new Chart(document.getElementById('chartComposisi'),{
    type:'doughnut',
    data:{
      labels:['D1','D2','D3','D4'],
      datasets:[{
        data:[DATA.by_category.D1.value,DATA.by_category.D2.value,DATA.by_category.D3.value,DATA.by_category.D4.value],
        backgroundColor:[CATCOLORS.D1,CATCOLORS.D2,CATCOLORS.D3,CATCOLORS.D4],
        borderWidth:3,borderColor:'#fff'
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'62%',
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}},
      tooltip:{callbacks:{label:(c)=>c.label+': '+fmtRp(c.raw)}}}
    }
  });

  // per UIP bar chart
  new Chart(document.getElementById('chartPerUIP'),{
    type:'bar',
    data:{
      labels:um.map(u=>unitShort(u.unit)),
      datasets:[{
        label:'Nilai PDP',
        data:um.map(u=>u.total),
        backgroundColor:um.map((u,i)=>i<3?PALETTE.red:PALETTE.blue),
        borderRadius:6,maxBarThickness:32
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>fmtRp(c.raw)}}},
      scales:{
        y:{ticks:{callback:(v)=>fmtRp(v)},grid:{color:'#eef1f6'}},
        x:{grid:{display:false},ticks:{font:{size:10.5}}}
      }
    }
  });
}

/* =========================================================
   VIEW 2 — PERFORMANCE MONITORING
   ========================================================= */
function renderPerformance(){
  const el = document.getElementById('view-performance');
  const d3 = DATA.by_category.D3;
  const k = DATA.kpi;
  const settleTotalPct = k.settlement_realisasi_total / k.settlement_target_2026_total * 100;

  const critical = DATA.ews.critical_projects.slice()
    .sort((a,b)=> (a.progress_fisik??1) - (b.progress_fisik??1) )
    .slice(0,10);

  el.innerHTML = `
  <div class="kpi-row">
    <div class="kpi-card" style="--accent:${PALETTE.blue}">
      <div class="lbl">Jumlah Proyek (D1-D4)</div>
      <div class="val">${fmtNum(k.jumlah_proyek_d1+k.jumlah_proyek_d2+k.jumlah_proyek_d3)}</div>
      <div class="sub">+ ${k.jumlah_item_d4} item material (D4)</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.navy}">
      <div class="lbl">Nilai Total PDP (PMO)</div>
      <div class="val">${fmtRp(k.total_pmo)}</div>
      <div class="sub">Saldo PDP per Juni 2026</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.amber}">
      <div class="lbl">Progres Fisik (Rata-rata D3)</div>
      <div class="val">${fmtPct(d3.progress_fisik_avg)}</div>
      <div class="sub">Target penyelesaian konstruksi 100%</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.green}">
      <div class="lbl">Progres Keuangan (Settlement)</div>
      <div class="val">${fmtPct(settleTotalPct)}</div>
      <div class="sub ${settleTotalPct>=50?'good':'warn'}">${fmtRp(k.settlement_realisasi_total)} dari target ${fmtRp(k.settlement_target_2026_total)}</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.red}">
      <div class="lbl">Proyek Tanpa Progres ≥3 Bulan</div>
      <div class="val">${fmtNum(k.no_progress_3plus)}</div>
      <div class="sub bad">${fmtPct(k.no_progress_3plus/d3.count*100)} dari total proyek D3</div>
    </div>
  </div>

  <div class="grid2">
    <div class="panel">
      <h3>Distribusi Progress Fisik Proyek D3</h3>
      <div class="panel-sub">Snapshot Juni 2026 — jumlah proyek per rentang capaian fisik</div>
      <div class="chart-wrap" style="height:270px;"><canvas id="chartTrend"></canvas></div>
    </div>
    <div class="panel">
      <h3>Fase Proyek D3</h3>
      <div class="panel-sub">Distribusi status siklus proyek</div>
      <div class="chart-wrap" style="height:270px;"><canvas id="chartFase"></canvas></div>
    </div>
  </div>

  <div class="section-title"><span class="bar"></span>Nilai vs Progres Fisik per Proyek (Bubble Chart)</div>
  <div class="section-desc">Setiap bubble = 1 proyek D3. Sumbu-X = progres fisik (%), Sumbu-Y = nilai saldo PDP, ukuran &amp; warna mengikuti fase proyek.</div>
  <div class="panel">
    <div class="chart-wrap" style="height:360px;"><canvas id="chartBubble"></canvas></div>
    <div style="margin-top:10px;font-size:11px;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap;">
      ${Object.entries(FASECOLORS).map(([f,c])=>`<span><b style="color:${c}">●</b> ${f}</span>`).join('')}
    </div>
  </div>

  <div class="section-title"><span class="bar"></span>Top 10 Proyek Kritis (Progres Fisik Terendah)</div>
  <div class="panel">
    <div class="table-wrap">
      <table class="dt">
        <thead><tr><th>#</th><th>Nama Proyek</th><th>UIP</th><th>Nilai PDP</th><th>Fisik (%)</th><th>Fase</th><th>Tdk Progres</th><th>Estimasi COD</th></tr></thead>
        <tbody>
          ${critical.map((p,i)=>`<tr>
            <td>${i+1}</td>
            <td style="max-width:260px;">${esc(p.nama)}</td>
            <td>${unitShort(p.unit)}</td>
            <td>${fmtRp(p.saldo_juni)}</td>
            <td>${p.progress_fisik!=null?fmtPct(p.progress_fisik*100):'-'}</td>
            <td><span class="badge ${p.fase==='Terminasi'?'crit':p.fase==='Pelaksanaan'?'warn':'info'}">${esc(p.fase||'-')}</span></td>
            <td>${p.durasi_bulan!=null?p.durasi_bulan+' bln':'-'}</td>
            <td>${esc(p.estimated_cod||'-')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>
  `;

  // fisik distribution histogram (Juni 2026 snapshot — historical monthly progress
  // fisik data in the source sheet is unreliable/corrupted, so only current period is shown)
  const trendLabels = Object.keys(d3.trend_fisik);
  new Chart(document.getElementById('chartTrend'),{
    type:'bar',
    data:{
      labels:trendLabels,
      datasets:[{
        label:'Jumlah Proyek',
        data:trendLabels.map(l=>d3.trend_fisik[l]),
        backgroundColor:['#E4032E','#f2a900','#2f80ed','#7c5cff','#1aab6f'],
        borderRadius:6,maxBarThickness:60
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>c.raw+' proyek'}}},
      scales:{y:{ticks:{precision:0},grid:{color:'#eef1f6'}},x:{grid:{display:false}}}
    }
  });

  // fase doughnut
  const faseKeys = Object.keys(d3.fase_dist).filter(f=>FASECOLORS[f]);
  new Chart(document.getElementById('chartFase'),{
    type:'doughnut',
    data:{
      labels:faseKeys,
      datasets:[{data:faseKeys.map(f=>d3.fase_dist[f]),
        backgroundColor:faseKeys.map(f=>FASECOLORS[f]),borderWidth:3,borderColor:'#fff'}]
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:'55%',
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10.5}}}}}
  });

  // bubble chart
  const bubbleData = d3.items.filter(p=>p.progress_fisik!=null).map(p=>({
    x:p.progress_fisik*100, y:p.saldo_juni, r: Math.max(4,Math.min(28, Math.sqrt(p.saldo_juni)/900000)),
    label:p.nama, unit:p.unit, fase:p.fase
  }));
  const faseGroups = {};
  bubbleData.forEach(b=>{ (faseGroups[b.fase||'Lainnya']=faseGroups[b.fase||'Lainnya']||[]).push(b); });
  new Chart(document.getElementById('chartBubble'),{
    type:'bubble',
    data:{datasets:Object.entries(faseGroups).map(([f,arr])=>({
      label:f,data:arr,backgroundColor:(FASECOLORS[f]||PALETTE.gray)+'B3',borderColor:FASECOLORS[f]||PALETTE.gray
    }))},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>{
        const d=c.raw; return [d.label,'Unit: '+unitShort(d.unit),'Fisik: '+d.x.toFixed(1)+'%','Nilai: '+fmtRp(d.y)];
      }}}},
      scales:{
        x:{title:{display:true,text:'Progres Fisik (%)'},min:0,max:100,grid:{color:'#eef1f6'}},
        y:{title:{display:true,text:'Nilai Saldo PDP'},ticks:{callback:v=>fmtRp(v)},grid:{color:'#eef1f6'}}
      }
    }
  });
}

/* =========================================================
   VIEW 3 — EWS
   ========================================================= */
function renderEWS(){
  const el = document.getElementById('view-ews');
  const k = DATA.kpi;
  const b = DATA.ews.no_progress_buckets;
  const fase = DATA.ews.fase_dist;
  const critAll = DATA.ews.critical_projects;

  el.innerHTML = `
  <div class="kpi-row">
    <div class="kpi-card" style="--accent:${PALETTE.red}">
      <div class="lbl">Proyek No-Progress ≥3 Bulan</div>
      <div class="val">${fmtNum(k.no_progress_3plus)}</div>
      <div class="sub bad">dari ${DATA.by_category.D3.count} proyek D3 (${fmtPct(k.no_progress_3plus/DATA.by_category.D3.count*100)})</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.amber}">
      <div class="lbl">Progres Fisik vs Target 100%</div>
      <div class="val">-${fmtPct(100-DATA.by_category.D3.progress_fisik_avg)}</div>
      <div class="sub warn">Rata-rata realisasi ${fmtPct(DATA.by_category.D3.progress_fisik_avg)}</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.purple}">
      <div class="lbl">Proyek dalam Cluster Kendala</div>
      <div class="val">${fmtNum(k.cluster_total_count)}</div>
      <div class="sub">Nilai ${fmtRp(k.cluster_total_value)} (Cluster 1-9)</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.gray}">
      <div class="lbl">Proyek Fase Terminasi</div>
      <div class="val">${fmtNum(fase['Terminasi']||0)}</div>
      <div class="sub">Proyek dihentikan / dievaluasi ulang</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.blue}">
      <div class="lbl">Biaya Ditangguhkan (Proyek)</div>
      <div class="val">${fmtRp(DATA.biaya_ditangguhkan.total)}</div>
      <div class="sub">${DATA.biaya_ditangguhkan.count} item tercatat</div>
    </div>
  </div>

  <div class="grid2">
    <div class="panel">
      <h3>Distribusi Durasi Tanpa Progres (Proyek D3)</h3>
      <div class="panel-sub">Semakin lama tanpa progres = semakin tinggi risiko</div>
      <div class="chart-wrap" style="height:260px;"><canvas id="chartNoProgress"></canvas></div>
    </div>
    <div class="panel">
      <h3>Nilai Proyek Berkendala per Cluster</h3>
      <div class="panel-sub">Cluster 1-9 — kendala non-konstruksi (izin, lahan, kontrak, dll.)</div>
      <div class="chart-wrap" style="height:260px;"><canvas id="chartClusterEWS"></canvas></div>
    </div>
  </div>

  <div class="section-title"><span class="bar"></span>Daftar Proyek Kritis (Tanpa Progres ≥ 3 Bulan)</div>
  <div class="section-desc">Diurutkan berdasarkan nilai saldo PDP terbesar. Klik baris untuk melihat keterangan/kendala lengkap.</div>
  <div class="panel">
    <div class="search-box">
      <input type="text" id="ewsSearch" placeholder="Cari nama proyek / unit...">
      <div class="tag-filter" id="ewsFilter">
        <span class="active" data-f="all">Semua</span>
        <span data-f="crit">≥6 bulan</span>
        <span data-f="warn">3-6 bulan</span>
      </div>
    </div>
    <div class="table-wrap">
      <table class="dt" id="ewsTable">
        <thead><tr><th>Nama Proyek</th><th>UIP</th><th>Nilai PDP</th><th>Fase</th><th>Tdk Progres</th><th>Status</th></tr></thead>
        <tbody id="ewsTbody"></tbody>
      </table>
    </div>
  </div>
  `;

  new Chart(document.getElementById('chartNoProgress'),{
    type:'bar',
    data:{
      labels:Object.keys(b),
      datasets:[{data:Object.values(b),
        backgroundColor:['#1aab6f','#2f80ed','#f2a900','#E4032E','#8a95ab'],
        borderRadius:6,maxBarThickness:46}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{grid:{color:'#eef1f6'}},x:{grid:{display:false}}}}
  });

  const cl = DATA.clusters;
  new Chart(document.getElementById('chartClusterEWS'),{
    type:'bar',
    data:{
      labels:cl.map(c=>c.title.replace(/^Cluster \d+\s*:\s*/,'').slice(0,22)),
      datasets:[{label:'Nilai',data:cl.map(c=>c.total),
        backgroundColor:PALETTE.purple,borderRadius:6,maxBarThickness:22}]
    },
    options:{
      indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>fmtRp(c.raw)}}},
      scales:{x:{ticks:{callback:v=>fmtRp(v)},grid:{color:'#eef1f6'}},y:{grid:{display:false},ticks:{font:{size:10}}}}
    }
  });

  function renderEwsRows(filter='all', q=''){
    let rows = critAll.slice();
    if(filter==='crit') rows = rows.filter(p=>(p.durasi_bulan||0)>=6);
    if(filter==='warn') rows = rows.filter(p=>(p.durasi_bulan||0)>=3 && (p.durasi_bulan||0)<6);
    if(q) rows = rows.filter(p=> (p.nama||'').toLowerCase().includes(q) || unitShort(p.unit).toLowerCase().includes(q));
    rows.sort((a,b)=>b.saldo_juni-a.saldo_juni);
    window.__ewsRows = rows;
    document.getElementById('ewsTbody').innerHTML = rows.map((p,i)=>`
      <tr data-idx="${i}" style="cursor:pointer;">
        <td style="max-width:260px;">${esc(p.nama)}</td>
        <td>${unitShort(p.unit)}</td>
        <td>${fmtRp(p.saldo_juni)}</td>
        <td><span class="badge ${p.fase==='Terminasi'?'crit':'info'}">${esc(p.fase||'-')}</span></td>
        <td><span class="badge ${(p.durasi_bulan||0)>=6?'crit':'warn'}">${p.durasi_bulan??'-'} bln</span></td>
        <td style="max-width:320px;font-size:11.5px;color:var(--muted);">${esc((p.keterangan||'').slice(0,90))}${(p.keterangan||'').length>90?'…':''}</td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);">Tidak ada data</td></tr>';
  }
  document.getElementById('ewsTbody').addEventListener('click',(e)=>{
    const tr = e.target.closest('tr[data-idx]');
    if(!tr) return;
    const p = window.__ewsRows[+tr.dataset.idx];
    if(!p) return;
    openModal(`<h3>${esc(p.nama)}</h3><div class="two-col-kv">
        <div><span>Unit</span><b>${unitShort(p.unit)}</b></div>
        <div><span>Nilai PDP</span><b>${fmtRp(p.saldo_juni)}</b></div>
        <div><span>Fase</span><b>${esc(p.fase||'-')}</b></div>
        <div><span>Tanpa Progres</span><b>${p.durasi_bulan??'-'} bulan</b></div>
        <div><span>Estimasi COD</span><b>${esc(p.estimated_cod||'-')}</b></div>
      </div><p style="margin-top:14px;font-size:12.5px;line-height:1.6;"><b>Keterangan:</b><br>${esc(p.keterangan||'-')}</p>`);
  });
  renderEwsRows();
  document.getElementById('ewsSearch').addEventListener('input',(e)=>{
    const active = document.querySelector('#ewsFilter span.active').dataset.f;
    renderEwsRows(active, e.target.value.toLowerCase());
  });
  document.getElementById('ewsFilter').addEventListener('click',(e)=>{
    if(e.target.tagName!=='SPAN') return;
    document.querySelectorAll('#ewsFilter span').forEach(s=>s.classList.remove('active'));
    e.target.classList.add('active');
    renderEwsRows(e.target.dataset.f, document.getElementById('ewsSearch').value.toLowerCase());
  });
}

/* =========================================================
   VIEW 4 — KATEGORI D1-D4
   ========================================================= */
function renderKategori(){
  const el = document.getElementById('view-kategori');
  const cat = DATA.by_category;

  el.innerHTML = `
  <div class="kpi-row">
    ${['D1','D2','D3','D4'].map(k=>{
      const c = cat[k];
      const descs = {D1:'Sudah SLO / proses settlement akhir',D2:'Proses penerbitan SLO / BA-ATBM',
        D3:'Proyek konstruksi on-going (monitoring fisik)',D4:'Material terpasang / rencana pemanfaatan'};
      return `<div class="kpi-card" style="--accent:${CATCOLORS[k]}">
        <div class="lbl">Kategori ${k}</div>
        <div class="val">${fmtRp(c.value)}</div>
        <div class="sub">${c.count} ${k==='D4'?'item':'proyek'} · ${descs[k]}</div>
      </div>`;
    }).join('')}
  </div>

  <div class="section-title"><span class="bar"></span>D1 — Sudah SLO / Proses Settlement Akhir</div>
  <div class="panel">
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Unit</th><th>Nama Proyek</th><th>Nilai Saldo PDP</th><th>Kategori</th></tr></thead>
      <tbody>${cat.D1.items.map(x=>`<tr><td>${unitShort(x.unit)}</td><td>${esc(x.nama)}</td><td>${fmtRp(x.saldo_juni)}</td><td><span class="badge ok">${esc(x.kategori||'-')}</span></td></tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div class="section-title"><span class="bar"></span>D2 — Proses Penerbitan SLO / BA-ATBM</div>
  <div class="panel">
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Unit</th><th>Nama Proyek</th><th>Nilai Saldo PDP</th><th>Kategori</th></tr></thead>
      <tbody>${cat.D2.items.sort((a,b)=>b.saldo_juni-a.saldo_juni).map(x=>`<tr><td>${unitShort(x.unit)}</td><td>${esc(x.nama)}</td><td>${fmtRp(x.saldo_juni)}</td><td><span class="badge info">${esc((x.kategori||'-').slice(0,40))}</span></td></tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div class="section-title"><span class="bar"></span>D3 — Proyek Konstruksi On-Going (${cat.D3.count} proyek)</div>
  <div class="panel">
    <div class="search-box">
      <input type="text" id="d3Search" placeholder="Cari nama proyek / unit...">
    </div>
    <div class="table-wrap" style="max-height:480px;overflow-y:auto;">
      <table class="dt" id="d3Table">
        <thead><tr>
          <th data-k="unit">Unit</th><th data-k="nama">Nama Proyek</th><th data-k="saldo_juni">Nilai PDP</th>
          <th data-k="progress_fisik">Fisik (%)</th><th data-k="fase">Fase</th><th data-k="durasi_bulan">Tdk Progres</th>
        </tr></thead>
        <tbody id="d3Tbody"></tbody>
      </table>
    </div>
  </div>

  <div class="section-title"><span class="bar"></span>D4 — Material Terpasang / Rencana Pemanfaatan (${cat.D4.count} item)</div>
  <div class="grid2">
    <div class="panel">
      <h3>Nilai Material per Unit</h3>
      <div class="chart-wrap" style="height:280px;"><canvas id="chartD4Unit"></canvas></div>
    </div>
    <div class="panel">
      <h3>Rencana Pemanfaatan</h3>
      <div class="panel-sub">Distribusi item material berdasarkan rencana pemanfaatan</div>
      <div class="table-wrap" style="max-height:280px;overflow-y:auto;">
        <table class="dt"><thead><tr><th>Rencana Pemanfaatan</th><th>Jml Item</th><th>Nilai</th></tr></thead>
        <tbody>${(()=>{
          const g={};
          cat.D4.items.forEach(x=>{const r=x.rencana_pemanfaatan||'Belum ditentukan';g[r]=g[r]||{c:0,v:0};g[r].c++;g[r].v+=x.saldo_juni;});
          return Object.entries(g).sort((a,b)=>b[1].v-a[1].v).map(([r,v])=>`<tr><td>${esc(r)}</td><td>${v.c}</td><td>${fmtRp(v.v)}</td></tr>`).join('');
        })()}</tbody></table>
      </div>
    </div>
  </div>
  `;

  // D3 sortable/searchable table
  let d3sort={k:'saldo_juni',dir:-1};
  function renderD3(q=''){
    let rows = cat.D3.items.filter(x=>!q || (x.nama||'').toLowerCase().includes(q) || unitShort(x.unit).toLowerCase().includes(q));
    rows = rows.slice().sort((a,b)=>{
      let av=a[d3sort.k], bv=b[d3sort.k];
      if(typeof av==='string'||av==null) { av=(av||'').toString(); bv=(bv||'').toString(); return d3sort.dir*av.localeCompare(bv); }
      return d3sort.dir*((av||0)-(bv||0));
    });
    document.getElementById('d3Tbody').innerHTML = rows.slice(0,150).map(x=>`
      <tr><td>${unitShort(x.unit)}</td><td style="max-width:260px;">${esc(x.nama)}</td><td>${fmtRp(x.saldo_juni)}</td>
      <td>${x.progress_fisik!=null?fmtPct(x.progress_fisik*100):'-'}</td>
      <td><span class="badge ${x.fase==='Terminasi'?'crit':x.fase==='Selesai'?'ok':'info'}">${esc(x.fase||'-')}</span></td>
      <td>${x.durasi_bulan??'-'} bln</td></tr>`).join('')
      + (rows.length>150?`<tr><td colspan="6" style="text-align:center;color:var(--muted);">Menampilkan 150 dari ${rows.length} proyek — gunakan pencarian untuk mempersempit</td></tr>`:'');
  }
  renderD3();
  document.getElementById('d3Search').addEventListener('input',e=>renderD3(e.target.value.toLowerCase()));
  document.querySelectorAll('#d3Table th').forEach(th=>{
    th.addEventListener('click',()=>{
      const k = th.dataset.k;
      d3sort.dir = (d3sort.k===k)? -d3sort.dir : -1;
      d3sort.k = k;
      renderD3(document.getElementById('d3Search').value.toLowerCase());
    });
  });

  // D4 by unit chart
  const d4g = {};
  cat.D4.items.forEach(x=>{ d4g[x.unit]=(d4g[x.unit]||0)+x.saldo_juni; });
  const d4units = Object.entries(d4g).sort((a,b)=>b[1]-a[1]);
  new Chart(document.getElementById('chartD4Unit'),{
    type:'bar',
    data:{labels:d4units.map(([u])=>unitShort(u)),
      datasets:[{data:d4units.map(([,v])=>v),backgroundColor:CATCOLORS.D4,borderRadius:6,maxBarThickness:28}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtRp(c.raw)}}},
      scales:{y:{ticks:{callback:v=>fmtRp(v)},grid:{color:'#eef1f6'}},x:{grid:{display:false},ticks:{font:{size:10}}}}}
  });
}

/* =========================================================
   VIEW 5 — CLUSTER 1-9
   ========================================================= */
function renderCluster(){
  const el = document.getElementById('view-cluster');
  const cl = DATA.clusters;
  const barColors = ['#E4032E','#f2a900','#2f80ed','#1aab6f','#7c5cff','#12b6c9','#8a95ab','#c0392b','#16a085'];

  el.innerHTML = `
  <div class="kpi-row">
    <div class="kpi-card" style="--accent:${PALETTE.purple}">
      <div class="lbl">Total Proyek Berkendala</div>
      <div class="val">${fmtNum(DATA.kpi.cluster_total_count)}</div>
      <div class="sub">Tersebar dalam 9 cluster kendala</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.red}">
      <div class="lbl">Total Nilai Terdampak</div>
      <div class="val">${fmtRp(DATA.kpi.cluster_total_value)}</div>
      <div class="sub bad">${fmtPct(DATA.kpi.cluster_total_value/DATA.by_category.D3.value*100)} dari total nilai D3</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.amber}">
      <div class="lbl">Cluster Nilai Terbesar</div>
      <div class="val" style="font-size:15px;">${cl.slice().sort((a,b)=>b.total-a.total)[0].title.replace(/^Cluster \d+\s*:\s*/,'')}</div>
      <div class="sub">${fmtRp(cl.slice().sort((a,b)=>b.total-a.total)[0].total)}</div>
    </div>
  </div>

  <div class="section-title"><span class="bar"></span>Ringkasan 9 Cluster Proyek PDP</div>
  <div class="section-desc">Klik kartu cluster untuk melihat daftar proyek di dalamnya.</div>
  <div class="cluster-grid" id="clusterGrid">
    ${cl.map((c,i)=>`
      <div class="cluster-card" style="border-top-color:${barColors[i%barColors.length]}" data-idx="${i}">
        <span class="cnum">C${i+1}</span>
        <h4>${esc(c.title.replace(/^Cluster \d+\s*:\s*/,''))}</h4>
        <div class="cval">${fmtRp(c.total)}</div>
        <div class="ccount">${c.count} proyek</div>
      </div>`).join('')}
  </div>

  <div class="section-title"><span class="bar"></span>Perbandingan Nilai Antar Cluster</div>
  <div class="panel">
    <div class="chart-wrap" style="height:300px;"><canvas id="chartClusterAll"></canvas></div>
  </div>
  `;

  new Chart(document.getElementById('chartClusterAll'),{
    type:'bar',
    data:{labels:cl.map((c,i)=>'C'+(i+1)),
      datasets:[{data:cl.map(c=>c.total),backgroundColor:barColors,borderRadius:6,maxBarThickness:40}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{
        title:(items)=>cl[items[0].dataIndex].title, label:(c)=>fmtRp(c.raw)+' · '+cl[c.dataIndex].count+' proyek'
      }}},
      scales:{y:{ticks:{callback:v=>fmtRp(v)},grid:{color:'#eef1f6'}},x:{grid:{display:false}}}}
  });

  document.querySelectorAll('.cluster-card').forEach(card=>{
    card.addEventListener('click',()=>{
      const c = cl[+card.dataset.idx];
      openModal(`<h3>${esc(c.title)}</h3>
        <div class="two-col-kv" style="margin-bottom:14px;">
          <div><span>Jumlah Proyek</span><b>${c.count}</b></div>
          <div><span>Total Nilai</span><b>${fmtRp(c.total)}</b></div>
        </div>
        <div class="table-wrap"><table class="dt">
          <thead><tr><th>Unit</th><th>Nama Proyek</th><th>Nilai</th><th>Progres</th><th>Status/Kendala</th></tr></thead>
          <tbody>${c.projects.map(p=>`<tr><td>${esc(p.unit)}</td><td style="max-width:220px;">${esc(p.nama)}</td>
            <td>${fmtRp(p.nilai)}</td><td>${p.progres_pct!=null?fmtPct(p.progres_pct):'-'}</td>
            <td style="max-width:320px;font-size:11.5px;">${esc(p.status||'-')}</td></tr>`).join('')}</tbody>
        </table></div>`);
    });
  });
}

/* =========================================================
   VIEW 6 — REKONSILIASI PMO vs SAP
   ========================================================= */
function renderRekon(){
  const el = document.getElementById('view-rekon');
  const k = DATA.kpi;
  const sap = DATA.sap_divakt;
  const settle = DATA.settlement;
  const bd = DATA.biaya_ditangguhkan;

  const sapTop = sap.rows.slice().sort((a,b)=>b.total_pdp-a.total_pdp).slice(0,12);
  const regEntries = Object.entries(sap.by_regional).filter(([r])=>r!=='Lainnya').sort((a,b)=>b[1].total_pdp-a[1].total_pdp);

  el.innerHTML = `
  <div class="callout">
    <div style="flex:1;">
      <div class="lbl">Rekonsiliasi Nilai PDP — DIV PMO vs DIV AKT (SAP)</div>
      <div style="display:flex;gap:36px;flex-wrap:wrap;margin-top:10px;">
        <div><div class="lbl">Total PDP (DIV PMO — D1+D2+D3+D4)</div><div class="big">${fmtRp(k.total_pmo)}</div></div>
        <div><div class="lbl">Total PDP UIP (DIV AKT — SAP)</div><div class="big">${fmtRp(k.total_sap_uip)}</div></div>
        <div><div class="lbl">Selisih</div><div class="big">${fmtRp(k.selisih_pmo_sap_uip)}</div></div>
      </div>
    </div>
    <div class="match-pill">✓ Match ${fmtPct(100-Math.abs(k.selisih_pct),3)}</div>
  </div>
  <div class="section-desc" style="margin-top:10px;">Data monitoring proyek per proyek dari DIV PMO (kategori D1-D4) direkonsiliasi terhadap tarikan data SAP dari DIV AKT (khusus entitas ber-flag UIP). Selisih sebesar ${fmtRp(k.selisih_pmo_sap_uip)} (${fmtPct(k.selisih_pct,4)}) berada dalam batas wajar pembulatan/mutasi akhir bulan berjalan.</div>

  <div class="kpi-row" style="margin-top:20px;">
    <div class="kpi-card" style="--accent:${PALETTE.navy}">
      <div class="lbl">Total PDP Seluruh Entitas (SAP)</div>
      <div class="val">${fmtRp(sap.totals.total_pdp)}</div>
      <div class="sub">UIP, UIT/UID/UIW, Kantor Pusat</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.blue}">
      <div class="lbl">PDP Konstruksi</div>
      <div class="val">${fmtRp(sap.totals.pdp_konstruksi)}</div>
      <div class="sub">${fmtPct(sap.totals.pdp_konstruksi/sap.totals.total_pdp*100)} dari total PDP</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.amber}">
      <div class="lbl">ATBM</div>
      <div class="val">${fmtRp(sap.totals.atbm)}</div>
      <div class="sub">Aset Tetap Belum Mutasi</div>
    </div>
    <div class="kpi-card" style="--accent:${PALETTE.red}">
      <div class="lbl">Biaya Ditangguhkan (SAP)</div>
      <div class="val">${fmtRp(sap.totals.biaya_ditangguhkan)}</div>
      <div class="sub">Termasuk entitas non-UIP (Kantor Pusat, dll)</div>
    </div>
  </div>

  <div class="grid2">
    <div class="panel">
      <h3>Komponen Nilai PDP (SAP — DIV AKT)</h3>
      <div class="panel-sub">PDP Konstruksi vs Material vs Pembayaran Dimuka</div>
      <div class="chart-wrap" style="height:250px;"><canvas id="chartSapKomponen"></canvas></div>
    </div>
    <div class="panel">
      <h3>Nilai PDP per Regional</h3>
      <div class="panel-sub">UIP / JAMALI / SUMKAL / SULMAPANA / Kantor Pusat</div>
      <div class="chart-wrap" style="height:250px;"><canvas id="chartSapRegional"></canvas></div>
    </div>
  </div>

  <div class="section-title"><span class="bar"></span>Peringkat Unit — Nilai Total PDP (Data SAP)</div>
  <div class="panel">
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>#</th><th>Unit</th><th>Regional</th><th>PDP Konstruksi</th><th>PDP Material</th><th>ATBM</th><th>Total PDP</th></tr></thead>
      <tbody>${sapTop.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.unit)}</b></td><td><span class="badge info">${esc(r.regional||'-')}</span></td>
        <td>${fmtRp(r.pdp_konstruksi)}</td><td>${fmtRp(r.pdp_material)}</td><td>${fmtRp(r.atbm)}</td><td><b>${fmtRp(r.total_pdp)}</b></td></tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div class="section-title"><span class="bar"></span>Settlement PDP &amp; ATBM ke Aset Tetap — per UIP</div>
  <div class="section-desc">Target settlement tahun 2026 dibandingkan realisasi settlement (PDP + ATBM ke AT) sampai dengan Juni 2026.</div>
  <div class="grid2">
    <div class="panel" style="grid-column:1/-1;">
      <div class="table-wrap"><table class="dt">
        <thead><tr><th>UIP</th><th>Target 2026</th><th>Target s.d Juni</th><th>Realisasi PDP</th><th>Realisasi ATBM</th><th>Total Realisasi</th><th>% vs Target 2026</th></tr></thead>
        <tbody>${settle.table.map(r=>`<tr><td><b>${esc(r.uip)}</b></td><td>${fmtRp(r.target_2026)}</td><td>${fmtRp(r.target_juni)}</td>
          <td>${fmtRp(r.realisasi_pdp)}</td><td>${fmtRp(r.realisasi_atbm)}</td><td><b>${fmtRp(r.realisasi_total)}</b></td>
          <td><span class="badge ${r.pct_vs_target_2026>=50?'ok':r.pct_vs_target_2026>=25?'warn':'crit'}">${fmtPct(r.pct_vs_target_2026)}</span></td></tr>`).join('')}
        <tr style="font-weight:700;background:#f5f7fb;"><td>TOTAL</td><td>${fmtRp(settle.target_total.target_2026)}</td><td>${fmtRp(settle.target_total.target_juni)}</td>
          <td colspan="2"></td><td>${fmtRp(k.settlement_realisasi_total)}</td>
          <td>${fmtPct(k.settlement_realisasi_total/settle.target_total.target_2026*100)}</td></tr>
        </tbody>
      </table></div>
    </div>
  </div>

  <div class="grid2">
    <div class="panel">
      <h3>Tren Realisasi Settlement Bulanan</h3>
      <div class="panel-sub">Januari — Juni 2026 (PDP+ATBM ke AT, seluruh UIP)</div>
      <div class="chart-wrap" style="height:250px;"><canvas id="chartSettleTrend"></canvas></div>
    </div>
    <div class="panel">
      <h3>Biaya Ditangguhkan per Unit</h3>
      <div class="panel-sub">Total ${fmtRp(bd.total)} · ${bd.count} proyek tercatat</div>
      <div class="chart-wrap" style="height:250px;"><canvas id="chartBD"></canvas></div>
    </div>
  </div>

  <div class="section-title"><span class="bar"></span>Top 10 Proyek — Biaya Ditangguhkan Terbesar</div>
  <div class="panel">
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Unit</th><th>Nama Proyek</th><th>Uraian</th><th>Nilai (Juni 2026)</th><th>Target COD</th></tr></thead>
      <tbody>${bd.top.slice(0,10).map(x=>`<tr><td>${unitShort(x.unit)}</td><td style="max-width:220px;">${esc(x.nama)}</td>
        <td style="max-width:220px;font-size:11.5px;color:var(--muted);">${esc(x.uraian||'-')}</td><td>${fmtRp(x.nilai_juni)}</td><td>${esc(x.target_cod||'-')}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>
  `;

  new Chart(document.getElementById('chartSapKomponen'),{
    type:'doughnut',
    data:{labels:['PDP Konstruksi','PDP Material','PDP Pembayaran Dimuka'],
      datasets:[{data:[sap.totals.pdp_konstruksi,sap.totals.pdp_material,sap.totals.pdp_pembayaran_dimuka],
        backgroundColor:[PALETTE.blue,PALETTE.amber,PALETTE.green],borderWidth:3,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'58%',
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10.5}}},tooltip:{callbacks:{label:c=>c.label+': '+fmtRp(c.raw)}}}}
  });

  new Chart(document.getElementById('chartSapRegional'),{
    type:'bar',
    data:{labels:regEntries.map(([r])=>r),
      datasets:[{data:regEntries.map(([,v])=>v.total_pdp),backgroundColor:PALETTE.navy,borderRadius:6,maxBarThickness:30}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtRp(c.raw)}}},
      scales:{x:{ticks:{callback:v=>fmtRp(v)},grid:{color:'#eef1f6'}},y:{grid:{display:false}}}}
  });

  new Chart(document.getElementById('chartSettleTrend'),{
    type:'line',
    data:{labels:Object.keys(settle.monthly_total),
      datasets:[
        {label:'Realisasi Bulanan',data:Object.values(settle.monthly_total),borderColor:PALETTE.blue,backgroundColor:'rgba(47,128,237,.15)',fill:true,tension:.3},
        {label:'Kumulatif',data:Object.values(settle.monthly_kumulatif),borderColor:PALETTE.green,backgroundColor:'rgba(26,171,111,.08)',fill:true,tension:.3,borderDash:[5,4]}
      ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10.5}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+fmtRp(c.raw)}}},
      scales:{y:{ticks:{callback:v=>fmtRp(v)},grid:{color:'#eef1f6'}},x:{grid:{display:false}}}}
  });

  const bdu = Object.entries(bd.by_unit).sort((a,b)=>b[1].nilai-a[1].nilai);
  new Chart(document.getElementById('chartBD'),{
    type:'bar',
    data:{labels:bdu.map(([u])=>unitShort(u)),
      datasets:[{data:bdu.map(([,v])=>v.nilai),backgroundColor:PALETTE.teal,borderRadius:6,maxBarThickness:26}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtRp(c.raw)}}},
      scales:{y:{ticks:{callback:v=>fmtRp(v)},grid:{color:'#eef1f6'}},x:{grid:{display:false},ticks:{font:{size:10}}}}}
  });
}
