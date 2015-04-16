var express = require('express');
var request = require('request');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io').listen(http);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':memory:');  //Change to an actual file eventually!

//SQLite code 
db.serialize(function(){
  //Initializes table
  db.run("CREATE TABLE IF NOT EXISTS playlist (id INTEGER PRIMARY KEY,title TEXT, yt_id TEXT, duration INTEGER, yt_imgURL TEXT, playing INTEGER)");
  //Test add, but should be doable with other things
  db.run("INSERT INTO playlist (title, yt_id, yt_imgURL, duration) VALUES" + 
  "('beatmania IIDX - smooooch・∀・', 'QvGRj77EAOo', 'https://i.ytimg.com/vi/Ey1ymDaxmog/default.jpg', 120)");
}); 

//Serves static directory
app.use('/', express.static(__dirname + "/static"));

//control variables
//holds current video / video time
var currenttime = 0;

//holds current video duration
var currentdur = 60;

//holds current video url
var currentvid = 'AvtYOLe6Gh8';

var currentplid = 1;
//Constant used to specify how often server should update playback time
//Eventually, have it so that server only sends playback time on request
var TIMER_UPDATE_INTERVAL = 1000;

//internal timer update function
setInterval(function(){
  currenttime += TIMER_UPDATE_INTERVAL/1000;
  if (currenttime>currentdur){
    playNextVidInPlaylist();
  }
  io.emit('video time', currenttime);
} , TIMER_UPDATE_INTERVAL);

function playNextVidInPlaylist(){
  console.log('playing video #' + currentplid);
  db.get("SELECT yt_id, duration FROM playlist WHERE id=?", currentplid+1, function(err, row){
    if (row != null){
      currentplid++;
      playVid(row.yt_id, row.duration);
    } else{  //loops playlist back to start
      currentplid = 0;  //because query will autoincrement to 1
      playNextVidInPlaylist();  //woot recursion
    }
  });
}

function playVid(vid_id, vid_dur){
    currenttime = 0;
    currentdur = vid_dur;
    currentvid = vid_id;
    io.emit('currenttime', currenttime);
    io.emit('video id', currentvid);
}
//Handles socket events (TODO: Handling multiple connections from same host)
io.on('connection', function(socket){

  //Sends the playlist to connecting client
  db.each("SELECT * FROM playlist",function(err, row){
    socket.emit('pl_add', row);
  });

  //Send current video id and time to connecting clients
  socket.emit('video id', currentvid);
  socket.emit('currenttime', currenttime);
  
  //Socket handler for current video
  socket.on('video id', function(vid){
    console.log('playing video with id ' + currentvid);
  });

  //Socket handler for playing playlist items
  socket.on('pl_play', function(id){
    db.get('SELECT yt_id, duration FROM playlist WHERE id=?', id, function(err, row){
      playVid(row.yt_id, row.duration);
      currentplid = id;
    });
  });

  //Socket handler for current video time
  socket.on('video time', function(time){
    currenttime = time;
    console.log('syncing to time ' + currenttime);
    io.emit('video time', currenttime);
  });

  //Socket handler for adding videos to playlist
  socket.on('pl_add', function(toadd){
    console.log('recieved playlist add with id:' + toadd);
    //Parse video URL (eventually)
    //Query Youtube API
    var YOUTUBE_API_KEY = 'AIzaSyAtc6hZ9_XemujndecpsR_lkTMlxYOqxlg'; //Obviously add your own in here TODO: Externalize
    request('https://www.googleapis.com/youtube/v3/videos?part=contentDetails%2Csnippet&id=' + toadd + '&key=' + YOUTUBE_API_KEY,
    function(err, res, body){
      if (!err  && res.statusCode ==200){
        var content = JSON.parse(body);
        if (content.items[0] != null){
          //Converts Youtube ISO 8601 string to seconds
          function convert_time(duration) {
              var a = duration.match(/\d+/g);
              if (duration.indexOf('M') >= 0 && duration.indexOf('H') == -1 && duration.indexOf('S') == -1) {
                  a = [0, a[0], 0];
              }
              if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1) {
                  a = [a[0], 0, a[1]];
              }
              if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1 && duration.indexOf('S') == -1) {
                  a = [a[0], 0, 0];
              }
              duration = 0;
              if (a.length == 3) {
                  duration = duration + parseInt(a[0]) * 3600;
                  duration = duration + parseInt(a[1]) * 60;
                  duration = duration + parseInt(a[2]);
              }
              if (a.length == 2) {
                  duration = duration + parseInt(a[0]) * 60;
                  duration = duration + parseInt(a[1]);
              }
              if (a.length == 1) {
                  duration = duration + parseInt(a[0]);
              }
              return duration;
          }
          //Adds video to database
          db.run("INSERT INTO playlist (title, yt_id, duration, yt_imgURL, playing) VALUES ($title, $yt_id, $duration, $yt_imgURL, 0)", {
            $title: content.items[0].snippet.title, 
            $yt_id: content.items[0].id,
            $duration: convert_time(content.items[0].contentDetails.duration),
            $yt_imgURL: content.items[0].snippet.thumbnails.default.url
          });
          //Adds video to client playlists from DB query
          db.get("SELECT * FROM playlist WHERE yt_id=?", content.items[0].id, function(err, row){
            io.emit('pl_add', row);
          });
        }
      }
      else{
        console.error('YT API ERR:' + err + ' STATUS:' + res.statusCode);
      }
    });
  });
});


//Starts the server
http.listen(3000, function(){
  console.log('listening on *:3000')
});