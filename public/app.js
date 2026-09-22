
let me=null, room=null, eventSource=null, timer=null;
const $=id=>document.getElementById(id);
function show(id){document.querySelectorAll(".screen").forEach(x=>x.classList.add("hidden"));$(id).classList.remove("hidden")}
async function api(action, data={}) {
  const r=await fetch("/api/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  const j=await r.json(); if(!r.ok) throw new Error(j.error||"Something went wrong"); return j;
}
function connect(code,id){
  eventSource?.close();
  eventSource=new EventSource(`/events?room=${encodeURIComponent(code)}&id=${encodeURIComponent(id)}`);
  eventSource.onmessage=e=>render(JSON.parse(e.data).state);
}
function render(s){
  room=s;
  if(s.finished){ renderResults(s); return; }
  if(!s.started){ renderLobby(s); return; }
  renderQuiz(s);
}
function renderLobby(s){
  show("lobby"); $("roomCode").textContent=s.code;
  $("playerCount").textContent=`(${s.players.length}/6)`;
  $("players").innerHTML=s.players.map(p=>`<div class="player"><span>${escapeHtml(p.name)}${p.id===s.hostId?" 👑":""}</span><span>${p.score}</span></div>`).join("");
  $("startBtn").style.display=me.id===s.hostId?"block":"none";
}
function renderQuiz(s){
  show("quiz");
  const p=s.players.find(x=>x.id===me.id); $("myScore").textContent=p?.score??0;
  $("progress").textContent=`Question ${s.question.number} / ${s.question.total}`;
  $("qnum").textContent=`Question ${s.question.number}`;
  $("question").textContent=s.question.text;
  $("answers").innerHTML=s.question.answers.map((a,i)=>`<button class="answer" onclick="submitAnswer(${i})">${String.fromCharCode(65+i)}. ${escapeHtml(a)}</button>`).join("");
  $("waiting").classList.add("hidden");
  startTimer(s.question.endsAt);
}
function startTimer(end){
  clearInterval(timer);
  const tick=()=>{
    const left=Math.max(0,end-Date.now()), pct=Math.max(0,left/15000)*100;
    $("timerBar").style.width=pct+"%";
    if(left<=0) clearInterval(timer);
  }; tick(); timer=setInterval(tick,50);
}
async function submitAnswer(choice){
  document.querySelectorAll(".answer").forEach(b=>{b.disabled=true;b.classList.add("disabled")});
  $("waiting").classList.remove("hidden");
  try{await api("action",{code:room.code,id:me.id,action:"answer",choice})}catch(e){$("error").textContent=e.message}
}
function renderResults(s){
  clearInterval(timer); show("results");
  const medals=["🥇","🥈","🥉"];
  $("leaderboard").innerHTML=s.leaderboard.map(p=>`<div class="rank"><span class="medal">${medals[p.rank-1]||p.rank}</span><span class="rname">${escapeHtml(p.name)}</span><span class="rscore">${p.score} pts</span></div>`).join("");
  $("againBtn").style.display=me.id===s.hostId?"block":"none";
}
function escapeHtml(x){return String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
$("createBtn").onclick=async()=>{
  $("error").textContent="";
  try{
    const j=await api("create"); me={id:j.id,name:"Host"}; room={code:j.code}; 
    $("roomInput").value=j.code; $("nameInput").value="Host"; 
    connect(j.code,j.id);
  }catch(e){$("error").textContent=e.message}
};
$("joinBtn").onclick=async()=>{
  $("error").textContent="";
  try{
    const name=$("nameInput").value.trim(), code=$("roomInput").value.trim().toUpperCase();
    const j=await api("join",{code,name}); me={id:j.id,name}; connect(j.code,j.id);
  }catch(e){$("error").textContent=e.message}
};
$("startBtn").onclick=async()=>{try{await api("action",{code:room.code,id:me.id,action:"start"})}catch(e){$("lobbyError").textContent=e.message}};
$("againBtn").onclick=async()=>{try{await api("action",{code:room.code,id:me.id,action:"again"})}catch(e){alert(e.message)}};
