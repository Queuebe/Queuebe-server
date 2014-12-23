#!/usr/bin/env node
var net=require("net");

var lobbies=[]; //lobby = {id:Number,name:String,players:[[String,Socket]]}
var client_nicknames=[],client_sockets=[];

var server=net.createServer(function(conn){
	var currentLobby=-1,nickname=null,running=false; //persistent
	var onEndFunction;
	conn.on("data",(function(){
		var databuffer="",wasInGame=false; //persistent
		return function(data){
			var line,idx;
			idx=lobbyIndex(currentLobby);
			if(currentLobby!=-1&&idx!=-1&&lobbies[idx].players.length==2){
				wasInGame=true;
				return; //the other listener will take over
			}
			if(wasInGame){
				currentLobby=-1;
				wasInGame=false;
			}
			databuffer+=data;
			while(databuffer.length&&(idx=databuffer.indexOf("\n"))!=-1){
				line=databuffer.slice(0,idx);
				databuffer=databuffer.slice(idx+1);
				if(line.match(/^nick /)&&nickname==undefined){
					nickname=line.slice(5);
					if(client_nicknames.indexOf(nickname)!=-1){
						conn.write("error Nickname is already taken\n");
						nickname=null;
						continue;
					}
					if(nickname.length==0){
						conn.write("error Invalid nickname\n");
						nickname=null;
						continue;
					}
					client_nicknames.push(nickname);
					client_sockets.push(conn);
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
						if(chosenLobby==currentLobby)conn.write("error Already in that lobby\n");
						else conn.write("error Invalid lobby\n");
						continue;
					}
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
					currentLobby=chosenLobby;
					lobbies[currentLobby].players.push([nickname,conn]);
					startGame(currentLobby,databuffer);
					wasInGame=true;
				} else if(line=="leave_lobby"){
					idx=lobbyIndex(currentLobby);
					if(currentLobby==-1||idx==-1){
						conn.write("error Not currently in a lobby, so can't leave\n");
						currentLobby=-1;
						continue;
					}
					lobbies.splice(idx,1);
					conn.write("leave_lobby_ok\n");
				} else if(line.match(/^create_lobby /)){
					var lname=line.slice(13);
					if(lobbies.filter(function(l){return l.name==lname;}).length!=0){
						conn.write("error A lobby already exists with that name\n");
						continue;
					}
					if(lname.length==0){
						conn.write("error Invalid lobby name\n");
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

					broadcast("list_lobbies "+lobbies.length+"\n");
					lobbies.forEach(function(lob){
						broadcast("lobby "+lob.id+" "+lob.players.length+" "+lob.name+"\n");
					});
				} else if(line=="my_lobby"){
					idx=lobbyIndex(currentLobby);
					if(idx==-1)currentLobby=-1;
					if(currentLobby==-1)conn.write("my_lobby\n");
					else conn.write("my_lobby "+currentLobby+" "+lobbies[idx].name+"\n");
				} else if(line.match(/^lobby_info /)){
					var which=+line.slice(11),whichLobby;
					if(isNaN(which)||which<0||which%1!=0||(whichLobby=lobbyIndex(which))==-1){
						conn.write("error Invalid lobby\n");
						continue;
					}
					conn.write("lobby_info "+which+" "+lobbies[whichLobby].players.length+"\n");
					lobbies[whichLobby].players.forEach(function(pl){conn.write("player "+which+" "+pl[0]+"\n");});
				} else {
					conn.write("error Invalid command sent ("+(line.length<=10?"":"starting with ")+"\""+line.slice(0,10)+"\")\n");
				}
			}
		};
	})());
	onEndFunction=function(){
		var idx
		if(nickname!=null){
			idx=client_nicknames.indexOf(nickname);
			client_nicknames.splice(idx,1);
			client_sockets.splice(idx,1);
		}
		if(currentLobby!=-1&&(idx=lobbyIndex(currentLobby))!=-1){
			if(lobbies[idx].players.length==2){
				lobbies[idx].players[lobbies[idx].players[0][0]==nickname?1:0][1].write("other_player_quit_game\n");
			}
			lobbies.splice(idx,1);
		}
	};
	conn.on("end",onEndFunction);
	conn.on("error",function(err){
		console.log(err);
		onEndFunction();
	});
});
server.listen(18632,function(){
	console.log("Queuebe server started.");
});

function lobbyIndex(id){
	var i;
	if(id<0)return -1;
	for(i=0;i<lobbies.length;i++)if(lobbies[i].id==id)return i;
	return -1;
}

uniqid=(function(){
	var superman=0;
	return function(){return superman++};
})();

function fill_array(len,val){var a=new Array(len);for(;len-->0;a[len]=(typeof val=="function"?val(len):val));return a;}

function broadcast(text){
	client_sockets.forEach(function(conn){
		conn.write(text);
	});
}


var adjacencyMatrix=[[2,6,4,5],[3,6,1,5],[4,6,2,5],[6,1,3,5],[4,3,2,1],[2,3,4,1]],
	rotatingFromToGivesRelRot=[[NaN,0,NaN,0,2,0],[0,NaN,0,NaN,1,1],[NaN,0,NaN,0,0,2],[0,NaN,0,NaN,3,3],[2,3,0,1,NaN,NaN],[0,3,2,1,NaN,NaN]],
	oppositeFace=[3,4,1,2,6,5];

function getCubeFace(cube,side,rot){
	console.log(cube);
	console.log(side);
	var face=cube[side-1].join("");
	return face.slice(rot%4)+face.slice(0,rot%4);
}

function startGame(lobbyIdx){
	var lob=lobbies[lobbyIdx],conn=[lob.players[0][1],lob.players[1][1]]; //lob is a reference
	var conn0listenerfunction,conn1listenerfunction;
	var connectionGameDataListenerFactory=function(conni){
		return function(data){
			var databuffer=""; //persistent
			var line,idx;
			databuffer+=data;
			while(databuffer.length&&(idx=databuffer.indexOf("\n"))){
				line=databuffer.slice(0,idx);
				databuffer=databuffer.slice(idx+1);
				if(line=="quit_game"){
					conn[1-conni].write("other_player_quit_game\n");
					lobbies.splice(lobbyIdx,1);
					conn[0].removeListener("data",conn0listenerfunction);
					conn[1].removeListener("data",conn1listenerfunction);
				} else if(line.match(/^click /)){
					var click=+line.slice(6),cubeface,newface;
					if(lob.game.toMove!=conni){
						conn[conni].write("error Not your turn\n");
						continue;
					}
					if(isNaN(click)||click<0||click>3||click%1!=0){
						conn[conni].write("error Invalid move\n");
						continue;
					}

					cubeface=conni==1?oppositeFace[lob.game.player0at-1]:lob.game.player0at;
					console.log("cubeface=");
					console.log(cubeface);
					lob.game.cube[cubeface-1][(click+lob.rot)%4]=1-lob.game.cube[cubeface-1][(click+lob.rot)%4];
					console.log(lob.game.cube);
					newface=adjacencyMatrix[cubeface-1][(click+lob.rot)%4];
					lob.rot=(lob.rot+rotatingFromToGivesRelRot[cubeface-1][newface-1])%4;
					lob.game.player0at=conni==1?oppositeFace[newface-1]:newface;

					lob.game.toMove=1-lob.game.toMove;

					conn[0].write("your_cube_face "+getCubeFace(lob.game.cube,lob.game.player0at,lob.rot)+"\n");
					conn[1].write("your_cube_face "+getCubeFace(lob.game.cube,oppositeFace[lob.game.player0at-1],lob.rot)+"\n");
				} else {
					conn[conni].write("error Invalid command sent ("+(line.length<=10?"":"starting with ")+"\""+line.slice(0,10)+"\")\n");
				}
			}
		};
	};

	conn0listenerfunction=connectionGameDataListenerFactory(0);
	conn[0].on("data",conn0listenerfunction);
	conn1listenerfunction=connectionGameDataListenerFactory(1);
	conn[1].on("data",conn1listenerfunction);

	conn[0].write("game_start "+lob.players[1][0]+"\n");
	conn[1].write("game_start_wait "+lob.players[0][0]+"\n");
	lob.game={
		cube:fill_array(6,function(i){
			return fill_array(4,function(j){
				return 1-Math.round(Math.pow(Math.random(),1.5));
			});
		}),
		toMove:0,player0at:1,rot:0
	};
	//player0at=side that player 0 sees; rot=number of 90-degrees-multiples rotated from standard orientation
	conn[0].write("your_cube_face "+getCubeFace(lob.game.cube,lob.game.player0at,lob.rot)+"\n");
	conn[1].write("your_cube_face "+getCubeFace(lob.game.cube,oppositeFace[lob.game.player0at-1],lob.rot)+"\n");
}
