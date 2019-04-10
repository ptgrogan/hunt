module.exports = function(io) {
  var admin = null;
  var users = {};
  var partners = {};
  var payoffs = [[4, 0], [3, 2]]; // [SS, SH], [HS, HH]

  io.on('connection', function(socket) {
    var user;

    // respond to user login attempt
    socket.on('login-submit', function(data) {
      // authenticate unique user with master pass code
      if(data.passcode !== 'atilla') {
        socket.emit('login-auth', {'user': data.user, 'success': false, 'message': 'Incorrect pass code'});
      } else if(Object.keys(users).includes(data.user)) {
        socket.emit('login-auth', {'user': data.user, 'success': false, 'message': 'User name in use'});
      } else {
        user = data.user;
        users[user] = {'socket': socket, 'score': 0, 'strategy': 'hare'};
        socket.emit('login-auth', {'user': user, 'success': true});
        if(admin) {
          // return users sorted by decreasing score
          admin.emit('game-updated', {
            'users': Object.keys(users).map(
              i => ({
                  'user': i,
                  'score': users[i].score
              })
            ).sort((a, b) => b.score - a.score)
          });
        }
      }
    });

    // respond to admin login attempt
    socket.on('login-admin', function(data) {
      // authenticate single admin with master password
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

    // respond to user strategy change
    socket.on('strategy-select', function(data) {
      if(users[user]) {
        users[user].strategy = data.strategy;
      }
    });

    // respond to admin changing payoffs
    socket.on('setup-payoffs', function(data) {
      if(data.payoffs) {
        payoffs[0][0] = Number.parseFloat(data.payoffs[0][0]);
        payoffs[0][1] = Number.parseFloat(data.payoffs[0][1]);
        payoffs[1][0] = Number.parseFloat(data.payoffs[1][0]);
        payoffs[1][1] = Number.parseFloat(data.payoffs[1][1]);
      }
    });

    // respond to admin setting up partners
    socket.on('setup-partners', function(data) {
      if(data.mode === 'random') {
        // pair each user with random robot
        for(var i in users) {
          partners[i] = null;
          users[i].socket.emit('partner-updated', '<Random Robot>');
        }
      } else if(data.mode === 'paired' || data.mode === 'hidden') {
        // pair each user with random user
        var userNames = Object.keys(users).sort(() => 0.5 - Math.random());
        while(userNames.length > 1) {
          user1 = userNames.pop();
          userNames = userNames.sort(() => 0.5 - Math.random());
          user2 = userNames.pop();
          partners[user1] = user2;
          partners[user2] = user1;
        }
        // if odd number of players, pair last with a random robot
        if(userNames.length === 1) {
          partners[userNames[0]] = null;
        }
        for(var i in users) {
          if(data.mode === 'paired') {
            // send actual name of partner
            users[i].socket.emit('partner-updated', {'partner': partners[i]});
          } else {
            // hide actual name of partner
            users[i].socket.emit('partner-updated', {'partner': '<Hidden>'})
          }
        }
      }
    });

    // respond to admin resetting game
    socket.on('reset-game', function(data) {
      for(var i in users) {
        users[i].score = 0;
        users[i].socket.emit('score-reset');
      }
      if(admin) {
        // return users sorted in alphabetical order
        admin.emit('score-updated', {
          'users': Object.keys(users).map(
            i => ({
                'user': i,
                'score': users[i].score
            })
          ).sort((a, b) => a.user.localeCompare(b.user))
        });
      }
    });

    // respond to admin scoring game
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
        // return users sorted by decreasing score
        admin.emit('score-updated', {
          'users': Object.keys(users).map(
            i => ({
                'user': i,
                'delta': delta[i],
                'score': users[i].score,
                'strategy': users[i].strategy,
                'partnerStrategy': partnerStrategy[i]
            })
          ).sort((a, b) => b.score - a.score)
        });
      }
    });

    // respond to user disconnect
    socket.on('disconnect', function() {
      if(admin === socket) {
        admin = null;
      } else {
        delete users[user];
      }
    });
  });
};
