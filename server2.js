#!/usr/bin/env node
var net=require("net");
var PORT=14336;

var players=[],gamestarted=false,gstate=null;

var server=net.createServer(function(conn){
	var plidx;
	var databuffer="";
	(function(){
		var connwritefunc=conn.write;
		conn.write=function(){
			connwritefunc.apply(conn,arguments);
			console.log("Written to player "+plidx+": "+(arguments.length>1?"["+arguments+"]":arguments[0].replace(/\n$/,"")));
		}
	})();
	if(gamestarted){
		conn.write("error A game is already running\n");
		conn.close();
		return;
	}
	plidx=players.push({nick:random_nickname(),conn:conn})-1;
	conn.write("plidx "+plidx+"\n");
	if(plidx==1){
		gamestarted=true;
		setTimeout(gameStart,0); //at your earliest convenience, sir node.
	}
	conn.on("data",function(data){
		var idx;
		databuffer+=data;
		while(data.length&&(idx=databuffer.indexOf("\n"))!=-1){
			console.log("Received from player "+plidx+": "+databuffer.slice(0,idx).replace(/\n$/,""));
			ondata(conn,databuffer.slice(0,idx),plidx);
			databuffer=databuffer.slice(idx+1);
		}
	});
	conn.on("error",function(){
		if(gamestarted){
			broadcast("error Game quitted\n",plidx);
			process.exit();
		} else {
			players.splice(plidx,1);
			console.log("plidx "+plidx+" disconnected");
		}
	});
	conn.on("end",function(){
		if(gamestarted){
			broadcast("error Game quitted\n",plidx);
			process.exit();
		} else {
			players.splice(plidx,1);
			console.log("plidx "+plidx+" disconnected");
		}
	});
});
server.listen(PORT,function(){
	console.log("Server is listening on port "+PORT);
});

function ondata(conn,line,plidx){
	var arg,match;
	if(!gamestarted){

		if(line.match(/^nick /)){
			arg=line.slice(5).replace(/[\x00-\x20]"'/g,"");
			if(arg.length==0){
				conn.write("error Invalid nickname\n");
				return;
			}
			players[plidx].nick=arg;
			conn.write("nick_ok\n");
			broadcast("nick "+plidx+" "+players[plidx].nick+"\n",plidx);
			console.log("Player "+plidx+" changed nickname to "+players[plidx].nick);
		} else {
			conn.write("error Invalid command\n");
		}

	} else {

		if((match=line.match(/^click (\d)$/))){
			var cubeface,newface,rotaction;
			if(plidx!=gstate.toMove){
				conn.write("error Not your turn\n");
				return;
			}
			arg=+match[1];
			if(isNaN(arg)||arg<0||arg>3||arg%1!=0){
				conn.write("error Invalid click\n");
				return;
			}
			if(plidx==0){
				cubeface=gstate.player0at;
				gstate.cube[cubeface][(arg+gstate.rot)%4]=1-gstate.cube[cubeface][(arg+gstate.rot)%4];
			} else {
				cubeface=oppositeFace[gstate.player0at];
				gstate.cube[cubeface][(arg+rotForP2[gstate.rot])%4]=1-gstate.cube[cubeface][(arg+rotForP2[gstate.rot])%4];
			}

			newface=adjacencyMatrix[gstate.player0at][(arg+gstate.rot)%4];
			gstate.rot=(gstate.rot+rotatingFromToGivesRelRot[gstate.player0at][newface])%4;
			gstate.player0at=newface;

			if(plidx==0)rotaction=[arg,rotForP2[arg]];
			else rotaction=[rotForP2[arg],arg];

			gstate.toMove=1-gstate.toMove;

			console.log(gstate.cube);
			console.log("rot="+gstate.rot+" player0at="+gstate.player0at);

			players[0].conn.write("update_cube_face "+getCubeFace(gstate.cube,gstate.player0at,gstate.rot)+" "+arg+" "+numInCube(gstate.cube,0)+" "+numInCube(gstate.cube,1)+"\n");
			players[1].conn.write("update_cube_face "+getCubeFace(gstate.cube,oppositeFace[gstate.player0at],rotForP2[gstate.rot])+" "+arg+" "+numInCube(gstate.cube,0)+" "+numInCube(gstate.cube,1)+"\n");
			if(numInCube(gstate.cube,0)==0||numInCube(gstate.cube,1)==0){
				broadcast("quit\n");
				process.exit();
			}
			players[gstate.toMove].conn.write("your_turn\n");
		} else {
			conn.write("error Invalid command\n");
		}

	}
}

function broadcast(msg,except){
	if(except==undefined)except=[];
	else if(typeof except=="number")except=[except];
	players.forEach(function(p,i){
		if(except.indexOf(i)==-1)p.conn.write(msg);
	});
}

var adjacencyMatrix=[[1,5,3,4],[2,5,0,4],[3,5,1,4],[0,5,2,4],[3,2,1,0],[1,2,3,0]],
	rotatingFromToGivesRelRot=[[NaN,0,NaN,0,2,0],[0,NaN,0,NaN,1,1],[NaN,0,NaN,0,0,2],[0,NaN,0,NaN,3,3],[2,3,0,1,NaN,NaN],[0,3,2,1,NaN,NaN]],
	oppositeFace=[2,3,0,1,5,4],
	rotForP2=[0,3,2,1];

function numInCube(cube,val){
	var tot=0;
	cube.forEach(function(r){
		r.forEach(function(c){
			tot+=c==val;
		});
	});
	return tot;
}

function getCubeFace(cube,side,rot){
	var face=cube[side].join("");
	return face.slice(rot%4)+face.slice(0,rot%4);
}

function fill_array(len,val){var a=new Array(len);for(;len-->0;a[len]=(typeof val=="function"?val(len):val));return a;}

function gameStart(){
	players[0].conn.write("game_start 0 2 "+players[0].nick+" "+players[1].nick+"\n"); //game_start <num_turns_to_wait> <num_players> <nicks...>
	players[1].conn.write("game_start 1 2 "+players[0].nick+" "+players[1].nick+"\n");
	gstate={
		/*cube:fill_array(6,function(i){
			return fill_array(4,function(j){
				return 1-Math.round(Math.pow(Math.random(),1.5))|0;
			});
		}),*/
		cube:[[0,0,1,1],
		      [1,0,1,0],
		      [0,0,0,0],
		      [1,1,1,1],
		      [0,1,0,0],
		      [0,1,1,1]],
		toMove:0,player0at:0,rot:0
	};
	console.log(gstate.cube);
	//player0at=side that player 0 sees; rot=number of 90-degrees-multiples rotated from standard orientation
	players[0].conn.write("your_cube_face "+getCubeFace(gstate.cube,gstate.player0at,gstate.rot)+" "+numInCube(gstate.cube,0)+" "+numInCube(gstate.cube,1)+"\n");
	players[1].conn.write("your_cube_face "+getCubeFace(gstate.cube,oppositeFace[gstate.player0at],rotForP2[gstate.rot])+" "+numInCube(gstate.cube,0)+" "+numInCube(gstate.cube,1)+"\n");
	players[0].conn.write("your_turn\n");
}

function random_nickname(){
	var prefixes=["user","swag","yolo","node","boot","car","chrome","IE","FF","sublime","notepad","mac","pc","angel","hell","heaven","math","music","admin","root","su","sandwich","nick","ansi","c99"];
	var suffix=("0000"+~~(Math.random()*10000)).slice(-4);
	var nick=prefixes[Math.random()*prefixes.length|0]+suffix;
	var i;
	for(i=0;i<players.length;i++)if(players[i].nick==nick)return random_nickname();
	return nick;
}
