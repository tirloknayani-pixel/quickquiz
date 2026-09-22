
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";
const publicDir = path.join(__dirname, "public");
const rooms = new Map();

const QUESTIONS = [
  { q:"Which planet is known as the Red Planet?", a:["Venus","Mars","Jupiter","Mercury"], c:1 },
  { q:"What is 8 × 7?", a:["54","56","64","48"], c:1 },
  { q:"Which ocean is the largest?", a:["Atlantic","Indian","Pacific","Arctic"], c:2 },
  { q:"How many sides does a hexagon have?", a:["5","6","7","8"], c:1 },
  { q:"Which animal is known as the fastest land animal?", a:["Lion","Cheetah","Horse","Leopard"], c:1 },
  { q:"What gas do plants mainly absorb from the air?", a:["Oxygen","Nitrogen","Carbon dioxide","Hydrogen"], c:2 },
  { q:"Which country is famous for the pyramids of Giza?", a:["Greece","Egypt","Mexico","Peru"], c:1 },
  { q:"What is the largest mammal?", a:["Elephant","Giraffe","Blue whale","Hippopotamus"], c:2 },
  { q:"Which shape has three sides?", a:["Square","Triangle","Circle","Pentagon"], c:1 },
  { q:"What is the boiling point of water at sea level in °C?", a:["50","90","100","120"], c:2 }
];

function send(res, code, body, type="text/plain") {
  res.writeHead(code, {"Content-Type": type});
  res.end(body);
}

const server = http.createServer((req,res) => {
  let url = new URL(req.url, `http://${req.headers.host}`);
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const safe = path.normalize(file).replace(/^(\.\.[\/\\])+/, "");
  const full = path.join(publicDir, safe);
  if (!full.startsWith(publicDir)) return send(res,403,"Forbidden");
  fs.readFile(full, (err,data) => {
    if (err) return send(res,404,"Not found");
    const ext = path.extname(full);
    const types = {".html":"text/html",".js":"text/javascript",".css":"text/css"};
    send(res,200,data,types[ext] || "application/octet-stream");
  });
});

const clients = new Map();

function roomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: [...room.players.values()].map(p => ({id:p.id, name:p.name, score:p.score})),
    started: room.started,
    questionIndex: room.questionIndex,
    question: room.started ? {
      number: room.questionIndex + 1,
      total: QUESTIONS.length,
      text: QUESTIONS[room.questionIndex].q,
      answers: QUESTIONS[room.questionIndex].a,
      endsAt: room.endsAt
    } : null,
    finished: room.finished,
    leaderboard: room.finished
      ? [...room.players.values()].sort((a,b)=>b.score-a.score).map((p,i)=>({rank:i+1,name:p.name,score:p.score}))
      : null
  };
}

function broadcast(room) {
  const payload = JSON.stringify({type:"state", state:roomState(room)});
  for (const p of room.players.values()) {
    const c = clients.get(p.id);
    if (c) c.write(`data: ${payload}\n\n`);
  }
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function startRoom(room) {
  room.started = true;
  room.finished = false;
  room.questionIndex = 0;
  room.answers = new Map();
  room.endsAt = Date.now() + 15000;
  broadcast(room);
  setTimeout(() => timeUp(room), 15100);
}

function timeUp(room) {
  if (!room.started || room.finished || Date.now() < room.endsAt) return;
  nextQuestion(room);
}

function nextQuestion(room) {
  if (room.questionIndex >= QUESTIONS.length - 1) {
    room.finished = true;
    room.started = false;
    broadcast(room);
    return;
  }
  room.questionIndex++;
  room.answers = new Map();
  room.endsAt = Date.now() + 15000;
  broadcast(room);
  setTimeout(() => timeUp(room), 15100);
}

function answer(room, player, choice) {
  if (!room.started || room.finished || room.answers.has(player.id)) return;
  const q = QUESTIONS[room.questionIndex];
  const elapsed = Math.max(0, Date.now() - (room.endsAt - 15000));
  if (choice === q.c) {
    const speedBonus = Math.max(0, Math.round(50 * (1 - Math.min(elapsed,15000)/15000)));
    player.score += 100 + speedBonus;
  }
  room.answers.set(player.id, choice);
  broadcast(room);
  if (room.answers.size === room.players.size) setTimeout(() => nextQuestion(room), 700);
}

server.on("upgrade", (req,socket) => {
  // Minimal SSE-based multiplayer server; reject unsupported upgrades.
  socket.end("HTTP/1.1 426 Upgrade Required\r\n\r\n");
});

// SSE + JSON API keeps the first version dependency-free.
server.on("request", (req,res) => {
  if (req.url.startsWith("/events")) {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const code = (u.searchParams.get("room") || "").toUpperCase();
    const id = u.searchParams.get("id");
    const room = rooms.get(code);
    if (!room || !id) return send(res,404,"Room not found");
    const player = room.players.get(id);
    if (!player) return send(res,404,"Player not found");
    res.writeHead(200, {"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive","Access-Control-Allow-Origin":"*"});
    clients.set(id,res);
    res.write(`data: ${JSON.stringify({type:"state",state:roomState(room)})}\n\n`);
    req.on("close",()=>clients.delete(id));
    return;
  }

  if (req.method === "POST" && req.url === "/api/create") {
    const id = crypto.randomUUID();
    const code = makeCode();
    const room = {code,hostId:id,players:new Map(),started:false,finished:false,questionIndex:0,answers:new Map(),endsAt:0};
    room.players.set(id,{id,name:"Host",score:0});
    rooms.set(code,room);
    return send(res,200,JSON.stringify({code,id}),"application/json");
  }

  if (req.method === "POST" && req.url === "/api/join") {
    let body="";
    req.on("data",c=>body+=c);
    req.on("end",()=>{
      try {
        const {code,name} = JSON.parse(body);
        const room = rooms.get(String(code||"").toUpperCase());
        const clean = String(name||"").trim().slice(0,18);
        if (!room) return send(res,404,JSON.stringify({error:"Room not found"}),"application/json");
        if (room.started) return send(res,409,JSON.stringify({error:"Game already started"}),"application/json");
        if (room.players.size >= 6) return send(res,409,JSON.stringify({error:"Room is full"}),"application/json");
        if (!clean) return send(res,400,JSON.stringify({error:"Nickname required"}),"application/json");
        if ([...room.players.values()].some(p=>p.name.toLowerCase()===clean.toLowerCase()))
          return send(res,409,JSON.stringify({error:"Nickname already used"}),"application/json");
        const id=crypto.randomUUID();
        room.players.set(id,{id,name:clean,score:0});
        broadcast(room);
        send(res,200,JSON.stringify({code:room.code,id}),"application/json");
      } catch { send(res,400,JSON.stringify({error:"Invalid request"}),"application/json"); }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/action") {
    let body="";
    req.on("data",c=>body+=c);
    req.on("end",()=>{
      try {
        const {code,id,action,choice} = JSON.parse(body);
        const room=rooms.get(String(code||"").toUpperCase());
        if (!room) return send(res,404,JSON.stringify({error:"Room not found"}),"application/json");
        const player=room.players.get(id);
        if (!player) return send(res,403,JSON.stringify({error:"Player not found"}),"application/json");
        if (action==="start") {
          if (room.hostId!==id) return send(res,403,JSON.stringify({error:"Only the host can start"}),"application/json");
          if (room.players.size<2) return send(res,400,JSON.stringify({error:"Need at least 2 players"}),"application/json");
          startRoom(room);
        } else if (action==="answer") {
          answer(room,player,Number(choice));
        } else if (action==="again") {
          if (room.hostId!==id) return send(res,403,JSON.stringify({error:"Only the host can restart"}),"application/json");
          for (const p of room.players.values()) p.score=0;
          startRoom(room);
        }
        send(res,200,JSON.stringify({ok:true}),"application/json");
      } catch { send(res,400,JSON.stringify({error:"Invalid request"}),"application/json"); }
    });
    return;
  }
});

server.listen(PORT, HOST, ()=>console.log(`Quiz game listening on ${HOST}:${PORT}`));
