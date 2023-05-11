const express = require("express");
const https = require("https");
const { Server } = require("socket.io");
const fs = require("fs");
const { randomUUID } = require("crypto");
const { EventEmitter } = require("events");

const cred = {
  "key": fs.readFileSync("./cert/privkey.pem", "utf8"),
  "cert": fs.readFileSync("./cert/fullchain.pem", "utf8")
};

const app = express();

const server = https.createServer(cred, app);
const io = new Server(server, { "cors": { "origin": "*" } });

function getCards(n){
  const a = [...Array(n)].map(() => {
    const r = Math.floor(Math.random() * 100);
    if(r < 8 + 23 * 0) return "vita";
    if(r < 8 + 23 * 1) return "ignis";
    if(r < 8 + 23 * 2) return "aqua";
    if(r < 8 + 23 * 3) return "aer";
    if(r < 8 + 23 * 4) return "terra";
  });
  return n == 1 ? a[0] : a;
}

const free = [];
const games = { };

io.on("connection", async socket => {
  console.log("Connected", socket.id);
  socket.on("disconnect", () => {
    const index = free.indexOf(socket);
    if(~index) free.splice(index, 1);
    console.log("Disconnected", socket.id);
  });

  socket.on("first", () => {
    socket.emit("uuid", randomUUID());
  });

  socket.on("login", uuid => theGame(socket, uuid));
});

async function theGame(socket, uuid){

  if(uuid in games){
    games[uuid].emit("rejoin", socket);
    return;
  }

  if(!free.length) free.push([socket, uuid]);
  else {

    const [oppo, ouuid] = free.pop();
    const con = { oppo, socket };

    let turn = Math.floor(Math.random() * 2);

    const comm = [];
    const game = {
      "oppo": {
        "hp": 40,
        "buf": [],
        "deb": [],
        "cards": getCards(5).map(c => [c, "res", ""]),
        "tab": []
      },
      "socket": {
        "hp": 40,
        "buf": [],
        "deb": [],
        "cards": getCards(5).map(c => ["res", c, ""]),
        "tab": []
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

        [con.oppo, con.socket][i].emit("update", {
          com, you_hp, you_buf, you_debuf, you_cards, you_tab,
          oppo_hp, oppo_buf, oppo_debuf, oppo_cards, oppo_tab
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
          if(Math.floor(Math.random() * 100) < 70)
            game[t].hp = Math.max(game[t].hp - 2, 0);
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
            game[t].hp = Math.max(game[t].hp - 2, 0);
          }
        }
      }
    }

    async function step(data){
      if(data.length != 3) return false;

      const [from, to, loc] = data;
      const t = ["oppo", "socket"][turn];
      const y = ["oppo", "socket"][1 - turn];

      if(!(from >= 0 && from <= 5)) return false;

      const nebula = game[t].buf.find(b => b[turn].match(/Nebula/));
      if(nebula){
        const n = parseInt(nebula[turn].match(/\d+/)[0]) - 1;
        if(!n) game[t].buf = game[t].buf.filter(b => !b[turn].match(/Nebula/));
        else {
          nebula[turn] = "Nebula " + n;
          if(nebula[2] == "") nebula[1 - turn] = nebula[turn];
        }
      }

      const lutum = game[t].deb.find(b => b[turn].match(/Lutum/));

      const newc = ["res", "res", ""];
      newc[turn] = getCards(1);

      if(to == "com"){
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
          return true;
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
          return true;
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
        else if(l == "nebula") len = 2;
        else if(l == "lumen"){ ef = "vita"; len = 3; }
        else if(l == "mediocris"){ ef = "aer"; len = 3; }
        else if(l == "phoenix"){ ef = "ignis"; len = 3; }
        else if(l == "syrena"){ ef = "aqua"; len = 3; }
        else if(l == "colossus"){ ef = "terra"; len = 3; }

        game[t].cards.push(newc);

        if(ef == "vita"){
          game[t].hp = Math.min(game[t].hp + 2 * len, 40);
          return true;
        }

        ef = ef[0].toUpperCase() + ef.slice(1);
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
          if(nebula){
            eff[2] = "?";
            eff[1 - turn] = "???";
          }
          game[t].buf.push(eff);
        }
        return true;
      } else if(to == "oppo"){

        const card = game[t].cards.splice(from, 1)[0];
        const l = card[turn];
        let ef = l;
        let len = 1;
        let str = 2;
        if(l == "fulgur"){ ef = "ignis"; str = 6; }
        else if(l == "tempestas"){ ef = "aer"; str = 6; }
        else if(l == "vapor"){ ef = "aqua"; str = 6; }
        else if(l == "tremor"){ ef = "terra"; str = 6; }
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
            if(nebula){
              eff[2] = "?";
              eff[1 - turn] = "???";
            }
            game[y].deb.push(eff);
          }
          return true;
        }

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
            if(Math.floor(Math.random() * 100) < 30) return true;

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

          game[y].hp = Math.max(game[y].hp - str, 0);
          return true;
        }

        ef = ef[0].toUpperCase() + ef.slice(1);
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
          if(nebula){
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

server.listen(11069, () => {
  console.log("Server started!");
});

let ctrlC = false;
process.on("SIGINT", async () => {
  if(ctrlC) return;
  ctrlC = true;

  console.log("\rStopping...");

  io.close();

});

