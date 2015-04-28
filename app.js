var express = require('express');
var request = require('request');
var app = express();
var helpers = require('./app/helpers.js');
var http = require('http').createServer(app);
var io = require('socket.io').listen(http);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('data.sqlite');  //Change to an actual file eventually!

//SQLite code 
db.serialize(function(){
  //Initializes table
  //Playlists are stored as linked lists
  //SQL Breakdown - Video title, Video URL, previous playlist video url, decimal position, duration in seconds, image thumbnail, and whether vid is playing
  db.run("CREATE TABLE IF NOT EXISTS playlist (id INTEGER PRIMARY KEY,title TEXT, yt_id TEXT, position REAL, duration INTEGER, yt_imgURL TEXT, playing INTEGER)");
  //Test add, but should be doable with other things
  //db.run("INSERT INTO playlist (title, yt_id, yt_imgURL, duration, position) VALUES" + 
  //"('beatmania IIDX - smooooch・∀・', 'QvGRj77EAOo', 'https://i.ytimg.com/vi/Ey1ymDaxmog/default.jpg', 120, 0)");
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

//holds current playlist position
var currentpos = 0;
//Constant used to specify how often server should update playback time
//Eventually, have it so that server only sends playback time on request
var TIMER_UPDATE_INTERVAL = 1000;

//internal timer update function
setInterval(function(){
  currenttime += TIMER_UPDATE_INTERVAL/1000;
  //For whatever reason, Youtube removes the last second of their videos.
  var GPCONST = 1;
  if (currenttime>currentdur-GPCONST){
    playNextVidInPlaylist();
  }
  io.emit('video time', currenttime);
} , TIMER_UPDATE_INTERVAL);

function playNextVidInPlaylist(){
  db.get("SELECT yt_id, duration, position  FROM playlist WHERE position>? ORDER BY position", currentpos, function(err, row){
    if (row != null){
      playVid(row.yt_id, row.duration, row.position);
      console.log('playing video with position ' + currentpos);
    } else{  //loops playlist back to start
      //todo: add checks for empty playlists
      currentpos = -1;
      console.log('Reached EOP');
      playNextVidInPlaylist();  //woot recursion
    }
  });
}

function playVid(vid_id, vid_dur, pl_pos){
  currenttime = 0;
  currentdur = vid_dur;
  currentvid = vid_id;
  //Videos can be played without playlist positions, so pl_pos not required param
  if(pl_pos != undefined){
    currentpos = pl_pos;
  }
  io.emit('currenttime', currenttime);
  io.emit('video id', currentvid);
}

//Handles socket events (TODO: Handling multiple connections from same host)
io.on('connection', function(socket){
  //Sends the playlist to connecting client
  db.each("SELECT * FROM playlist ORDER BY position",function(err, row){
    socket.emit('pl_add', row);
  });

  //Send current video id and time to connecting clients
  socket.emit('video id', currentvid);
  socket.emit('currenttime', currenttime);
  
  //Socket handler for current video
  //This needs to be substantially reworked for playlists, or removed
  socket.on('video id', function(vid){
    console.log('playing video with id ' + currentvid);
  });

  //Socket handler for playing playlist items
  //Should also problaby update table with playing status
  socket.on('pl_play', function(id){
    db.get('SELECT yt_id, duration, position FROM playlist WHERE id=?', id, function(err, row){
      playVid(row.yt_id, row.duration, row.position);
      currentplid = id;
    });
  });

  //Socket handler for removing playlist items
  socket.on('pl_remove', function(id){
    db.run('DELETE FROM playlist WHERE id=?', id);
    io.emit('pl_remove', id);
    playNextVidInPlaylist();
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
    var vidid = helpers.parse_url(toadd);
    if (vidid != -1){
      //Query Youtube API
      var YOUTUBE_API_KEY = 'AIzaSyAtc6hZ9_XemujndecpsR_lkTMlxYOqxlg'; //Obviously add your own in here TODO: Externalize
      request('https://www.googleapis.com/youtube/v3/videos?part=contentDetails%2Csnippet&id=' + vidid + '&key=' + YOUTUBE_API_KEY,
      function(err, res, body){
        if (!err  && res.statusCode ==200){
          var content = JSON.parse(body);
          if (content.items[0] != null){
            //Adds video to database  TODO: Update for decimal position structure
            db.get("SELECT max(position) FROM playlist", function (err, row){
              //Increment max value by 1, add value
              var maxval = row[Object.keys(row)[0]];
              //If we are adding the first object, maxval will be null
              if (maxval === null) maxval = 0;
              if (maxval == undefined) maxval = 0;
              db.run("INSERT INTO playlist (title, yt_id, duration, yt_imgURL, playing, position) VALUES ($title, $yt_id, $duration, $yt_imgURL, 0, $position)", {
                $title: content.items[0].snippet.title, 
                $yt_id: content.items[0].id,
                $duration: helpers.convert_time(content.items[0].contentDetails.duration),
                $yt_imgURL: content.items[0].snippet.thumbnails.default.url,
                $position: maxval +1
              });
              console.log('adding at position ' + (maxval+1));
              //Adds video to client playlists from DB query
              db.get("SELECT * FROM playlist WHERE yt_id=?", content.items[0].id, function(err, row){
                io.emit('pl_add', row);
              });
            });
          }
        }
        else{
          console.error('YT API ERR:' + err + ' STATUS:' + res.statusCode);
        }
      });
    }
  });
});


//Starts the server
http.listen(3000, function(){
  console.log('listening on *:3000')
});