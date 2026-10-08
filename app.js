const courses=window.COURSES||[];
const roadmaps=window.ROADMAPS||[];
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const uniq=a=>[...new Set(a)].sort((a,b)=>a.localeCompare(b));
const store=(k,v)=>{try{localStorage.setItem(`skillsprint:${k}`,JSON.stringify(v))}catch{}};
const load=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(`skillsprint:${k}`)||'null')??fallback}catch{return fallback}};
const byId=id=>courses.find(c=>c.id===id);
const dateDays=(a,b=new Date())=>Math.floor((new Date(b)-new Date(`${a}T00:00:00`))/86400000);
const isNew=c=>dateDays(c.added)<=7 && dateDays(c.added)>=0;
const freshState=c=>{const d=dateDays(c.verified);return d<=30?{label:'✓ FRESH',cls:'verified'}:d<=60?{label:'RECHECK SOON',cls:'stale'}:{label:'VERIFY AGAIN',cls:'stale'}};
const totalHours=ids=>ids.map(byId).filter(Boolean).reduce((s,c)=>s+c.hours,0);

let favorites=load('favorites',[]);
let sprint=load('sprint',[]);
let completed=load('completed',[]);
let reviews=load('reviews',{});
let govOnly=false,newOnly=false,favoritesOnly=false;
let detailCourseId=null;
let deferredInstall=null;

const grid=$('#courseGrid'),search=$('#search'),category=$('#category'),duration=$('#duration'),provider=$('#provider'),region=$('#region'),level=$('#level'),sort=$('#sort');
uniq(courses.map(c=>c.category)).forEach(v=>category.insertAdjacentHTML('beforeend',`<option>${esc(v)}</option>`));
uniq(courses.map(c=>c.provider)).forEach(v=>provider.insertAdjacentHTML('beforeend',`<option>${esc(v)}</option>`));

function metrics(){
  $('#courseMetric').textContent=courses.length;
  $('#providerMetric').textContent=uniq(courses.map(c=>c.provider)).length;
  $('#newMetric').textContent=courses.filter(isNew).length;
  const stale=courses.filter(c=>freshState(c).cls==='stale').length;
  $('#catalogSummary').textContent=stale?`${stale} verification${stale>1?'s':''} due for review`:'all verification dates are fresh';
}

function filtered(){
  const q=search.value.trim().toLowerCase();
  const max=duration.value==='All'?99:Number(duration.value);
  let list=courses.filter(c=>{
    const hay=`${c.title} ${c.provider} ${c.category} ${c.desc} ${c.credential}`.toLowerCase();
    return (!q||hay.includes(q)) &&
      (category.value==='All'||c.category===category.value) &&
      (provider.value==='All'||c.provider===provider.value) &&
      (region.value==='All'||c.region===region.value) &&
      (level.value==='All'||c.level===level.value) &&
      c.hours<=max && (!govOnly||c.government) && (!newOnly||isNew(c)) && (!favoritesOnly||favorites.includes(c.id));
  });
  if(sort.value==='score')list.sort((a,b)=>b.score-a.score);
  if(sort.value==='short')list.sort((a,b)=>a.hours-b.hours||b.score-a.score);
  if(sort.value==='new')list.sort((a,b)=>b.added.localeCompare(a.added)||b.score-a.score);
  if(sort.value==='fresh')list.sort((a,b)=>b.verified.localeCompare(a.verified)||b.score-a.score);
  if(sort.value==='title')list.sort((a,b)=>a.title.localeCompare(b.title));
  return list;
}

function card(c){
  const fav=favorites.includes(c.id),planned=sprint.includes(c.id),done=completed.includes(c.id),fresh=freshState(c);
  return `<article class="course-card ${done?'completed':''}">
    <div class="card-top"><div class="badges">
      <span class="badge ${fresh.cls}">${fresh.label}</span>
      ${isNew(c)?'<span class="badge new">NEW</span>':''}${c.government?'<span class="badge gov">GOVERNMENT</span>':''}${done?'<span class="badge done">COMPLETED</span>':''}
    </div><button class="favorite ${fav?'active':''}" data-fav="${c.id}" aria-label="Favorite ${esc(c.title)}">★</button></div>
    <h3>${esc(c.title)}</h3><div class="provider-line">${esc(c.provider)} · ${esc(c.region)}</div>
    <p class="course-desc">${esc(c.desc)}</p>
    <div class="facts"><div class="fact"><small>Duration</small><b>${esc(c.duration)}</b></div><div class="fact"><small>Credential</small><b>${esc(c.strength)}</b></div><div class="fact"><small>Level</small><b>${esc(c.level)}</b></div><div class="fact"><small>Practical</small><b>${c.project?'Yes':'Not required'}</b></div></div>
    <div class="score"><div class="score-head"><span>Career-value score</span><b>${c.score}/100</b></div><div class="bar"><i style="width:${c.score}%"></i></div></div>
    <div class="card-actions"><a href="${esc(c.url)}" target="_blank" rel="noopener">Start official ↗</a><button data-sprint="${c.id}">${planned?'✓ In sprint':'+ Add to sprint'}</button><button class="details" data-detail="${c.id}">Details, review & LinkedIn</button></div>
  </article>`;
}

function render(){
  const list=filtered();
  grid.innerHTML=list.map(card).join('');
  $('#visibleCount').textContent=list.length;
  $('#emptyState').hidden=!!list.length;
  updateSprintCount();
  updateAdminMetrics();
}

function persist(){store('favorites',favorites);store('sprint',sprint);store('completed',completed);store('reviews',reviews)}
function updateSprintCount(){$('#sprintCount').textContent=sprint.length}
function addToSprint(id){
  if(sprint.includes(id)){sprint=sprint.filter(x=>x!==id);persist();render();return}
  const c=byId(id);if(!c)return;
  if(sprint.length>=7){alert('Your sprint already has 7 courses. Remove one before adding another.');return}
  if(totalHours(sprint)+c.hours>15){alert(`This would take your sprint above 15 hours. Current plan: ${totalHours(sprint).toFixed(1)}h.`);return}
  sprint=[...sprint,id];persist();render();
}

function openSprint(){
  const selected=sprint.map(byId).filter(Boolean);
  $('#sprintItems').innerHTML=selected.length?selected.map((c,i)=>`<div class="sprint-item"><span class="day-pill">D${i+1}</span><div><b>${esc(c.title)}</b><br><span>${esc(c.provider)} · ${completed.includes(c.id)?'Completed':'Planned'}</span></div><b>${esc(c.duration)}</b><button data-remove="${c.id}">Remove</button></div>`).join(''):'<p class="empty">Your sprint is empty. Add a course or choose a roadmap.</p>';
  $('#sprintCourseCount').textContent=`${selected.length} / 7`;
  $('#sprintHours').textContent=`${Math.round(totalHours(sprint)*10)/10}h / 15h`;
  $('#completedCount').textContent=selected.filter(c=>completed.includes(c.id)).length;
  if(!$('#sprintDialog').open) $('#sprintDialog').showModal();
}

function miniNew(){
  const list=courses.filter(isNew).sort((a,b)=>b.score-a.score).slice(0,8);
  $('#newGrid').innerHTML=list.map(c=>`<article class="mini-card"><small>${esc(c.category)} · ${esc(c.duration)}</small><h3>${esc(c.title)}</h3><p>${esc(c.provider)}<br>${esc(c.strength)}</p><div class="mini-meta"><span>Score ${c.score}</span><span>${c.project?'Hands-on':'Fast theory'}</span><span>${esc(c.region)}</span></div><button data-detail="${c.id}">View course →</button></article>`).join('');
}

function renderRoadmaps(){
  $('#roadmapGrid').innerHTML=roadmaps.map(r=>{
    const cs=r.courseIds.map(byId).filter(Boolean),h=cs.reduce((s,c)=>s+c.hours,0);
    return `<article class="roadmap-card"><div class="roadmap-top"><span class="roadmap-icon">${r.icon}</span><span class="roadmap-tag">${esc(r.tag)}</span></div><h3>${esc(r.title)}</h3><p><b>${esc(r.audience)}</b><br>${esc(r.outcome)}</p><div class="roadmap-list">${cs.map((c,i)=>`<div class="roadmap-step"><b>${i+1}</b><span>${esc(c.title)} · ${esc(c.duration)}</span></div>`).join('')}</div><div class="roadmap-total"><span>${cs.length} courses</span><b>${Math.round(h*10)/10} hours</b></div><button class="primary" data-roadmap="${r.id}">Add roadmap to my sprint</button></article>`;
  }).join('');
}

function addRoadmap(id){
  const r=roadmaps.find(x=>x.id===id);if(!r)return;
  const ids=r.courseIds.filter(x=>byId(x));
  if(ids.length>7||totalHours(ids)>15){alert('This roadmap is too large for the 7-day sprint rules.');return}
  sprint=ids;persist();render();openSprint();
}

function reviewMarkup(c){
  const r=reviews[c.id]||{rating:0,note:''};
  return `<div class="user-review"><div class="eyebrow">MY LEARNER NOTE</div><p class="tiny">Saved only on this device. This is your personal rating, not a public aggregate.</p><div class="stars" data-stars="${c.id}">${[1,2,3,4,5].map(n=>`<button class="star ${n<=r.rating?'active':''}" data-rate="${n}" type="button" aria-label="Rate ${n} stars">★</button>`).join('')}</div><textarea id="reviewNote" placeholder="What did you learn? Was the certificate useful?">${esc(r.note)}</textarea><div class="detail-actions"><button class="secondary" id="saveReview" type="button">Save my note</button></div></div>`;
}

function openDetail(id){
  const c=byId(id);if(!c)return;detailCourseId=id;
  $('#detailTitle').textContent=c.title;
  const fresh=freshState(c),r=reviews[c.id]||{};
  $('#detailBody').innerHTML=`<div class="detail-hero"><div class="detail-copy"><div class="badges"><span class="badge ${fresh.cls}">${fresh.label}</span>${c.government?'<span class="badge gov">GOVERNMENT</span>':''}<span class="badge">${esc(c.category)}</span></div><p>${esc(c.desc)}</p><p class="tiny">Official source last curated: ${esc(c.verified)} · Availability: ${esc(c.region)} · Language: ${esc(c.language)}</p></div><div class="detail-meta"><div><small>Provider</small><b>${esc(c.provider)}</b></div><div><small>Duration</small><b>${esc(c.duration)}</b></div><div><small>Credential</small><b>${esc(c.credential)}</b></div><div><small>Credential type</small><b>${esc(c.strength)}</b></div><div><small>Level</small><b>${esc(c.level)}</b></div><div><small>Hands-on</small><b>${c.project?'Included / suggested':'Not required'}</b></div></div></div><div class="detail-actions"><a class="primary" href="${esc(c.url)}" target="_blank" rel="noopener">Open official course ↗</a><button class="secondary" data-detail-sprint="${c.id}" type="button">${sprint.includes(c.id)?'Remove from sprint':'Add to sprint'}</button><button class="secondary" data-complete="${c.id}" type="button">${completed.includes(c.id)?'✓ Completed':'Mark complete'}</button></div><div class="detail-actions"><button class="secondary" id="copyLinkedIn" type="button">Copy certificate details</button><a class="secondary" href="https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME" target="_blank" rel="noopener">Add to LinkedIn ↗</a></div><p class="tiny">LinkedIn’s current Add to Profile flow does not auto-fill third-party certificate details. “Copy certificate details” prepares the title, issuer and official URL for pasting.</p>${reviewMarkup(c)}`;
  if(!$('#detailDialog').open) $('#detailDialog').showModal();
}

async function copyText(txt){
  try{await navigator.clipboard.writeText(txt);return true}catch{
    const t=document.createElement('textarea');t.value=txt;document.body.appendChild(t);t.select();const ok=document.execCommand('copy');t.remove();return ok;
  }
}

function quizMatches(form){
  const goal=form.goal.value,max=Number(form.hours.value),pref=form.credential.value,reg=form.region.value,lvl=form.level.value;
  return courses.filter(c=>c.category===goal&&c.hours<=max&&(reg==='All'||c.region===reg)&&(pref==='Any'||c.strength===pref)).map(c=>({c,fit:c.score+(c.level===lvl?4:0)+(c.project?2:0)+(isNew(c)?1:0)})).sort((a,b)=>b.fit-a.fit).slice(0,5).map(x=>x.c);
}
function showQuizResults(list){
  const box=$('#quizResults');box.hidden=false;
  box.innerHTML=list.length?`<div class="eyebrow">BEST MATCHES</div>${list.map((c,i)=>`<div class="quiz-result"><div><b>${i+1}. ${esc(c.title)}</b><br><small>${esc(c.provider)} · ${esc(c.duration)} · ${esc(c.strength)}</small></div><button type="button" data-quiz-detail="${c.id}">View</button></div>`).join('')}`:'<p class="empty">No exact match under that time/credential combination. Try “Any useful credential” or a longer time window.</p>';
}

function sourceFallback(){
  const names=['Skill India Digital Hub','IBM SkillsBuild','HP LIFE','Simplilearn SkillUp','HubSpot Academy','Semrush Academy','Cisco Networking Academy','Kaggle Learn','NCS DigiSaksham','FutureSkills Prime'];
  $('#sourceRows').innerHTML=names.map(n=>`<div class="source-row"><div><b>${esc(n)}</b><small>Provider is on the weekly review list.</small></div><span class="status-ok">Tracked</span></div>`).join('');
}
function loadSources(){
  fetch('data/source-watch.json').then(r=>r.ok?r.json():Promise.reject()).then(d=>{
    const rows=d.sources||[],changed=rows.filter(x=>x.changed).length,failed=rows.filter(x=>x.status&&x.status!=='ok').length;
    $('#watchStatus').innerHTML=`<span class="pulse"></span><div><b>${changed?changed+' source'+(changed>1?'s':'')+' changed':'Official sources checked'}</b><small>Last automated check: ${esc(d.checked_at||'not yet run')}. ${failed?failed+' check(s) need attention.':changed?'Review changed sources before adding courses.':'No catalog changes were flagged.'}</small></div>`;
    if(rows.length) $('#sourceRows').innerHTML=rows.map(x=>`<div class="source-row"><div><b>${esc(x.name)}</b><small>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">Official source ↗</a>`:'Tracked provider'}</small></div><span class="${x.changed||x.status==='check_failed'?'status-warn':'status-ok'}">${x.status==='check_failed'?'Check failed':x.changed?'Changed':'OK'}</span></div>`).join(''); else sourceFallback();
  }).catch(()=>sourceFallback());
}

function download(name,text,type='application/json'){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
function exportProfile(){return JSON.stringify({version:2,exportedAt:new Date().toISOString(),favorites,sprint,completed,reviews},null,2)}
function updateAdminMetrics(){
  if(!$('#adminCourses'))return;
  $('#adminCourses').textContent=courses.length;$('#adminProviders').textContent=uniq(courses.map(c=>c.provider)).length;$('#adminFavorites').textContent=favorites.length;$('#adminCompleted').textContent=completed.length;
}

// Main catalog interactions
grid.addEventListener('click',e=>{
  const f=e.target.closest('[data-fav]'),s=e.target.closest('[data-sprint]'),d=e.target.closest('[data-detail]');
  if(f){const id=f.dataset.fav;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];persist();render()}
  if(s)addToSprint(s.dataset.sprint);
  if(d)openDetail(d.dataset.detail);
});
['input','change'].forEach(ev=>{search.addEventListener(ev,render);[category,duration,provider,region,level,sort].forEach(x=>x.addEventListener(ev,render))});
$('#govOnly').onclick=()=>{govOnly=!govOnly;$('#govOnly').classList.toggle('active',govOnly);render()};
$('#newOnly').onclick=()=>{newOnly=!newOnly;$('#newOnly').classList.toggle('active',newOnly);render()};
$('#favoritesOnly').onclick=()=>{favoritesOnly=!favoritesOnly;$('#favoritesOnly').classList.toggle('active',favoritesOnly);render()};
$('#resetFilters').onclick=()=>{search.value='';category.value=duration.value=provider.value=region.value=level.value='All';sort.value='score';govOnly=newOnly=favoritesOnly=false;['#govOnly','#newOnly','#favoritesOnly'].forEach(x=>$(x).classList.remove('active'));render()};
$$('[data-track]').forEach(b=>b.onclick=()=>{category.value=b.dataset.track;document.querySelector('#courses').scrollIntoView();render()});
$('#showGovernment').onclick=()=>{govOnly=true;$('#govOnly').classList.add('active');document.querySelector('#courses').scrollIntoView();render()};
$('#viewAllNew').onclick=()=>{newOnly=true;$('#newOnly').classList.add('active');document.querySelector('#courses').scrollIntoView();render()};

// Sprint
$('#openSprint').onclick=openSprint;
$('#sprintItems').addEventListener('click',e=>{const r=e.target.closest('[data-remove]');if(r){sprint=sprint.filter(x=>x!==r.dataset.remove);persist();render();openSprint()}});
$('#clearSprint').onclick=()=>{sprint=[];persist();render();openSprint()};
$('#copySprint').onclick=async()=>{const selected=sprint.map(byId).filter(Boolean);const txt=['My 7-Day SkillSprint',...selected.map((c,i)=>`Day ${i+1}: ${c.title} — ${c.duration} — ${c.url}`),`Total: ${Math.round(totalHours(sprint)*10)/10} hours`].join('\n');await copyText(txt);$('#copySprint').textContent='Copied ✓';setTimeout(()=>$('#copySprint').textContent='Copy plan',1300)};
$('#exportSprint').onclick=()=>{const selected=sprint.map(byId).filter(Boolean);download('my-skillsprint-plan.txt',['My 7-Day SkillSprint','',...selected.map((c,i)=>`Day ${i+1}: ${c.title}\nProvider: ${c.provider}\nDuration: ${c.duration}\n${c.url}\n`),`Total planned: ${Math.round(totalHours(sprint)*10)/10} hours`].join('\n'),'text/plain')};

// New cards / roadmaps
$('#newGrid').addEventListener('click',e=>{const d=e.target.closest('[data-detail]');if(d)openDetail(d.dataset.detail)});
$('#roadmapGrid').addEventListener('click',e=>{const r=e.target.closest('[data-roadmap]');if(r)addRoadmap(r.dataset.roadmap)});

// Quiz
const openQuiz=()=>{$('#quizResults').hidden=true;$('#quizDialog').showModal()};
$('#openQuiz').onclick=openQuiz;$('#startQuizHero').onclick=openQuiz;
$('#quizForm').addEventListener('submit',e=>{e.preventDefault();showQuizResults(quizMatches(e.currentTarget))});
$('#quizResults').addEventListener('click',e=>{const d=e.target.closest('[data-quiz-detail]');if(d){$('#quizDialog').close();openDetail(d.dataset.quizDetail)}});

// Detail / completion / notes / LinkedIn helper
$('#detailBody').addEventListener('click',async e=>{
  const s=e.target.closest('[data-detail-sprint]'),c=e.target.closest('[data-complete]'),rate=e.target.closest('[data-rate]');
  if(s){addToSprint(s.dataset.detailSprint);openDetail(s.dataset.detailSprint)}
  if(c){const id=c.dataset.complete;completed=completed.includes(id)?completed.filter(x=>x!==id):[...completed,id];persist();render();openDetail(id)}
  if(rate&&detailCourseId){reviews[detailCourseId]=reviews[detailCourseId]||{rating:0,note:''};reviews[detailCourseId].rating=Number(rate.dataset.rate);persist();openDetail(detailCourseId)}
  if(e.target.id==='saveReview'&&detailCourseId){reviews[detailCourseId]=reviews[detailCourseId]||{rating:0,note:''};reviews[detailCourseId].note=$('#reviewNote').value.trim();persist();e.target.textContent='Saved ✓';setTimeout(()=>e.target.textContent='Save my note',1300)}
  if(e.target.id==='copyLinkedIn'&&detailCourseId){const x=byId(detailCourseId);await copyText(`Certification: ${x.credential}\nCourse: ${x.title}\nIssuing organization: ${x.provider}\nCredential URL / provider course: ${x.url}`);e.target.textContent='Copied ✓';setTimeout(()=>e.target.textContent='Copy certificate details',1300)}
});

// Source radar + curator
$('#openSources').onclick=()=>$('#sourcesDialog').showModal();
$('#openCurator').onclick=()=>{updateAdminMetrics();$('#curatorDialog').showModal()};
$('#exportCatalog').onclick=()=>download('skillsprint-v2-catalog.json',JSON.stringify(courses,null,2));
$('#exportProfile').onclick=()=>download('skillsprint-my-learning-data.json',exportProfile());
$('#importProfile').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);favorites=Array.isArray(d.favorites)?d.favorites:[];sprint=Array.isArray(d.sprint)?d.sprint:[];completed=Array.isArray(d.completed)?d.completed:[];reviews=d.reviews&&typeof d.reviews==='object'?d.reviews:{};persist();render();updateAdminMetrics();alert('Learning data imported.')}catch{alert('That file is not a valid SkillSprint learning-data export.')}};r.readAsText(f)});
$('#clearProfile').onclick=()=>{if(confirm('Clear favorites, sprint, completed courses and personal notes from this device?')){favorites=[];sprint=[];completed=[];reviews={};persist();render();updateAdminMetrics()}};

// PWA install
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#installApp').hidden=false});
$('#installApp').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#installApp').hidden=true};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

metrics();miniNew();renderRoadmaps();loadSources();render();
