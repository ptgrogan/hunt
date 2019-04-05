var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var admin = null;
var users = {};
var partners = {};

var payoffs = [[4, 0], [3, 2]]; // [SS, SH], [HS, HH]

io.on('connection', function(socket) {
  var user;
  socket.on('login-submit', function(data) {
    if(data.passcode !== 'atilla') {
      socket.emit('login-auth', {'user': data.user, 'success': false, 'message': 'Incorrect pass code'});
    } else if(Object.keys(users).includes(data.user)) {
      socket.emit('login-auth', {'user': data.user, 'success': false, 'message': 'User name in use'});
    } else {
      user = data.user;
      users[user] = {'socket': socket, 'score': 0, 'strategy': 'hare'};
      socket.emit('login-auth', {'user': user, 'success': true});
      if(admin) {
        admin.emit('game-updated', {
          'users': Object.keys(users).map(function(i) { return {'user': i, 'score': users[i].score}; }).sort(function(i) { return i.score; })
        });
      }
    }
  });
  socket.on('login-admin', function(data) {
    if(data.password !== 'admin') {
      socket.emit('login-auth', {'success': false, 'message': 'Incorrect password'});
    } else if(admin !== null) {
      socket.emit('login-auth', {'success': false, 'message': 'Already logged in'});
    } else {
      admin = socket;
      socket.emit('login-auth', {'success': true});
      socket.emit('payoffs-changed', {'payoffs': payoffs});
    }
  });
  socket.on('strategy-select', function(data) {
    users[user].strategy = data.strategy;
  });
  socket.on('setup-payoffs', function(data) {
    if(data.payoffs) {
      payoffs[0][0] = Number.parseFloat(data.payoffs[0][0]);
      payoffs[0][1] = Number.parseFloat(data.payoffs[0][1]);
      payoffs[1][0] = Number.parseFloat(data.payoffs[1][0]);
      payoffs[1][1] = Number.parseFloat(data.payoffs[1][1]);
    }
  });
  socket.on('setup-partners', function(data) {
    if(data.mode === 'random') {
      for(var i in users) {
        partners[i] = null;
        users[i].socket.emit('partner-updated', '<Random Robot>');
      }
    } else if(data.mode === 'paired' || data.mode === 'hidden') {
      var userNames = Object.keys(users).sort(function() { return 0.5 - Math.random(); });
      while(userNames.length > 1) {
        user1 = userNames.pop();
        userNames = userNames.sort(function() { return 0.5 - Math.random(); });
        user2 = userNames.pop();
        partners[user1] = user2;
        partners[user2] = user1;
      }
      if(userNames.length === 1) {
        partners[userNames[0]] = null;
      }
      for(var i in users) {
        if(data.mode === 'paired') {
          users[i].socket.emit('partner-updated', {'partner': partners[i]});
        } else {
          users[i].socket.emit('partner-updated', {'partner': '<Hidden>'})
        }
      }
    }
  });
  socket.on('reset-game', function(data) {
    for(var i in users) {
      users[i].score = 0;
      users[i].socket.emit('score-reset');
    }
    if(admin) {
      admin.emit('game-updated', {
        'users': Object.keys(users).map(function(i) { return {'user': i, 'score': users[i].score}; }).sort()
      });
    }
  });
  socket.on('score-game', function(data) {
    var delta = {};
    var partnerStrategy = {};
    for(var i in users) {
      if(partners[i]) {
        partnerStrategy[i] = users[partners[i]].strategy;
      } else {
        partnerStrategy[i] = Math.random() > 0.5 ? 'hare' : 'stag';
      }
      delta[i] = payoffs[users[i].strategy === 'stag' ? 0 : 1][partnerStrategy[i] === 'stag' ? 0 : 1]
      users[i].score += delta[i];
      users[i].socket.emit('score-updated', {
        'score': users[i].score,
        'delta': delta[i],
        'partner': partners[i] ? partners[i] : '<Random Robot>'
      });
    }
    if(admin) {
      admin.emit('game-updated', {
        'users': Object.keys(users).map(function(i) { return {'user': i, 'delta': delta[i], 'score': users[i].score, 'strategy': users[i].strategy, 'partnerStrategy': partnerStrategy[i]}; }).sort((function(a, b) { return b.score - a.score; }))
      });
    }
  });
  socket.on('disconnect', function() {
    delete users[user];
  });
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

module.exports = {app: app, server: server};
