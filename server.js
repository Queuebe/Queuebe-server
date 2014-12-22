#!/usr/bin/env node
var net=require("net");

var lobbies=[];

var server=net.createServer(function(conn){
	conn.on("data",function(data){
		var databuffer="",line,idx;
		databuffer+=data;
		while(idx=databuffer.indexOf("\n")){
			line=databuffer.slice(0,idx);
			databuffer=databuffer.slice(idx+1);
		}
	});
	
});
