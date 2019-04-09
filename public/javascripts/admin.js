$(function() {
  var ctx = document.getElementById('chartDecisions').getContext('2d');
  var chartDecisions = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['Stag', 'Hare'],
        datasets: [{
            label: '# Decisions',
            data: [0, 0]
        }]
    },
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    beginAtZero: true
                }
            }]
        }
    }
  });
  var ctx = document.getElementById('chartOutcomes').getContext('2d');
  var chartOutcomes = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['Stag / Stag', 'Hare / Stag', 'Hare / Hare', 'Stag / Hare' ],
        datasets: [{
            label: '# Outcomes',
            data: [0, 0, 0, 0]
        }]
    },
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    beginAtZero: true
                }
            }]
        }
    }
  });


  var socket = io.connect();
  $('#login').modal('toggle');
  $('#login').submit(function(e) {
      e.preventDefault();
      socket.emit('login-admin', {
        'password': $('#inputPassword').val()
      });
  });
  socket.on('login-auth', function(data) {
    if(data.success) {
      $('#nav-login').addClass('d-none')
      $('#info').text('admin');
      $('#nav-info').removeClass('d-none');
      $('#login-error').text();
      $('#login').modal('toggle');
    } else {
      $('#login-error').text(data.message);
    }
  });
  $('#reset-game').on('click', function(e) {
    socket.emit('reset-game');
  });
  $('#score-game').on('click', function(e) {
    socket.emit('score-game');
  });
  $('#setup-partners').on('click', function(e) {
    socket.emit('setup-partners', {'mode': $('#selectPartners option:selected').val()});
  });
  $('input[type=number]').change(function(e) {
    var payoffs = [[$('#SS').val(), $('#SH').val()], [$('#HS').val(), $('#HH').val()]];
    socket.emit('setup-payoffs', {'payoffs': payoffs});
  });
  socket.on('payoffs-changed', function(data) {
    $('#SS').val(data.payoffs[0][0]);
    $('#SH').val(data.payoffs[0][1]);
    $('#HS').val(data.payoffs[1][0]);
    $('#HH').val(data.payoffs[1][1]);
  });
  socket.on('game-updated', function(data) {
    $('#scoreboard table tbody').empty();
    if(data.users) {
      var strategy = [0, 0]; // S, H
      var outcomes = [[0, 0], [0, 0]] // SS, SH, HS, HH
      for(var i=0; i < data.users.length; i++) {
        $('#scoreboard table tbody').append('<tr scope="row"><td>'+(i+1)+'</td><td>'+data.users[i].user+'</td><td>'+data.users[i].score+'</td></tr>');
        if(data.users[i].strategy) {
          strategy[data.users[i].strategy === 'stag' ? 0 : 1] += 1;
          outcomes[data.users[i].strategy === 'stag' ? 0 : 1][data.users[i].partnerStrategy === 'stag' ? 0 : 1] += 1;
        }
      }
      chartDecisions.data.datasets[0].data[0] = strategy[0];
      chartDecisions.data.datasets[0].data[1] = strategy[1];
      chartDecisions.update();
      chartOutcomes.data.datasets[0].data[0] = outcomes[0][0];
      chartOutcomes.data.datasets[0].data[1] = outcomes[1][0];
      chartOutcomes.data.datasets[0].data[2] = outcomes[1][1];
      chartOutcomes.data.datasets[0].data[3] = outcomes[0][1];
      chartOutcomes.update();
    }
  });
});
