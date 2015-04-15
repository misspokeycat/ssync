var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

//Serve index.html page for request to /
app.get('/', function(req, res){
  res.sendFile(__dirname + '/static/index.html');
});

//holds current video / video time
var currenttime = 0;
var currentvid = 'AvtYOLe6Gh8';

//Handles socket events (TODO: Handling multiple connections from same host)
io.on('connection', function(socket){
  //Send current video id and time to connecting clients
  socket.emit('video id', currentvid);
  socket.emit('currenttime', currenttime);

  //Socket handler for current video
  socket.on('video id', function(vid){
    //TODO: Add video to database for current playing video.
    currentvid = vid;
    console.log('now playing video with id ' + currentvid);
    io.emit('video id', currentvid);
  });
  //Socket handler for current video time
  socket.on('video time', function(time){
    currenttime = time;
    io.emit('video time', currenttime);
  });
});

//Starts the server
http.listen(3000, function(){
  console.log('listening on *:3000')
});