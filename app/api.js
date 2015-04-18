//api.js
//Author: Luke D'Alfonso
//Handles all socket.io operations

module.exports = {getAPI : function (){
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
}
}