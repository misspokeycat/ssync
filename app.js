var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':memory:');

//Serve index.html page for request to /
app.get('/', function(req, res){
  res.sendFile(__dirname + '/static/index.html');
});

//holds current video / video time
var currenttime = 0;
//Constant used to specify how often server should update playback time
var TIMER_UPDATE_INTERVAL = 1000;

setInterval(function(){
  currenttime += TIMER_UPDATE_INTERVAL/1000;
  io.emit('video time', currenttime);
} , TIMER_UPDATE_INTERVAL);
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
    //Since new video played, set timer back to zero.
    currenttime = 0;
    console.log('playing video with id ' + currentvid);
    io.emit('video id', currentvid);
  });
  //Socket handler for current video time
  socket.on('video time', function(time){
    currenttime = time;
    console.log('syncing to time ' + currenttime);
    io.emit('video time', currenttime);
  });
});

//SQLite code
db.serialize(function(){
  db.run("CREATE TABLE IF NOT EXISTS playlist (id INTEGER PRIMARY KEY,title TEXT, yt_id TEXT, duration INTEGER)");
  //Test add, but should be doable with other things
  db.run("INSERT INTO playlist (title, yt_id, duration) VALUES (" +
    "'beatmania IIDX - smooooch・∀・'" +", "+
    "'QvGRj77EAOo'" +", "+
    "120" + ")");
  db.each("SELECT * FROM playlist", function(err, row){
    //For now, just log everything in table playlist.
    console.log(row);  //Appears this is returned as json, which ROCKS!
  });
});

db.close();
//Starts the server
http.listen(3000, function(){
  console.log('listening on *:3000')
});