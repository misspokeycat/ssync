//helpers.js
//Author: Luke D'Alfonso
//Provides various helper functions for the app

module.exports = {
  //Converts Youtube ISO 8601 string to seconds
  convert_time: function (duration) {
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
  },
  parse_url: function (url){
    var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    var match = url.match(regExp);
    if (match && match[2].length == 11) {
      return match[2];
    } else {
      return -1;
    }
  }
}