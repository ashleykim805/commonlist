
  var express = require('express');
  var app = express();
  var bodyParser = require('body-parser');
  var handlebars  = require('express-handlebars');


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
      response.redirect('/login');
  });

  //login page
  app.get('/login', function(request, response){
      console.log('- Request received:');
      response.sendFile('./home.html', {"root": __dirname});
  });
  //logout redirect to login
  app.get('/logout', function(request, response){
      console.log('- Request received:');
      response.redirect('/login');
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