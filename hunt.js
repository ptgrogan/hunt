var validator = require('validator');

module.exports = function(io) {
  var admin = null;
  var users = {};
  var payoffs = [[4, 0], [3, 2]]; // [SS, SH], [HS, HH]

  function removeUser(userName) {
    // remove the user as anyone's partner
    Object.keys(users).forEach((i) => {
      if(users[i].partner === userName) {
        users[i].partner = null;
        users[i].partnerLabel = '<Random Robot>';
        users[i].socket.emit('partner-updated', { 'partnerLabel': users[i].partnerLabel });
      }
    });
    // remove this user from the application
    if(users.hasOwnProperty(userName)) {
      console.log('User ' + userName + ' disconnected.');
      delete users[userName];
    }
  }

  function addUser(userName, socket) {
    if(Object.keys(users).includes(userName)) {
      return false;
    } else {
      users[userName] = {
        'socket': socket,
        'partner': null,
        'partnerLabel': '<Random Robot>',
        'score': 0,
        'strategy': 'hare'
      };
      console.log('User ' + userName + ' connected.');
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
      return true;
    }
  }

  io.on('connection', (socket) => {
    var user;

    // respond to user login attempt
    socket.on('login-submit', (data) => {
      if(user !== null) {
        removeUser(user);
      }
      // authenticate unique user with master pass code
      if(!data.hasOwnProperty('user') || !data.hasOwnProperty('passcode')) {
          socket.emit('login-auth', {'success': false, 'message': 'Invalid request'});
          return;
      }
      var userInput = validator.escape(data.user + '');
      var passcodeInput = validator.escape(data.passcode + '');

      if(passcodeInput !== 'attila') {
        socket.emit('login-auth', {'user': userInput, 'success': false, 'message': 'Incorrect pass code'});
      } else {
        if(addUser(userInput, socket)) {
          user = userInput;
          socket.emit('login-auth', {'user': userInput, 'success': true});
        } else {
          socket.emit('login-auth', {'user': userInput, 'success': false, 'message': 'User name in use'});
        }
      }
    });

    // respond to admin login attempt
    socket.on('login-admin', (data) => {
      // authenticate single admin with master password
      if(!data.hasOwnProperty('password')) {
          socket.emit('login-auth', {'success': false, 'message': 'Invalid request'});
          return;
      }
      var passwordInput = validator.escape(data.password + '');
      if(passwordInput !== 'admin') {
        socket.emit('login-auth', {'success': false, 'message': 'Incorrect password'});
      } else if(admin !== null) {
        socket.emit('login-auth', {'success': false, 'message': 'Already logged in'});
      } else {
        admin = socket;
        socket.emit('login-auth', {'success': true});
        console.log('Admin connected.');
        socket.emit('payoffs-changed', {'payoffs': payoffs});
      }
    });

    // respond to user strategy change
    socket.on('strategy-select', (data) => {
      if(users.hasOwnProperty(user)
          && data.hasOwnProperty('strategy')
          && (data.strategy === 'hare' || data.strategy === 'stag')) {
        users[user].strategy = data.strategy;
      }
    });

    // respond to admin changing payoffs
    socket.on('setup-payoffs', (data) => {
      if(data.hasOwnProperty('payoffs')
          && Array.isArray(data.payoffs)
          && data.payoffs.length == 2
          && Array.isArray(data.payoffs[0])
          && data.payoffs[0].length == 2
          && Array.isArray(data.payoffs[1])
          && data.payoffs[1].length == 2) {
        payoffs[0][0] = Number.parseFloat(data.payoffs[0][0]);
        payoffs[0][1] = Number.parseFloat(data.payoffs[0][1]);
        payoffs[1][0] = Number.parseFloat(data.payoffs[1][0]);
        payoffs[1][1] = Number.parseFloat(data.payoffs[1][1]);
      }
    });

    // respond to admin setting up partners
    socket.on('setup-partners', (data) => {
      if(data.hasOwnProperty('mode') && data.mode === 'random') {
        // pair each user with random robot
        Object.keys(users).forEach((i) => {
          users[i].partner = null;
          users[i].partnerLabel = '<Random Robot>';
          users[i].socket.emit('partner-updated', { 'partnerLabel': users[i].partnerLabel });
        });
      } else if(data.hasOwnProperty('mode')
          && (data.mode === 'paired' || data.mode === 'hidden')) {
        // pair each user with random user
        var userNames = Object.keys(users).sort(() => 0.5 - Math.random());
        while(userNames.length > 1) {
          user1 = userNames.pop();
          user2 = userNames.pop();
          users[user1].partner = user2;
          users[user2].partner = user1;
        }
        // if odd number of players, pair last with a random robot
        if(userNames.length === 1) {
          users[userNames[0]].partner = null;
        }
        Object.keys(users).forEach((i) => {
          if(data.mode === 'paired') {
            // send actual name of partner
            users[i].partnerLabel = users[i].partner ? users[i].partner : '<Random Robot>';
          } else {
            // hide actual name of partner
            users[i].partnerLabel = '<Hidden>';
          }
          users[i].socket.emit('partner-updated', { 'partnerLabel': users[i].partnerLabel });
        });
      }
    });

    // respond to admin resetting game
    socket.on('reset-game', (data) => {
      Object.keys(users).forEach((i) => {
        users[i].score = 0;
        users[i].socket.emit('score-reset');
      });
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
    socket.on('score-game', (data) => {
      var delta = {};
      var partnerStrategy = {};
      Object.keys(users).forEach((i) => {
        if(users.hasOwnProperty(users[i].partner)) {
          partnerStrategy[i] = users[users[i].partner].strategy;
        } else {
          partnerStrategy[i] = Math.random() > 0.5 ? 'hare' : 'stag';
        }
        delta[i] = payoffs[users[i].strategy === 'stag' ? 0 : 1][partnerStrategy[i] === 'stag' ? 0 : 1]
        users[i].score += delta[i];
        users[i].socket.emit('score-updated', {
          'score': users[i].score,
          'delta': delta[i],
          'strategy': users[i].strategy,
          'partnerStrategy': partnerStrategy[i],
          'partnerLabel': users[i].partnerLabel
        });
      });
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
    socket.on('disconnect', () => {
      if(admin === socket) {
        admin = null;
      } else {
        removeUser(user);
      }
    });
  });
};
