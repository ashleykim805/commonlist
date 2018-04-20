
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

// mongoDB stuff
// https://thinkster.io/tutorials/node-json-api/creating-the-user-model
var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
var db = mongoose.connection;

db.on('error', console.error); // log any errors that occur
db.once('open', function() { // bind a function to perform when database has been opened
  console.log("Connected to DB"); // perform any queries here
});

process.on('SIGINT', function(){
  console.log('DB connnection closed by Node process ending');
  process.exit(0);
});

mongoose.connect('mongodb://commonlist_admin:brunonian18@ds141889.mlab.com:41889/commonlist');

//var secret = require('../config').secret;
var userSchema = new mongoose.Schema({
  username: {type:String, lowercase:true, unique:true, required:[true, "can't be blank"], match:[/^[a-zA-Z0-9]+$/, 'is invalid'], index:true},
  email: {type:String, lowercase:true, unique:true, required:[true, "can't be blank"], match:[/\S+@\S+\.\S+/,'is invalid'], index:true},
  image: String,
  hash: String,
  salt: String,
  trackInfo: [{name: String, album: String, artist: String, id: String, dance: Number, loud: Number, instrum: Number}]
});

// hashes the pw
userSchema.methods.setPassword = function(password){
  this.salt = crypto.randomBytes(16).toString('hex');
  this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};
// validates the pw
userSchema.methods.validPassword = function(password) {
  var hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
  return this.hash === hash;
};
// make a method on user model that makes a JWT
userSchema.methods.generateJWT = function() {
  var today = new Date();
  var exp = new Date(today);
  exp.setDate(today.getDate() + 60);

  return jwt.sign({
    id: this._id,
    username: this.username,
    exp: parseInt(exp.getTime() / 1000),
  }, secret);
};
// gets JSON object of user to front end for authentication
userSchema.methods.toAuthJSON = function(){
  return {
    username: this.username,
    email: this.email,
    token: this.generateJWT(),
    image: this.image
  };
};
userSchema.plugin(uniqueValidator, {message: 'is already taken.'});
// register schema w/ mongoose
var User = mongoose.model('User', userSchema);

// end mongoDB stuff

//redirect to login page upon load
app.get('/', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.redirect('/home');
});
//home page
app.get('/home', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  response.sendFile('./home.html', {"root": __dirname});
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
    getUserPlaylists(userID);
  }
  else{
    response.sendFile('./error.html', {"root": __dirname});
  }
});
//importing spotify data:
app.get('/spotify_import', function(request, response){
  console.log('-- Request received: spotify import');
  var scope = 'user-read-private user-read-email user-library-read';
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
          console.log(body);
        });
        console.log('access_token is ' + access_token);
        global_access_token = access_token;
        spotifyApi.setAccessToken(access_token);
        spotifyID = body.id;
      }
    });
  }

  response.redirect('/import');


});

app.get('/import', function(request, response){
  console.log('-- Request received:');

  response.sendFile('./import.html', {"root": __dirname});
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
           User.findOneAndUpdate({"username": userID}, { "$addToSet": { "trackInfo": { "$each": songInfo } }}, function(err, doc){
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


//search for users
app.get('/search', function(request, response){
  console.log('-- Request received:', request.method, request.url);
  var search_user = request.query.user;
  var vals = getUserPlaylists(search_user);
  if (vals===false){
    response.render('./export.html', {"root": __dirname, "Message":"Search Failed", "Tracks":err});

  }
  else {
    response.render('./export.html', {"root": __dirname, "Message":"Search Success", "Tracks":vals});
  }
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
  response.sendFile('./error.html', {"root": __dirname});
});


//stylesheet
app.get('/styles.css', function(request, response){
  console.log('-- Request received:');
  response.sendFile('./styles.css', {"root": __dirname});
});


//404!
app.get('*', function(request, response){
  console.log('-- Request received: 404');
  response.sendFile('./error.html', {"root": __dirname});
});


app.listen(8080, function(){
  console.log('-- Server listening on port 8080');
});

function getUserPlaylists(id) {
  var query = db.User.findOne({username: id}, function(err, obj) {
    if (err===null){
      return false;
    }
    else {
      console.log(obj);
      var tracks = obj.trackInfo;
      return tracks;
    }
    
  });
}
