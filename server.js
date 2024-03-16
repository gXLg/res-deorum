const express = require("express");
const https = require("https");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const { randomUUID } = require("crypto");
const { EventEmitter } = require("events");
const os = require("os");

const app = express();

const httpServer = http.createServer(app);

const cred = {
  "key": fs.readFileSync("../certs/kemuri.life/privkey.pem", "utf8"),
  "cert": fs.readFileSync("../certs/kemuri.life/fullchain.pem", "utf8")
};
const httpsServer = https.createServer(cred, app);


function ready(ty, p){
  console.log(ty, "server started!");
  const n = os.networkInterfaces();
  console.log("Local IPs:");
  for(const int in n){
    const nt = n[int];
    console.log("*", nt.map(t => ty + "://" + t.address + ":" + p).join(" | "));
  }
}

httpsServer.listen(11069, () => ready("https", 11069));
httpServer.listen(11269, () => ready("http", 11269));

const io = new Server({ "cors": { "origin": "*" } });
io.attach(httpServer);
io.attach(httpsServer);

function getCards(n, elements){

  const EL = [
    "ignis", "aqua", "aer", "terra", "vita"
  ];
  const el = elements.filter(
    e => EL.includes(e)
  );

  function get(){
    const r = Math.floor(Math.random() * 100);
    if(r < 12 + 22 * 0) return "vita";
    if(r < 12 + 22 * 1) return "ignis";
    if(r < 12 + 22 * 2) return "aqua";
    if(r < 12 + 22 * 3) return "aer";
    if(r < 12 + 22 * 4) return "terra";
  }

  const c = { };
  el.forEach(e => c[e] = el.filter(i => i == e).length);

  const a = [...Array(n)].map(() => {
    while(true){
      const e = get();
      if(!c[e]) return e;
      c[e] --;
    }
  });
  return n == 1 ? a[0] : a;
}

const free = { };
const games = { };
const rooms = { };
const ids = { };

const online = new Set();

io.on("connection", async socket => {
  console.log("Connected", socket.id);
  socket.on("disconnect", () => {
    const room = rooms[socket.id];
    if(room in free){
      const index = free[room].indexOf(socket);
      if(~index) free[room].splice(index, 1);
    }
    delete rooms[socket.id];
    delete ids[socket.id];
    console.log("Disconnected", socket.id);
  });

  socket.on("first", () => {
    socket.emit("uuid", randomUUID());
  });

  socket.on("login", (uuid, room) => theGame(socket, uuid, room ?? ""));
});

async function theGame(socket, uuid, room){

  if(online.has(uuid)){
    socket.disconnect();
    return;
  }
  online.add(uuid);
  socket.on("disconnect", () => online.delete(uuid));

  rooms[socket.id] = room;
  ids[socket.id] = uuid;

  if(uuid in games){
    console.log(uuid, "rejoined");
    games[uuid].emit("rejoin", socket);
    return;
  } else {
    console.log(uuid, "joined" + (room == "" ? room : " in " + room));
  }

  if(!(room in free)) free[room] = [];
  if(!free[room].length) free[room].push(socket);
  else {

    const oppo = free[room].pop();
    const ouuid = ids[oppo.id];
    const con = { oppo, socket };

    let turn = Math.floor(Math.random() * 2);
    let comed = false;

    const comm = [];
    const game = {
      "oppo": {
        "hp": 50,
        "buf": [],
        "deb": [],
        "cards": getCards(5, []).map(c => [c, "res", ""]),
        "tab": [],
        "log": [],
        "dmg": []
      },
      "socket": {
        "hp": 50,
        "buf": [],
        "deb": [],
        "cards": getCards(5, []).map(c => ["res", c, ""]),
        "tab": [],
        "log": [],
        "dmg": []
      }
    };

    con.socket = socket;
    registerSocket();
    con.oppo = oppo;
    registerOppo();
    update();

    function update(){
      const t = ["oppo", "socket"];
      for(let i = 0; i < 2; i ++){
        const you = t[i];
        const opp = t[1 - i];

        const com = comm.map(j => j[2] + j[i]);

        const you_hp = game[you].hp;
        const you_buf = game[you].buf.map(j => j[2] + j[i]);
        const you_debuf = game[you].deb.map(j => j[2] + j[i]);
        const you_cards = game[you].cards.map(j => j[2] + j[i]);
        const you_tab = game[you].tab.map(j => j[2] + j[i]);

        const oppo_hp = game[opp].hp;
        const oppo_buf = game[opp].buf.map(j => j[2] + j[i]);
        const oppo_debuf = game[opp].deb.map(j => j[2] + j[i]);
        const oppo_cards = game[opp].cards.map(j => j[2] + j[i]);
        const oppo_tab = game[opp].tab.map(j => j[2] + j[i]);

        const you_log = game[you].log[i];
        const you_dmg = game[you].dmg.map(j => j[i]);
        const oppo_log = game[opp].log[i];
        const oppo_dmg = game[opp].dmg.map(j => j[i]);

        [con.oppo, con.socket][i].emit("update", {
          com, you_hp, you_buf, you_debuf, you_cards, you_tab,
          oppo_hp, oppo_buf, oppo_debuf, oppo_cards, oppo_tab,
          you_log, oppo_log, you_dmg, oppo_dmg
        });
      }
      [con.oppo, con.socket][turn].emit("you");
      [con.oppo, con.socket][1 - turn].emit("oppo");
    }

    function reduce(){
      const t = ["oppo", "socket"][turn];

      for(const debuf of game[t].deb){
        const n = parseInt(debuf[1 - turn].match(/\d+/)[0]) - 1;
        const ef = debuf[1 - turn].match(/[A-Z][a-z]+/)[0];
        if(ef == "Nebula"){
          continue;
        }

        if(!n) game[t].deb = game[t].deb.filter(b => !b[1 - turn].includes(ef));
        else {
          debuf[1 - turn] = ef + " " + n;
          if(debuf[2] == "") debuf[turn] = debuf[1 - turn];
        }
        if(ef == "Lutum"){
          continue;
        }

        const nebula = game[t].deb.find(b => b[1 - turn].match(/Nebula/));
        if(nebula){
          const n = parseInt(nebula[1 - turn].match(/\d+/)[0]) - 1;
          if(!n) game[y].deb = game[t].deb.filter(b => !b[1 - turn].match(/Nebula/));
          else {
            nebula[1 - turn] = "Nebula " + n;
            if(nebula[2] == "") nebula[turn] = nebula[1 - turn];
          }
          if(Math.floor(Math.random() * 100) < 70){
            const d = ["-3HP (" + ef + ")", "-3HP (" + ef + ")"];
            if(debuf[2] == "?") d[turn] = "???";
            game[t].dmg.push(d);
            game[t].hp = Math.max(game[t].hp - 3, 0);
          }
        } else {
          let dis = false;
          let dec;
          if(ef == "Aer" && game[t].buf.some(b => b[turn].match(/Ignis/))){
            dis = true;
            dec = "Ignis";
          } else if(ef == "Aqua" && game[t].buf.some(b => b[turn].match(/Terra/))){
            dis = true;
            dec = "Terra";
          } else if(ef == "Ignis" && game[t].buf.some(b => b[turn].match(/Aqua/))){
            dis = true;
            dec = "Aqua";
          } else if(ef == "Terra" && game[t].buf.some(b => b[turn].match(/Aer/))){
            dis = true;
            dec = "Aer";
          }
          if(dis){
            const resist = game[t].buf.find(b => b[1 - turn].includes(dec));
            const n = parseInt(resist[turn].match(/\d+/)[0]) - 1;
            if(!n) game[t].buf = game[t].buf.filter(b => !b[turn].includes(dec));
            else {
              resist[turn] = dec + " " + n;
              if(resist[2] == "") resist[1 - turn] = resist[turn];
            }
          } else {
            const d = ["-3HP (" + ef + ")", "-3HP (" + ef + ")"];
            if(debuf[2] == "?") d[turn] = "-3HP (???)";
            game[t].dmg.push(d);
            game[t].hp = Math.max(game[t].hp - 3, 0);
          }
        }
      }
      const nebula = game[t].buf.find(b => b[turn].match(/Nebula/));
      if(nebula){
        const n = parseInt(nebula[turn].match(/\d+/)[0]) - 1;
        if(!n) game[t].buf = game[t].buf.filter(b => !b[turn].match(/Nebula/));
        else {
          nebula[turn] = "Nebula " + n;
          if(nebula[2] == "") nebula[1 - turn] = nebula[turn];
        }
      }
    }

    function upp(word){
      return word[0].toUpperCase() + word.slice(1);
    }

    function unk(word){
      return word == "res" ? "???" : upp(word);
    }

    async function step(data){
      if(data.length != 3) return false;

      const [from, to, loc] = data;
      const t = ["oppo", "socket"][turn];
      const y = ["oppo", "socket"][1 - turn];

      if(!(from >= 0 && from <= 5)) return false;

      const nebula = game[t].buf.find(b => b[turn].match(/Nebula/));
      const lutum = game[t].deb.find(b => b[turn].match(/Lutum/));

      const newc = ["res", "res", ""];
      newc[turn] = getCards(1, game[t].cards.map(c => c[turn]));

      if(to == "com"){
        if(comed) return false;
        if(loc == null){
          if(comm.length == 5) return false;
          const card = game[t].cards.splice(from, 1)[0];
          if(nebula) card[2] = "?";
          else {
            card[1 - turn] = card[turn];
            card[2] = "";
          }
          comm.push(card);
          game[t].cards.push(newc);

          game[t].log = [
            unk(card[0]) + " > Commutatio",
            unk(card[1]) + " > Commutatio"
          ];
          game[t].dmg = [];
          game[y].dmg = [];

          comed = true;
          update();
          return false;
        } else {
          if(loc >= comm.length) return false;
          const com = comm[loc];
          if(com[2] == "?"){
            if(com[turn] == "res"){
              com[turn] = com[1 - turn];
              com[2] = "";
            }
          }
          const card = game[t].cards.splice(from, 1, com)[0];
          if(nebula) card[2] = "?";
          else {
            card[1 - turn] = card[turn];
            card[2] = "";
          }
          comm[loc] = card;

          game[t].log = [
            unk(card[0]) + " > Commutatio > " + unk(com[0]),
            unk(card[1]) + " > Commutatio > " + unk(com[1])
          ];
          game[t].dmg = [];
          game[y].dmg = [];

          comed = true;
          update();
          return false;
        }
      } else if(to == "tab"){

        if(lutum) return false;
        if(game[t].tab.length == 0){
          const l = game[t].cards[from][turn];
          if(!["aer", "aqua", "ignis", "terra", "vita"].includes(l)) return false;

          const card = game[t].cards.splice(from, 1)[0];
          if(nebula) card[2] = "?";
          else {
            card[1 - turn] = card[turn];
            card[2] = "";
          }
          game[t].tab.push(card);
          game[t].cards.push(newc);

          game[t].log = [
            unk(card[0]) + " > Tabula Alchimiae",
            unk(card[1]) + " > Tabula Alchimiae"
          ];
          game[t].dmg = [];
          game[y].dmg = [];

          return true;
        } else if (game[t].tab.length == 1){
          const [l, r] = [game[t].tab[0][turn], game[t].cards[from][turn]];
          if(l == r && l != "vita") return false;
          if(!["aer", "aqua", "ignis", "terra", "vita"].includes(r)) return false;

          const card = game[t].cards.splice(from, 1)[0];
          if(nebula) card[2] = "?";
          else {
            card[1 - turn] = card[turn];
            card[2] = "";
          }
          game[t].tab.push(card);
          update();
          await new Promise(r => setTimeout(r, 1200));

          const both = [l, r].sort().join(" ");
          const newneb = game[t].tab.some(c => c[2] == "?");

          let n;
          if(both == "aer ignis") n = "fulgur";
          else if(both == "aer terra") n = "tempestas";
          else if(both == "aer vita") n = "mediocris";
          else if(both == "aer aqua") n = "nebula";
          else if(both == "aqua ignis") n = "vapor";
          else if(both == "aqua vita") n = "syrena";
          else if(both == "aqua terra") n = "lutum";
          else if(both == "ignis terra") n = "tremor";
          else if(both == "ignis vita") n = "phoenix";
          else if(both == "terra vita") n = "colossus";
          else if(both == "vita vita") n = "lumen";

          const newc = ["res", "res", ""];
          newc[turn] = n;
          if(newneb || nebula) newc[2] = "?";
          else newc[1 - turn] = n;

          game[t].tab = [];
          game[t].cards.push(newc);

          if(!nebula && card[2] != "?") card[1 - turn] = card[turn];
          game[t].log = [
            unk(card[0]) + " > Tabula Alchimiae > " + unk(newc[0]),
            unk(card[1]) + " > Tabula Alchimiae > " + unk(newc[1])
          ];
          game[t].dmg = [];
          game[y].dmg = [];

          return true;
        }
      } else if(to == "you"){

        const card = game[t].cards.splice(from, 1)[0];
        const l = card[turn];
        let ef = l;
        let len = 1;
        if(l == "fulgur") ef = "ignis";
        else if(l == "tempestas") ef = "aer";
        else if(l == "vapor") ef = "aqua";
        else if(l == "tremor") ef = "terra";
        else if(l == "nebula") len = 3;
        else if(l == "lumen"){ ef = "vita"; len = 3; }
        else if(l == "mediocris"){ ef = "aer"; len = 3; }
        else if(l == "phoenix"){ ef = "ignis"; len = 3; }
        else if(l == "syrena"){ ef = "aqua"; len = 3; }
        else if(l == "colossus"){ ef = "terra"; len = 3; }

        game[t].cards.push(newc);

        if(ef == "vita"){
          game[t].hp = Math.min(game[t].hp + 3 * len, 50);

          game[t].dmg = [[
            "+" + (3 * len) + "HP",
            "+" + (3 * len) + "HP"
          ]];
          game[y].dmg = [];

          if(!nebula && card[2] != "?") card[1 - turn] = card[turn];
          game[t].log = [
            unk(card[0]) + " > BUF",
            unk(card[1]) + " > BUF"
          ];

          return true;
        }

        ef = upp(ef);
        const effect = game[t].buf.find(b => b[turn].includes(ef));
        if(effect){
          const n = parseInt(effect[turn].match(/\d+/)[0]) + len;
          effect[turn] = ef + " " + n;
          if(nebula || card[2] == "?"){
            effect[2] = "?";
            effect[1 - turn] = "???";
          } else effect[2] = "";
          if(effect[2] == "") effect[1 - turn] = effect[turn];
        } else {
          const eff = [ef + " " + len, ef + " " + len, ""];
          if(nebula || card[2] == "?"){
            eff[2] = "?";
            eff[1 - turn] = "???";
          }
          game[t].buf.push(eff);
        }

        if(!nebula && card[2] != "?") card[1 - turn] = card[turn];
        game[t].log = [
          unk(card[0]) + " > BUF",
          unk(card[1]) + " > BUF"
        ];
        game[t].dmg = [];
        game[y].dmg = [];

        return true;
      } else if(to == "oppo"){

        const card = game[t].cards.splice(from, 1)[0];
        const l = card[turn];
        let ef = l;
        let len = 1;
        let str = 2;
        if(l == "fulgur"){ ef = "ignis"; str = 8; }
        else if(l == "tempestas"){ ef = "aer"; str = 8; }
        else if(l == "vapor"){ ef = "aqua"; str = 8; }
        else if(l == "tremor"){ ef = "terra"; str = 8; }
        else if(l == "vita") str = 1;
        else if(l == "lutum") len = 2;
        else if(l == "lumen"){ ef = "vita"; str = 4; }
        else if(l == "mediocris"){ ef = "aer"; len = 3; }
        else if(l == "phoenix"){ ef = "ignis"; len = 3; }
        else if(l == "syrena"){ ef = "aqua"; len = 3; }
        else if(l == "colossus"){ ef = "terra"; len = 3; }

        game[t].cards.push(newc);

        if(ef == "vita"){
          game[y].hp = Math.max(game[y].hp - str, 0);

          game[y].dmg = [[
            "-" + str + "HP (vita)",
            "-" + str + "HP (vita)"
          ]];
          game[t].dmg = [];

          game[t].log = [
            unk(card[turn]) + " > DEBUF",
            unk(card[turn]) + " > DEBUF"
          ];

          return true;
        }

        if(ef == "nebula"){
          const effect = game[y].deb.find(b => b[turn].match(/Nebula/));
          if(effect){
            const n = parseInt(effect[turn].match(/\d+/)[0]) + len;
            effect[turn] = ef + " " + n;
            if(nebula || card[2] == "?"){
              effect[2] = "?";
              effect[1 - turn] = "???";
            } else effect[2] = "";
            if(effect[2] == "") effect[1 - turn] = effect[turn];
          } else {
            const eff = ["Nebula " + len, "Nebula " + len, ""];
            if(nebula){
              eff[2] = "?";
              eff[1 - turn] = "???";
            }
            game[y].deb.push(eff);
          }

          game[t].dmg = [];
          game[y].dmg = [];

          if(!nebula && card[2] != "?") card[1 - turn] = card[turn];
          game[t].log = [
            unk(card[0]) + " > DEBUF",
            unk(card[1]) + " > DEBUF"
          ];

          return true;
        }
        if(ef == "lutum"){
          const effect = game[y].deb.find(b => b[turn].match(/Lutum/));
          if(effect){
            const n = parseInt(effect[turn].match(/\d+/)[0]) + len;
            effect[turn] = ef + " " + n;
            if(nebula || card[2] == "?"){
              effect[2] = "?";
              effect[1 - turn] = "???";
            } else effect[2] = "";
            if(effect[2] == "") effect[1 - turn] = effect[turn];
          } else {
            const eff = ["Lutum " + len, "Lutum " + len, ""];
            if(nebula || card[2] == "?"){
              eff[2] = "?";
              eff[1 - turn] = "???";
            }
            game[y].deb.push(eff);
          }

          game[t].dmg = [];
          game[y].dmg = [];

          if(!nebula && card[2] != "?") card[1 - turn] = card[turn];
          game[t].log = [
            unk(card[0]) + " > DEBUF",
            unk(card[1]) + " > DEBUF"
          ];

          return true;
        }

        game[t].dmg = [];
        game[y].dmg = [];
        if(!nebula && card[2] != "?") card[1 - turn] = card[turn];
        game[t].log = [
          unk(card[0]) + " > DEBUF",
          unk(card[1]) + " > DEBUF"
        ];

        const lutum = game[y].buf.find(b => b[1 - turn].match(/Lutum/));
        if(lutum){
          const n = parseInt(lutum[1 - turn].match(/\d+/)[0]) - 1;
          if(!n) game[y].buf = game[y].buf.filter(b => !b[1 - turn].match(/Lutum/));
          else {
            lutum[1 - turn] = "Lutum " + n;
            if(lutum[2] == "") lutum[turn] = lutum[1 - turn];
          }
          if(len > 1 || str > 2)
            return true;
        }

        if(len == 1){
          const nebula = game[y].deb.find(b => b[turn].match(/Nebula/));
          if(nebula){
            const n = parseInt(nebula[turn].match(/\d+/)[0]) - 1;
            if(!n) game[y].deb = game[y].deb.filter(b => !b[turn].match(/Nebula/));
            else {
              nebula[turn] = "Nebula " + n;
              if(nebula[2] == "") nebula[1 - turn] = nebula[turn];
            }
          } else {
            let dis = false;
            let dec;
            if(ef == "aer" && game[y].buf.some(b => b[1 - turn].match(/Ignis/))){
              dis = true;
              dec = "Ignis";
            } else if(ef == "aqua" && game[y].buf.some(b => b[1 - turn].match(/Terra/))){
              dis = true;
              dec = "Terra";
            } else if(ef == "ignis" && game[y].buf.some(b => b[1 - turn].match(/Aqua/))){
              dis = true;
              dec = "Aqua";
            } else if(ef == "terra" && game[y].buf.some(b => b[1 - turn].match(/Aer/))){
              dis = true;
              dec = "Aer";
            }
            if(dis){
              const resist = game[y].buf.find(b => b[1 - turn].includes(dec));
              const n = parseInt(resist[1 - turn].match(/\d+/)[0]) - 1;
              if(!n) game[y].buf = game[y].buf.filter(b => !b[1 - turn].includes(dec));
              else {
                resist[1 - turn] = dec + " " + n;
                if(resist[2] == "") resist[turn] = resist[1 - turn];
              }
              return true;
            }
          }

          game[t].dmg = [];
          game[y].dmg = [[
            "-" + str + "HP (" + unk(card[0]) + ")",
            "-" + str + "HP (" + unk(card[1]) + ")"
          ]];

          game[y].hp = Math.max(game[y].hp - str, 0);
          return true;
        }

        ef = upp(ef);
        const effect = game[y].deb.find(b => b[turn].includes(ef));
        if(effect){
          const n = parseInt(effect[turn].match(/\d+/)[0]) + len;
          effect[turn] = ef + " " + n;
          if(nebula || card[2] == "?"){
            effect[2] = "?";
            effect[1 - turn] = "???";
          } else effect[2] = "";
          if(effect[2] == "") effect[1 - turn] = effect[turn];
        } else {
          const eff = [ef + " " + len, ef + " " + len, ""];
          if(nebula || card[2] == "?"){
            eff[2] = "?";
            eff[1 - turn] = "???";
          }
          game[y].deb.push(eff);
        }
        return true;

      }
    }

    let working = false;
    let left = false;

    function registerSocket(){
      delete games[uuid];

      con.socket.emit("game");

      con.socket.on("leave", () => {
        left = true;
        delete games[ouuid];
        delete games[uuid];
        exit();
      });

      con.socket.on("disconnect", () => {
        if(games[ouuid] || left){
          delete games[ouuid];
          exit();
        } else {
          games[uuid] = new EventEmitter();
          games[uuid].on("rejoin", (socket) => {
            con.socket = socket;
            registerSocket();
            update();
          });
          con.oppo.emit("left");
        }
      });
      con.socket.on("turn", async data => {
        if(working) return;
        if(turn == 0) return;

        working = true;
        const succ = await step(data);
        working = false;
        if(!succ) return;

        comed = false;
        reduce();
        turn = 0;
        update();

        if(game.oppo.hp == 0){
          con.oppo.emit("lose");
          con.socket.emit("win");
          exit();
          return;
        }
        if(game.socket.hp == 0){
          con.oppo.emit("win");
          con.socket.emit("lose");
          exit();
          return;
        }
      });
    }

    function registerOppo(){
      delete games[ouuid];

      con.oppo.emit("game");

      con.oppo.on("leave", () => {
        left = true;
        delete games[ouuid];
        delete games[uuid];
        exit();
      });

      con.oppo.on("disconnect", () => {
        if(games[uuid] || left){
          delete games[uuid];
          exit();
        } else {
          games[ouuid] = new EventEmitter();
          games[ouuid].on("rejoin", (oppo) => {
            con.oppo = oppo;
            registerOppo();
            update();
          });
          con.socket.emit("left");
        }
      });
      con.oppo.on("turn", async data => {
        if(working) return;
        if(turn == 1) return;

        working = true;
        const succ = await step(data);
        working = false;
        if(!succ) return;

        comed = false;
        reduce();
        turn = 1;
        update();

        if(game.oppo.hp == 0){
          con.oppo.emit("lose");
          con.socket.emit("win");
          exit();
          return;
        }
        if(game.socket.hp == 0){
          con.oppo.emit("win");
          con.socket.emit("lose");
          exit();
          return;
        }
      });
    }

    function exit(){
      con.oppo.disconnect(true);
      con.socket.disconnect(true);
    }
  }
}

let ctrlC = false;
process.on("SIGINT", async () => {
  if(ctrlC) return;
  ctrlC = true;

  console.log("\rStopping...");

  httpServer.close();
  httpsServer.close();

  io.close();

});
