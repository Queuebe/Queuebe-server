#!/usr/bin/env node
var net=require("net");

var lobbies=[]; //lobby = {id:Number,name:String,players:[[String,Socket]]}
var taken_nicknames=[];

var server=net.createServer(function(conn){
	var currentLobby=-1,nickname=null,running=false; //persistent
	conn.on("data",connectionLobbyDataListener);
	conn.on("end",function(){
		if(nickname!=null)taken_nicknames.splice(taken_nicknames.indexOf(nickname),1);
		if(currentLobby!=-1){
			var idx=lobbyIndex(currentLobby);
			if(lobbies[idx].players.length==2){
				lobbies[idx].players[lobbies[idx].players[0][0]==nickname?1:0][1].write("other_player_quit_game\n");
			}
			lobbies.splice(idx,1);
		}
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

function fill_array(len,val){var a=new Array(len);for(;len-->0;a[len]=(typeof val=="function"?val(len):val));return a;}

function connectionLobbyDataListener(data){
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
			if(isNaN(choice)||choice<0||choice%1!=0||(chosenLobby=lobbyIndex(choice),(chosenLobby==-1||chosenLobby==currentLobby))){
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
			lobbies[chosenLobby].players.push([nickname,conn]);
			startGame(chosenLobby);
		} else if(line.match(/^create_lobby /)){
			var lname=line.slice(13);
			if(lobbies.filter(function(l){return l.name==lname;}).length!=0){
				conn.write("error A lobby already exists with that name\n");
				continue;
			}
			if(currentLobby!=-1){
				idx=lobbyIndex(currentLobby);
				if(idx!=-1){
					if(lobbies[idx].running){
						conn.write("error Cannot create a lobby while still playing one\n");
						continue;
					}
					lobbies.splice(idx,1);
				}
			}
			currentLobby=uniqid();
			lobbies.push({id:currentLobby,name:lname,players:[[nickname,conn]]});
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
			lobbies[chosenLobby].players.forEach(function(pl){conn.write("player "+pl[0]+"\n");});
		} else {
			conn.write("error Invalid command sent ("+(line.length<=10?"":"starting with ")+"\""+line.slice(0,10)+"\")\n");
		}
	}
}

function connectionGameDataListener(data){
	var databuffer=""; //persistent
	var line,idx;
	databuffer+=data;
	while(databuffer.length&&(idx=databuffer.indexOf("\n"))){
		line=databuffer.slice(0,idx);
		databuffer=databuffer.slice(idx+1);
		if(line.match(/^nick /)){
			;
		} else {
			conn.write("error Invalid command sent ("+(line.length<=10?"":"starting with ")+"\""+line.slice(0,10)+"\")\n");
		}
	}
}


var adjacencyMatrix=[[2,6,4,5],[3,6,1,5],[4,6,2,5],[6,1,3,5],[4,3,2,1],[2,3,4,1]],
    rotatingFromToGivesRelRot=[[NaN,0,NaN,0,2,0],[0,NaN,0,NaN,1,1],[NaN,0,NaN,0,0,2],[0,NaN,0,NaN,3,3],[2,3,0,1,NaN,NaN],[0,3,2,1,NaN,NaN]],
    oppositesFaces=[3,4,1,2,6,5];


function startGame(lobbyIdx){
	var lob=lobbies[lobbyIdx],conn1=lob.players[0][1],conn2=lob.players[1][1]; //lob is a reference
	conn1.removeListener(connectionLobbyDataListener);
	conn2.removeListener(connectionLobbyDataListener);
	conn1.write("game_start "+lob.players[1][0]+"\n");
	conn2.write("game_start "+lob.players[0][0]+"\n");
	lob.game={cube:fill_array(function(i){return 1-Math.round(Math.pow(Math.random(),1.5));}),toMove:0,player0at:0,rot:0};
	//player0at=side facing player 0; rot=number of 90-degrees-multiples rotated from standard orientation

}
