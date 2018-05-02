const PORT = process.env.PORT || 8080;
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var handlebars  = require('express-handlebars');
var querystring = require('querystring');
var request_library = require('request'); // "Request" library

var session = require('./sessionmanager.js');
var db = require('./database.js');

//SPOTIFY AUTH:
var SpotifyWebApi = require('spotify-web-api-node');
var clientID = '58ac68b2b95c4c55957c2a54c8f1ed90';
var clientSecret = '660a8dd1ead9413a933d2e82924ef5b4';
var redirectUri = 'http://localhost:8080/callback';
var spotifyApi = new SpotifyWebApi({
  clientId : clientID,
  clientSecret : clientSecret,
  redirectUri : redirectUri
});

var loggedIn = false;
var userID = '';
var spotifyID = '';
var global_access_token = '';
var search_user_global = '';

app.listen(PORT, function(){
  console.log('-- Server listening on port 8080');
});

//to get GET/POST requests
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

//use handlebars to display
app.set('views', __dirname);
app.set('view engine', 'html');
app.engine('html', handlebars(
//   {
//   defaultLayout: 'home',
//   extname: '.html'
// }
));
app.use(express.static(__dirname)); // directory

//SOURCE CITED:
//POST request code based on Express 4 docs
//and handlebars display based on express-handlebars docs
//link: https://github.com/ericf/express-handlebars



//redirect to login page upon load
app.get('/', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.redirect('/home');
});
//home page
app.get('/home', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.render('./home.html', {"root": __dirname});
});
//login page
app.get('/login', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.render('./login.html', {"root": __dirname});
});
//register page
app.get('/register', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.render('./register.html', {"root": __dirname});
});
//profile page
app.post('/new_profile', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  //TODO - verify user input and sanitize

  session.saveUser(request, response);

});
//profile page
app.post('/returning_profile', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  //var request = request.body;
  //TODO - access their data + validate w/ database
  session.authenticateUser(request, response);
});
//already logged in/access profile page directly: go back to profile page or tell them not authorized:
app.get('/profile', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  if(loggedIn){
    response.render('./profile.html', {"root": __dirname, "User":userID});
    //getUserPlaylists(userID);
  }
  else{
    response.sendFile('./error.html', {"root": __dirname});
  }
});
//importing spotify data:
app.get('/spotify_import', function(request, response){
  console.log('-- Request received: spotify import');
  var scope = 'user-read-private user-read-email user-library-read playlist-modify-public playlist-modify-private';
  response.redirect('https://accounts.spotify.com/authorize?' +
  querystring.stringify({
    response_type: 'code',
    client_id: clientID,
    scope: scope,
    redirect_uri: redirectUri
  }));
});

//callback from spotify auth:
app.get('/callback', function(request, response){
  console.log('-- Request received: spotify callback');
  var code = request.query.code || null; //auth code from spotify!
  if (code===null){
    console.log('error retrieving spotify auth code');
    response.redirect('/error')
  }
  else{
    //got code succesfully, now init spotify web API connection
    console.log(code);

    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(clientID + ':' + clientSecret).toString('base64'))
      },
      json: true
    };

    request_library.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
        refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request_library.get(options, function(error, response, body) {
          console.log('weeee' + JSON.stringify(body));
          spotifyID = body.id;
          console.log("set spotify ID to " +spotifyID);
        });
        console.log('access_token is ' + access_token);
        global_access_token = access_token;
        spotifyApi.setAccessToken(access_token);

      }
    });
  }

  response.redirect('/import');


});

app.get('/import', function(request, response){
  console.log('-- Request received:');

  response.render('./import.html', {"root": __dirname});
});

app.get('/import_playlists', function(request, response){
  console.log('-- Request received:');

  // Get a user's playlists
  // spotifyApi.getUserPlaylists(spotifyID)
  // .then(function(data) {
  //   console.log('Retrieved playlists', data.body);
  // },function(err) {
  //   console.log('Something went wrong!', err);
  // });

  spotifyApi.getMySavedTracks({
    limit : 50
  })
  .then(function(data) {
    var songInfo = [];
    for(let i = 0; i < data.body.items.length; i++){
      // song.name = data.body.items[i].track.name;
	spotifyApi.getAudioFeaturesForTrack(data.body.items[i].track.id)
	.then(function(data1) {
        var song = {};
        song.album = data.body.items[i].track.album.name;
        song.name = data.body.items[i].track.name;
        song.artist = data.body.items[i].track.album.artists[0].name;
        console.log(data.body.items[i].track.album.artists[0].name);
        song.id =  data.body.items[i].track.id;
         song.dance = data1.body.danceability;
         song.loud = data1.body.loudness;
         song.instrum = data1.body.instrumentalness;
         songInfo.push(song);
         if(songInfo.length===data.body.items.length - 1){
           console.log("YEEEEEET");
           console.log(userID);
           db.User.findOneAndUpdate({"username": userID}, { "$addToSet": { "trackInfo": { "$each": songInfo } }}, function(err, doc){
             if(err){
               console.error(err);
             }
             console.log(doc);
           });
           // { "$addToSet": { "trackInfo": { "$each": songInfo } }});
           // console.log(JSON.stringify?)
         }
   	 }, function(err) {
      	console.error(err);
   	 });
    }

  }, function(err) {
    console.log('Something went wrong!', err);
  });

  //TODO: GET SONGS FROM PLAYLISTS : spotifyApi.getPlaylistTracks()

  //TODO : STORE PLAYLIST DATA / SONG DATA IN DATABASE

  response.render('./profile.html', {"root": __dirname, "User":userID, "Message":"Import success! Now search to find your friend's songs and combine your music tastes."});

});


// search for users
app.get('/search', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  var search_user = request.query.user; // the user that we are looking for
  getUserPlaylists(search_user, function(vals) {
    console.log(vals)
    if (vals === false) { // if vals is false, the user was not found
      console.log("CAN'T FIND USER");
      response.render('./export.html', {"root": __dirname, "Message":"Search Failed"}); // why was err returned as tracks?
    }
    else {
      console.log("FOUND USER");
      response.render('./export.html', {"root": __dirname, "Message":"Search Success! Combining your music tastes with user ", "User":search_user, "Tracks":vals});
      search_user_global = search_user;
    }
  });
//  response.redirect('/profile');
});

//logout redirect to login
app.get('/logout', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.status(200).type('html');
  loggedIn = false; //global auth variable (now logged out)
  response.redirect('/login');
});

app.get('/error', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.render('./error.html', {"root": __dirname});
});


//stylesheet
app.get('/styles.css', function(request, response){
  console.log('-- Request received:');
  response.sendFile('./styles.css', {"root": __dirname});
});


app.get('/spotify_export', function(request, response){
  console.log('-- Request received: export playlist');
  exportPlaylist(search_user_global);
  response.render('./profile.html', {"root": __dirname, "User":userID, "Message":"Playlist successfully exported! Check spotify."});
});


function exportPlaylist(id) {

  //SAMPLE PLAYLIST FROM USER SEARCHED FOR

  var toExport = [];
  console.log(id);
  var query = db.User.findOne({username: id}, function(err, obj) {
    if (obj === null) {
      console.log("Could not find user");
      return;
    } else {
      //for (let track_id in obj.trackInfo) {
      //  console.log(track_id);
      //  console.log(track_id.id);
        //return;
      //}
      for(let i=0; i<obj.trackInfo.length; i++){
        toExport.push('spotify:track:' + obj.trackInfo[i].id);
      }
      console.log(toExport);
    }
    //return;

  spotifyApi.createPlaylist(spotifyID, ('Commonlist Playlist ' + Math.floor(Math.random() * (10000 - 3000 + 1)) + 3000), { 'public' : false })
  .then(function(data) {
    spotifyApi.addTracksToPlaylist(spotifyID, data.body.id, toExport)
    .then(function(data) {
      console.log('Added tracks to playlist!');
    }, function(err) {
      console.log('Something went wrong!', err);
    });
  }, function(err) {
    console.log('Something went wrong!', err);
  });

});

  return;

}



//404!
app.get('*', function(request, response){
  console.log('-- Request received: 404');
  response.sendFile('./error.html', {"root": __dirname});
});

function getUserPlaylists(id, callback) {
  console.log(id);
  var query = db.User.findOne({username: id}, function(err, obj) {
    if (obj === null) {
      console.log("returning false");
      callback(false);
    } else {
      if (err) {
        console.error(err);
        console.log("returning false");
        callback(false);
      } else {
        console.log("returning object");
        //console.log('object: ' + obj);
        var tracks = obj.trackInfo;
        callback(tracks);
      }
    }

    return;

  });
}
