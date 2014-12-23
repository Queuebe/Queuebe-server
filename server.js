#!/usr/bin/env node
var net=require("net");

var lobbies=[]; //lobby = {id:Number,name:String,players:[String]}
var taken_nicknames=[];

var server=net.createServer(function(conn){
	var currentLobby=-1,nickname=null; //persistent
	conn.on("data",function(data){
		var databuffer=""; //persistent
		var line,idx;
		databuffer+=data;
		while(databuffer.length&&(idx=databuffer.indexOf("\n"))){
			line=databuffer.slice(0,idx);
			databuffer=databuffer.slice(idx+1);
			if(line.match(/^nick /)){
				nickname=line.slice(5);
				if(taken_nicknames.indexOf(nickname)!=-1){
					conn.write("error Nickname is already taken\n");
					nickname=null;
					continue;
				}
				taken_nicknames.push(nickname);
				conn.write("nick_ok\n");
				continue;
			}
			if(nickname==undefined){
				conn.write("error Can only send a \"nick\" line while no nickname set\n");
				continue;
			}
			if(line=="list_lobbies"){
				conn.write("list_lobbies "+lobbies.length+"\n");
				lobbies.forEach(function(lob){
					conn.write("lobby "+lob.id+" "+lob.players.length+" "+lob.name+"\n");
				});
			} else if(line.match(/^join_lobby /)){
				var choice=+line.slice(11),chosenLobby;
				if(isNaN(choice)||choice<0||choice%1!=0||(chosenLobby=lobbyIndex(choice))){
					conn.write("error Invalid lobby\n");
					continue;
				}
				if(chosenLobby==undefined)chosenLobby=lobbyIndex(choice);
				if(currentLobby!=-1){
					idx=lobbyIndex(currentLobby);
					if(idx!=-1){
						if(lobbies[idx].running){
							conn.write("error Cannot join a lobby while still playing one\n");
							continue;
						}
						lobbies.splice(idx,1);
					}
				}
				lobbies[chosenLobby].players.push(nickname);
				startGame(chosenLobby);
			} else if(line.match(/^create_lobby /)){
				var lname=line.slice(13);
				if(lobbies.filter(function(l){return l.name==lname;}).length!=0){
					conn.write("error A lobby already exists with that name\n");
					continue;
				}
				currentLobby=uniqid();
				lobbies.push({id:currentLobby,name:lname,players:[nickname]});
				conn.write("create_lobby_ok\n");
			} else if(line=="my_lobby"){
				if(currentLobby==-1)conn.write("my_lobby\n");
				else conn.write("my_lobby "+lobbies[lobbyIndex(currentLobby)].name+"\n");
			} else if(line.match(/^lobby_info /)){
				var which=+line.slice(11),whichLobby;
				if(isNaN(which)||which<0||which%1!=0||(chosenLobby=lobbyIndex(which))){
					conn.write("error Invalid lobby\n");
					continue;
				}
				if(whichLobby==undefined)chosenLobby=lobbyIndex(which);
				conn.write("lobby_info "+lobbies[chosenLobby].players.length+"\n");
				lobbies.players.forEach(function(pl){conn.write("player "+pl+"\n");});
			} else {
				conn.write("error Invalid command sent ("+(line.length<=10?"":"starting with ")+"\""+line.slice(0,10)+"\")\n");
			}
		}
	});
	conn.on("end",function(){
		if(nickname!=null)taken_nicknames.splice(taken_nicknames.indexOf(nickname),1);
	});
});
server.listen(18632,function(){
	console.log("Queuebe server started.");
});

function lobbyIndex(id){
	var i;
	for(i=0;i<lobbies.length;i++)if(lobbies[i].id==id)return i;
	return -1;
}

uniqid=(function(){
	var superman=0;
	return function(){return superman++};
})();


function startGame(lobbyIdx){
	;
}
