$(function() {
  var user = "";
  var socket = io.connect();
  $('#login').modal('toggle');
  $('#login').submit(function(e) {
      e.preventDefault();
      socket.emit('login-submit', {
        'user': $('#inputUser').val(),
        'passcode': $('#inputPasscode').val()
      });
  });
  socket.on('login-auth', function(data) {
    if(data.success) {
      user = data.user;
      $('#nav-login').addClass('d-none')
      $('#info').text(user + ": " + 0);
      $('#nav-info').removeClass('d-none');
      $('#login-error').text();
      $('#login').modal('toggle');
    } else {
      $('#login-error').text(data.message);
    }
  });
  $('input[name=strategy]').on('change', function(e) {
    socket.emit('strategy-select', {'strategy': $('input[name=strategy]:checked').val()});
  });
  socket.on('score-updated', function(data) {
    var partner = data.partner ? data.partner : '<Unknown>';
    $('#log').val(new Date().toLocaleTimeString() + ' | Earned ' + data.delta + ' with ' + partner + '\n' + $('#log').val());
    $('#info').text(user + ": " + data.score);
  });
  socket.on('score-reset', function(data) {
    $('#log').val(new Date().toLocaleTimeString() + ' | Score Reset' + '\n' + $('#log').val());
    $('#info').text(user + ": " + 0);
  });
  socket.on('partner-updated', function(data) {
    if(data.partner) {
      $('#partner').val(data.partner);
    } else {
      $('#partner').val("<Random Robot>");
    }
  });
});
