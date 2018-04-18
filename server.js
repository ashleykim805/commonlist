
  var express = require('express');
  var app = express();
  var bodyParser = require('body-parser');
  var handlebars  = require('express-handlebars');
  var querystring = require('querystring');
  var request_library = require('request'); // "Request" library




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
  app.set('view engine', 'html');
  app.engine('html', handlebars({
	defaultLayout: 'home',
	extname: '.html'
  }));

  //SOURCE CITED:
  //POST request code based on Express 4 docs
  //and handlebars display based on express-handlebars docs
  //link: https://github.com/ericf/express-handlebars

  app.use(express.static(__dirname)); // directory

  //redirect to login page upon load
  app.get('/', function(request, response){
      console.log('- Request received:');
      response.redirect('/home');
  });
  //home page
  app.get('/home', function(request, response){
      console.log('- Request received:');
      response.sendFile('./home.html', {"root": __dirname});
  });
  //login page
  app.get('/login', function(request, response){
      console.log('- Request received:');
      response.sendFile('./login.html', {"root": __dirname});
  });
  //profile page
  app.get('/profile', function(request, response){
      console.log('- Request received:');
      response.sendFile('./profile.html', {"root": __dirname});
  });
  //importing spotify data:
  app.get('/spotify_import', function(request, response){
      console.log('- Request received: spotify import');
      var scope = 'user-read-private user-read-email';
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
      console.log('- Request received: spotify callback');
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
      console.log('- Request received:');

      response.sendFile('./import.html', {"root": __dirname});
  });

  app.get('/import_playlists', function(request, response){
      console.log('- Request received:');
      
        // Get a user's playlists
      spotifyApi.getUserPlaylists(spotifyID)
        .then(function(data) {
          console.log('Retrieved playlists', data.body);
        },function(err) {
          console.log('Something went wrong!', err);
        });

        //TODO: GET SONGS FROM PLAYLISTS : spotifyApi.getPlaylistTracks()

        //TODO : STORE PLAYLIST DATA / SONG DATA IN DATABASE

        response.redirect('/import');

  });


  //logout redirect to login
  app.get('/logout', function(request, response){
      console.log('- Request received:');
      response.redirect('/login');
  });

  app.get('/error', function(request, response){
      console.log('- Request received:');
      response.sendFile('./error.html', {"root": __dirname});
  });


  //stylesheet
  app.get('/styles.css', function(request, response){
      console.log('- Request received:');
      response.sendFile('./styles.css', {"root": __dirname});
  });


  //404! 
  app.get('*', function(request, response){
      console.log('- Request received: 404');
      response.status(404).send('404: Whoops! Cannot find that page.')
  });


  app.listen(8080, function(){
      console.log('- Server listening on port 8080');
  });